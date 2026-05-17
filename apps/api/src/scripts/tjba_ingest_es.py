#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestão das Revistas de Jurisprudência do TJBA no Elasticsearch.

Fonte: revista_*.pdf  (Revista Bahia Forense Eletrônica / Bahia Forense)
  - 2020-2024: decisões separadas por *****; citação no INÍCIO de cada chunk
  - 2025: sem separador *****; citação igualmente no início

Pipeline por arquivo:
  1. Extrai texto via pdfplumber
  2. Flatten: remove quebras de linha, reune hifens, remove cabeçalhos
  3. Divide em decisões via split_decisions_start (citação no início)
  4. Extrai campos ES de cada chunk

Uso:
    python tjba_ingest_es.py
    python tjba_ingest_es.py --dry-run
    python tjba_ingest_es.py --reset
    python tjba_ingest_es.py --es-url http://localhost:9200
"""

import argparse
import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import Optional

import pdfplumber
from elasticsearch import Elasticsearch, helpers

# ── Caminhos ──────────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
PDF_FOLDER   = PROJECT_ROOT / "temp" / "boletins" / "tjba"
CHECKPOINT   = SCRIPT_DIR / "tjba_ingest_checkpoint.json"
LOG_FILE     = SCRIPT_DIR / "tjba_ingest_es.log"
ES_INDEX     = "jurisprudencia"

# ── Regexes TJBA ──────────────────────────────────────────────────────────────

_PROC_RE = r'\d{7,9}(?:-\d{2})?\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}'

_HEADER_RE = re.compile(
    r'\d{1,3}\s+(?:BAHIA FORENSE ELETRÔNICA'
    r'|REVISTA BAHIA FORENSE(?:\s*-\s*Nº\s*\d+)?)\s*',
)

# Split: detecta início de cada decisão (citação no começo do chunk)
CITATION_RE = re.compile(
    r'\(TJBA\s*[-–]\s*'
    r'[A-ZÀ-ÿa-záéíóúàâêôãõç][A-ZÀ-ÿa-záéíóúàâêôãõç\s]{3,80}?'
    r'\s+[Nn][.º°]+\s*' + _PROC_RE +
    r'[^)]{0,500}?[Jj]ulgad[oa][^)]{1,80}\)',
    re.DOTALL,
)

# Detail v1: órgão antes do relator (maioria das edições)
_DETAIL_V1 = re.compile(
    r'\(TJBA\s*[-–]\s*'
    r'(?P<tipo>[A-ZÀ-ÿa-záéíóúàâêôãõç][A-ZÀ-ÿa-záéíóúàâêôãõç\s]{3,80}?)'
    r'\s+n[.º°]+\s*'
    r'(?P<processo>' + _PROC_RE + r')'
    r'[.,]?\s*'
    r'(?P<orgao>[^.]{3,100}?)'
    r'[.,]?\s*relator(?:\([aA]\))?a?:?\s*(?:des[aª]?\.?\s*)?'
    r'(?P<relator>[^,.\n)]{3,70}?)[,.]'
    r'\s*julgad[oa][^)]{0,20}?'
    r'(?P<data_julgamento>\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2}|(?:19|20)\d{2})'
    r'[^)]{0,40}?\)',
    re.DOTALL | re.IGNORECASE,
)

# Detail v2: relator antes do órgão (alguns de 2020)
_DETAIL_V2 = re.compile(
    r'\(TJBA\s*[-–]\s*'
    r'(?P<tipo>[A-ZÀ-ÿa-záéíóúàâêôãõç][A-ZÀ-ÿa-záéíóúàâêôãõç\s]{3,80}?)'
    r'\s+n[.º°]+\s*'
    r'(?P<processo>' + _PROC_RE + r')'
    r'[.,]\s*'
    r'relator(?:\([aA]\))?a?:?\s*(?:des[aª]?\.?\s*)?'
    r'(?P<relator>[^,.\n)]{3,70}?),'
    r'\s*(?P<orgao>[^,)]{3,100}?),'
    r'\s*julgad[oa][^)]{0,20}?'
    r'(?P<data_julgamento>\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2}|(?:19|20)\d{2})'
    r'[^)]{0,40}?\)',
    re.DOTALL | re.IGNORECASE,
)

# Limites do dispositivo (fim da ementa)
_BOUND_RE = re.compile(
    r'AC[OÓ]RD[ÃA]O\s+(?:[Vv]istos|[Rr]elatados)'
    r'|ACORDAM\s+os\s+Desembargadores'
    r'|[Vv]istos,?\s+relatados\s+e\s+discutidos\s+estes\s+autos'
    r'|\bRELATÓRIO\b|R E L A T [OÓ] R I O'
    r'|\bDECISÃO PROCLAMADA\b|\bVOTO\b',
    re.IGNORECASE,
)

# ── Área do direito ────────────────────────────────────────────────────────────

_AREA_MAP: list[tuple[str, re.Pattern]] = [
    ("CRIMINAL", re.compile(
        r"penal|criminal|crime\b|homic[íi]dio|roubo|latrocínio|peculato|"
        r"femini|lesão corporal|associação criminosa|habeas.corpus|"
        r"embriaguez|corrupção ativa|tráfico|estelionato|furto|"
        r"Câmara Criminal|Crimes de Trânsito|Estatuto do Idoso",
        re.IGNORECASE,
    )),
    ("TRIBUTARIO", re.compile(
        r"tribut[aá]r|ipva|icms|ipi\b|imposto\b|execu[çc][aã]o fiscal|"
        r"cr[eé]dito tribut|contribui[çc][aã]o social|fgts\b",
        re.IGNORECASE,
    )),
    ("ADMINISTRATIVO", re.compile(
        r"servidor\w*\s+p[úu]blico|concurso p[úu]blico|licita[çc][aã]o|"
        r"improbidade|ato administrativo|cargo p[úu]blico|"
        r"gratifica[çc][aã]o|precatório|mandado de segurança|"
        r"teto remuneratório|incidente de resolução de demandas",
        re.IGNORECASE,
    )),
    ("CONSTITUCIONAL", re.compile(
        r"adin\b|adpf\b|adc\b|ação direta de inconstitucionalidade|"
        r"inconstitucionalidade\s+(?:formal|material|da\s+lei|da\s+norma)|"
        r"controle de constitucionalidade|Direito Constitucional",
        re.IGNORECASE,
    )),
    ("CONSUMIDOR", re.compile(
        r"consumidor|energia el[eé]trica|fatura|plano de saúde|"
        r"cadastro de inadimplentes|serasa\b|negativação",
        re.IGNORECASE,
    )),
    ("FAMILIA", re.compile(
        r"fam[íi]lia|uni[aã]o est[aá]vel|div[oó]rcio|alimentos|"
        r"guarda\s+(?:de\s+)?(?:filho|criança|menor|compartilhad)|paternidade|"
        r"adoção\s+(?:de\s+)?(?:filho|criança|menor)|ação de adoção",
        re.IGNORECASE,
    )),
    ("CIVIL", re.compile(
        r"\bcivil\b|indeniza[çc][aã]o|responsabilidade|contrato|"
        r"poss[ea]|usucapi|loca[çc][aã]o|obriga[çc][aã]o|"
        r"rescis[oó]ria|rescindenda|despejo|seguro\b",
        re.IGNORECASE,
    )),
]


def _classify_area(text: str) -> str:
    for area, pat in _AREA_MAP:
        if pat.search(text):
            return area
    return "OUTRO"


def _classify_secao(orgao: str) -> str:
    o = orgao.lower()
    if "criminal" in o:
        return "CRIMINAL"
    if "cível" in o or "civel" in o:
        return "CÍVEL"
    if "pleno" in o:
        return "PLENO"
    if "especial" in o:
        return "ESPECIAL"
    return orgao[:40].strip()


# ── Extração e normalização ────────────────────────────────────────────────────

def _extract_pdf(path: Path) -> str:
    pages = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
    return "\n".join(pages)


def _flatten(text: str) -> str:
    text = text.replace("\n", " ")
    text = re.sub(r" {2,}", " ", text)
    text = re.sub(r"(\w)- (\w)", r"\1\2", text)  # desfaz hifenação de linha
    text = _HEADER_RE.sub(" ", text)
    text = re.sub(r" {2,}", " ", text)
    text = re.sub(r" \.", ".", text)
    return text.strip()


def _split_decisions(text: str) -> list[str]:
    """Citação no início de cada chunk."""
    matches = list(CITATION_RE.finditer(text))
    if not matches:
        return []
    seen: set[str] = set()
    chunks: list[str] = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        chunk = text[m.start():end].strip()
        key = chunk[:120]
        if len(chunk) > 200 and key not in seen:
            chunks.append(chunk)
            seen.add(key)
    return chunks


# ── Parse de campos ────────────────────────────────────────────────────────────

def _parse_date(raw: str) -> Optional[str]:
    raw = raw.strip()
    m = re.search(r"(\d{1,2})[./](\d{1,2})[./]((?:19|20)\d{2})", raw)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    m = re.search(r"((?:19|20)\d{2})", raw)
    return f"{m.group(1)}-01-01" if m else None


def _parse_decision(chunk: str, filename: str) -> Optional[dict]:
    m = _DETAIL_V1.match(chunk.strip())
    if not m:
        m = _DETAIL_V2.match(chunk.strip())
    if not m:
        return None

    tipo     = re.sub(r'\s+', ' ', m.group("tipo")).strip().title()
    processo = m.group("processo")
    relator  = re.sub(r'\s+', ' ', m.group("relator")).strip().title()
    orgao    = re.sub(r'\s+', ' ', m.group("orgao")).strip()
    data     = _parse_date(m.group("data_julgamento"))

    ementa_raw = chunk[m.end():].lstrip("). ")
    ementa_raw = re.sub(
        r'^(?:EMENTA\s+EMENTA:\s*|EMENTA:\s*|EMENTA\s+'
        r'|AC[OÓ]RD[ÃA]O\s+[Ee]menta:\s*|AC[OÓ]RD[ÃA]O\s+)',
        '', ementa_raw, flags=re.IGNORECASE,
    ).strip()

    mb = _BOUND_RE.search(ementa_raw)
    ementa = ementa_raw[:mb.start()].strip() if mb else ementa_raw.strip()

    area  = _classify_area(ementa[:300])
    secao = _classify_secao(orgao)

    return {
        "_id":            f"tjba-{processo}",
        "tribunal":       "TJBA",
        "tipo":           tipo,
        "numero":         processo,
        "relator":        relator,
        "orgaoJulgador":  orgao,
        "dataJulgamento": data,
        "area":           area,
        "secao":          secao,
        "fonte":          Path(filename).name,
        "ementa":         ementa,
    }


def process_file(path: Path) -> list[dict]:
    raw    = _extract_pdf(path)
    flat   = _flatten(raw)
    chunks = _split_decisions(flat)

    docs: list[dict] = []
    seen: set[str]   = set()
    for chunk in chunks:
        doc = _parse_decision(chunk, path.name)
        if doc and doc["_id"] not in seen:
            docs.append(doc)
            seen.add(doc["_id"])
    return docs


# ── Checkpoint ────────────────────────────────────────────────────────────────

def load_checkpoint() -> set:
    if not CHECKPOINT.exists():
        return set()
    try:
        return set(json.loads(CHECKPOINT.read_text(encoding="utf-8")).get("done", []))
    except Exception:
        return set()


def save_checkpoint(done: set) -> None:
    CHECKPOINT.write_text(
        json.dumps({"done": list(done)}, ensure_ascii=False),
        encoding="utf-8",
    )


# ── ES Bulk ───────────────────────────────────────────────────────────────────

def bulk_insert(es: Elasticsearch, docs: list[dict], counters: dict) -> None:
    actions = [
        {"_index": ES_INDEX, "_id": d["_id"], **{k: v for k, v in d.items() if k != "_id"}}
        for d in docs
    ]
    try:
        ok, errors = helpers.bulk(es, actions, raise_on_error=False)
        counters["indexed"] += ok
        counters["es_errors"] += len(errors) if errors else 0
        if errors:
            for err in errors[:3]:
                log.warning(f"  ES erro: {err}")
    except Exception as e:
        log.error(f"Bulk insert falhou: {e}")


# ── Main ──────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)


def main() -> None:
    ap = argparse.ArgumentParser(description="Ingestão TJBA revistas → Elasticsearch")
    ap.add_argument("--folder",  default=str(PDF_FOLDER))
    ap.add_argument("--batch",   type=int, default=50)
    ap.add_argument("--es-url",  default=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"))
    ap.add_argument("--reset",   action="store_true", help="Remove checkpoint e recomeça")
    ap.add_argument("--dry-run", action="store_true", help="Extrai mas não indexa")
    args = ap.parse_args()

    folder = Path(args.folder)
    if not folder.exists():
        sys.exit(f"Pasta não encontrada: {folder}")

    pdfs = sorted(folder.glob("revista_*.pdf"))
    if not pdfs:
        sys.exit(f"Nenhum PDF revista_*.pdf em: {folder}")

    if args.reset and CHECKPOINT.exists():
        CHECKPOINT.unlink()
        log.info("Checkpoint removido")

    done = load_checkpoint()
    es   = None if args.dry_run else Elasticsearch(args.es_url)

    counters = {"pdfs": 0, "decisions": 0, "indexed": 0,
                "es_errors": 0, "skipped": 0, "failed": 0}
    buffer: list[dict] = []

    log.info("=" * 60)
    log.info(f"TJBA -> ES  |  {len(pdfs)} PDFs  |  já feitos: {len(done)}")
    log.info(f"Pasta: {folder}")
    log.info("DRY-RUN: não indexa no ES" if args.dry_run else f"ES: {args.es_url}  índice: {ES_INDEX}")
    log.info("=" * 60)

    for pdf in pdfs:
        if pdf.name in done:
            counters["skipped"] += 1
            continue

        try:
            log.info(f"{pdf.name}")
            docs = process_file(pdf)
            log.info(f"  -> {len(docs)} decisoes")

            if not docs:
                log.warning(f"  AVISO: 0 decisoes em {pdf.name}")

            counters["decisions"] += len(docs)

            if args.dry_run:
                for d in docs[:2]:
                    log.info(f"  [dry] {d['numero']} | {d['relator']} | {d['dataJulgamento']} | {d['area']}")
                    log.info(f"        ementa: {d['ementa'][:200]}")
            else:
                buffer.extend(docs)
                if len(buffer) >= args.batch:
                    bulk_insert(es, buffer, counters)
                    buffer.clear()

            done.add(pdf.name)
            save_checkpoint(done)
            counters["pdfs"] += 1

        except Exception as e:
            log.error(f"{pdf.name}: {e}")
            counters["failed"] += 1

    if not args.dry_run and buffer:
        bulk_insert(es, buffer, counters)

    log.info("=" * 60)
    log.info(f"Concluído: {counters['pdfs']} PDFs | {counters['decisions']} decisões")
    log.info(f"  Indexados  : {counters['indexed']}")
    log.info(f"  Pulados    : {counters['skipped']}")
    log.info(f"  Falhas PDF : {counters['failed']}")
    log.info(f"  Erros ES   : {counters['es_errors']}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestão dos Informativos de Jurisprudência do TJCE no Elasticsearch.

Fonte: informativo_*.pdf
  - 2024: formato V1 (tipo em parênteses) e V2 (ponto-e-vírgula, "julgado em")
  - 2025: formato V2/V3 (campos rotulados com dois-pontos)
  - 2026: formato V3 ("data do julgamento:")

Pipeline por arquivo:
  1. Extrai texto via pdfplumber
  2. Flatten: remove quebras de linha, reúne hifens
  3. Divide em decisões via split_decisions_start (citação no início)
  4. Extrai campos ES de cada chunk (Destaque + Inteiro Teor → ementa)

Uso:
    python tjce_ingest_es.py
    python tjce_ingest_es.py --dry-run
    python tjce_ingest_es.py --reset
    python tjce_ingest_es.py --es-url http://localhost:9200
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
PDF_FOLDER   = PROJECT_ROOT / "temp" / "boletins" / "tjce"
CHECKPOINT   = SCRIPT_DIR / "tjce_ingest_checkpoint.json"
LOG_FILE     = SCRIPT_DIR / "tjce_ingest_es.log"
ES_INDEX     = "jurisprudencia"

# ── Regexes TJCE ──────────────────────────────────────────────────────────────

_PROC_RE = r'\d{7,8}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}'

# Split: detecta início de cada decisão
CITATION_RE = re.compile(
    r'(?:Mandado\s+de\s+Seguran[çc]a(?:\s+Preventivo)?|Processo)\s+'
    r'n[oº°]?:?\s+' + _PROC_RE,
    re.IGNORECASE,
)

# Formato 2026: campos rotulados, "data do julgamento:"
_DETAIL_V3 = re.compile(
    r'Processo\s+n[oº°]?:\s+'
    r'(?P<processo>' + _PROC_RE + r')'
    r';\s*(?:[Óo]rg[aã]o\s+julgador:\s*)?'
    r'(?P<orgao>[^;]+?)\s*;\s*'
    r'[Rr]elator(?:a)?(?:\([aA]\))?\s*:?\s*(?:Desembargador(?:a)?(?:\([aA]\))?\s+)?'
    r'(?P<relator>[^;,\n]+?)\s*[;,]\s*'
    r'data\s+do\s+julgamento:\s*'
    r'(?P<data>\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2})',
    re.IGNORECASE,
)

# Formato 2025: ponto-e-vírgula, "julgado em"
_DETAIL_V2 = re.compile(
    r'Processo\s+n[oº°]\s+'
    r'(?P<processo>' + _PROC_RE + r')'
    r';\s*(?P<orgao>[^;]+?)\s*;\s*'
    r'[Rr]elator(?:a)?\s+(?:Desembargador(?:a)?(?:\([aA]\))?\s+)?'
    r'(?P<relator>[^,;\n]+?)'
    r'[,;]\s*(?:por\s+unanimidade[,;\s]+)?'
    r'julgado\s+em\s+'
    r'(?P<data>\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2})',
    re.IGNORECASE,
)

# Formato 2024: tipo em parênteses, vírgulas
_DETAIL_V1 = re.compile(
    r'Processo\s+n[oº°]\s+'
    r'(?P<processo>' + _PROC_RE + r')'
    r'\s*\((?P<tipo>[^)]{3,60})\)\s*,\s*'
    r'(?P<orgao>[^,]+?)\s*,\s*'
    r'[Rr]elator(?:a)?\s+(?:Desembargador(?:a)?(?:\([aA]\))?\s+)?'
    r'(?P<relator>[^,;\n]+?)'
    r'[,;]\s*(?:por\s+unanimidade[,;\s]+)?'
    r'(?:julgado\s+em|data\s+de\s+julgamento)\s+'
    r'(?P<data>\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2})',
    re.IGNORECASE,
)

# Mandado de Segurança (sem câmara, sem tipo em parênteses)
_DETAIL_V0 = re.compile(
    r'(?P<label>Mandado\s+de\s+Seguran[çc]a(?:\s+Preventivo)?)\s+n[oº°]\s+'
    r'(?P<processo>' + _PROC_RE + r')'
    r'[;,]\s*'
    r'(?:(?P<orgao>[^;,]+?)[;,]\s*)?'
    r'[Rr]elator\s+(?:Desembargador(?:a)?(?:\([aA]\))?\s+)?'
    r'(?P<relator>[^,;\n]+?)'
    r'[,;]\s*(?:data\s+de\s+julgamento|julgado\s+em)\s+'
    r'(?P<data>\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2})',
    re.IGNORECASE,
)

# Boundary da seção de metadados (Legislação/Jurisprudência como label)
_METASEC = (
    r'\bLegisla[çc][aã]o(?:\s+aplicada)?\s+'
    r'(?:Lei\b|C[oó]digo\b|CF\b|CPC\b|CPP?\b|CLT\b|CDC\b|CTN\b|ECA\b|LINDB\b|'
    r'Decreto\b|Constitui[çc][aã]o\b|Estatuto\b|'
    r'Resolu[çc][aã]o\b|Provimento\b|S[uú]mula\b|\d)'
    r'|Jurisprud[eê]ncia(?:\s+aplicada)?\s+'
    r'(?:STF\b|STJ\b|TJ[A-Z]{2}\b|Superior\b|Federal\b|S[úu]mula\b|Tema\b)'
)

# ── Área do direito ────────────────────────────────────────────────────────────

_AREA_MAP: list[tuple[str, re.Pattern]] = [
    ("CRIMINAL", re.compile(
        r"penal|criminal|crime\b|homic[íi]dio|roubo|latrocínio|peculato|"
        r"femini|lesão corporal|associação criminosa|habeas.corpus|"
        r"embriaguez|corrupção ativa|tráfico|estelionato|furto|"
        r"Câmara Criminal|Crimes de Trânsito|Crimes Previstos|Estatuto do Idoso",
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
    if "público" in o or "publico" in o:
        return "PÚBLICO"
    if "privado" in o:
        return "PRIVADO"
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
    text = re.sub(r"(\w)- (\w)", r"\1\2", text)
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
    m = None
    tipo  = "Processo"
    orgao = ""

    for pat, fmt in [(_DETAIL_V3, "v3"), (_DETAIL_V2, "v2"),
                     (_DETAIL_V1, "v1"), (_DETAIL_V0, "v0")]:
        m = pat.search(chunk)
        if m:
            if fmt == "v0":
                tipo = re.sub(r'\s+', ' ', m.group("label")).strip().title()
            elif fmt == "v1":
                tipo = re.sub(r'\s+', ' ', m.group("tipo")).strip().title()
            break

    if not m:
        return None

    processo = m.group("processo")
    relator  = re.sub(r'\s+', ' ', m.group("relator")).strip().title()
    if "orgao" in m.groupdict() and m.group("orgao"):
        orgao = re.sub(r'\s+', ' ', m.group("orgao")).strip()
    data = _parse_date(m.group("data"))

    # Ramo do direito (para classificação de área)
    area_m = re.search(
        r'(?:Ramo|[Áa]rea)\s+do\s+direito\s+(.+?)(?=\bAssunto\b|\bSub[aá]rea\b|\bDestaque\b|$)',
        chunk, re.IGNORECASE | re.DOTALL,
    )
    ramo = area_m.group(1).strip()[:200] if area_m else ""

    # Destaque (resumo) + Inteiro Teor (texto completo)
    dest_m = re.search(
        r'\bDestaque\s+(.+?)(?=\bInforma[çc][aã]o\s+de\s+inteiro\s+teor\b|' + _METASEC + r'|\Z)',
        chunk, re.IGNORECASE | re.DOTALL,
    )
    destaque = dest_m.group(1).strip() if dest_m else ""

    inteiro_m = re.search(
        r'\bInforma[çc][aã]o\s+de\s+inteiro\s+teor\s+(.+?)(?=' + _METASEC + r'|\Z)',
        chunk, re.IGNORECASE | re.DOTALL,
    )
    inteiro = inteiro_m.group(1).strip() if inteiro_m else ""

    if destaque and inteiro:
        ementa = destaque + " " + inteiro
    elif destaque:
        ementa = destaque
    elif inteiro:
        ementa = inteiro
    else:
        ementa = chunk[m.end():].strip()

    area  = _classify_area(ramo + " " + destaque[:200])
    secao = _classify_secao(orgao)

    return {
        "_id":            f"tjce-{processo}",
        "tribunal":       "TJCE",
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
    ap = argparse.ArgumentParser(description="Ingestão TJCE informativos → Elasticsearch")
    ap.add_argument("--folder",  default=str(PDF_FOLDER))
    ap.add_argument("--batch",   type=int, default=50)
    ap.add_argument("--es-url",  default=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"))
    ap.add_argument("--reset",   action="store_true", help="Remove checkpoint e recomeça")
    ap.add_argument("--dry-run", action="store_true", help="Extrai mas não indexa")
    args = ap.parse_args()

    folder = Path(args.folder)
    if not folder.exists():
        sys.exit(f"Pasta não encontrada: {folder}")

    pdfs = sorted(folder.glob("informativo_*.pdf"))
    if not pdfs:
        sys.exit(f"Nenhum PDF informativo_*.pdf em: {folder}")

    if args.reset and CHECKPOINT.exists():
        CHECKPOINT.unlink()
        log.info("Checkpoint removido")

    done = load_checkpoint()
    es   = None if args.dry_run else Elasticsearch(args.es_url)

    counters = {"pdfs": 0, "decisions": 0, "indexed": 0,
                "es_errors": 0, "skipped": 0, "failed": 0}
    buffer: list[dict] = []

    log.info("=" * 60)
    log.info(f"TJCE -> ES  |  {len(pdfs)} PDFs  |  já feitos: {len(done)}")
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

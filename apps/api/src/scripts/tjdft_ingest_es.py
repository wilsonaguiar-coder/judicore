#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestão dos Informativos de Jurisprudência do TJDFT no Elasticsearch.

Fonte: edicao_*.pdf  (2020–2025, semestral + retrospectiva)
  - Citação no FIM de cada chunk (Acórdão N, processo, Relator, órgão, data)
  - Dois formatos de número: CNJ (NNNNNNN-DD.AAAA.J.TT.OOOO) e 20 dígitos legado
  - Primeira decisão de alguns arquivos filtrada por poluição de sumário/expediente

Uso:
    python tjdft_ingest_es.py
    python tjdft_ingest_es.py --dry-run
    python tjdft_ingest_es.py --reset
    python tjdft_ingest_es.py --es-url http://localhost:9200
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
PDF_FOLDER   = PROJECT_ROOT / "temp" / "boletins" / "tjdft"
CHECKPOINT   = SCRIPT_DIR / "tjdft_ingest_checkpoint.json"
LOG_FILE     = SCRIPT_DIR / "tjdft_ingest_es.log"
ES_INDEX     = "jurisprudencia"

# ── Regexes ───────────────────────────────────────────────────────────────────

_PROC_RE = r'(?:\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}|\d{20})'

CITATION_RE = re.compile(
    r'Ac[oó]rd[aã]o\s+\d+,\s+'
    + _PROC_RE +
    r',\s+'
    r'Relator(?:a)?(?:\([aA]\))?\s*:?\s*(?:Ju[ií]z[ao]?\s+)?(?:Des[.ªa]*\s+)?'
    r'[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÜ][^,]+,'
    r'[^,]+,'
    r'\s*data\s+de\s+julgamento:\s*\d{1,2}[º°]?/\d{1,2}/\d{4},'
    r'\s*publicado\s+no\s+(?:DJe|PJe):\s*\d{1,2}[º°]?/\d{1,2}/\d{4}\.?'
    r'(?:\s*\(?[Ii]nformativo\s+\d+\)?)?',
    re.IGNORECASE,
)

DETAIL_RE = re.compile(
    r'Ac[oó]rd[aã]o\s+(?P<acordao>\d+),\s+'
    r'(?P<processo>' + _PROC_RE + r'),\s+'
    r'Relator(?:a)?(?:\([aA]\))?\s*:?\s*(?:Ju[ií]z[ao]?\s+)?(?:Des[.ªa]*\s+)?'
    r'(?P<relator>[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÜ][^,]+),'
    r'\s*(?P<orgao>[^,]+),'
    r'\s*data\s+de\s+julgamento:\s*'
    r'(?P<data>\d{1,2}[º°]?/\d{1,2}/\d{4}),'
    r'\s*publicado\s+no\s+(?:DJe|PJe):\s*\d{1,2}[º°]?/\d{1,2}/\d{4}\.?'
    r'(?:\s*\(?[Ii]nformativo\s+(?P<informativo>\d+)\)?)?',
    re.IGNORECASE,
)

# Padrões de cabeçalho de página para remoção no flatten
_HEADER_RES = [
    re.compile(r'Informativo\s+de\s+Jurisprud[eê]ncia\s*[:|–\|].{5,150}\s\d{1,2}(?=\s)', re.IGNORECASE),
    re.compile(
        r'Informativo\s+de\s+Jurisprud[eê]ncia\s+do\s+TJDFT\s+'
        r'Edi[çc][aã]o\s+especial\s*[–-]\s*\S{1,10}\s+semestre\s+de\s+20\d{2}\s*\d*\s*',
        re.IGNORECASE,
    ),
    re.compile(r'\d+[ª°]\s+Edi[çc][aã]o\s+especial\s*[–-].{5,80}\s\d{1,2}(?=\s)', re.IGNORECASE),
    re.compile(r'Edi[çc][aã]o\s+[Ee]special\s*[-–]\s*Retrospectiva\s+20\d{2}\s*\d{1,2}(?=\s)', re.IGNORECASE),
    re.compile(
        r'(?:Tribunal\s+de\s+Justi[çc]a\s+do\s+Distrito\s+Federal|'
        r'Edi[çc][aã]o\s+[Ee]special\s*[-–]|'
        r'\d+[ª°]\s+Edi[çc][aã]o\s+especial)'
        r'.{50,10000}?'
        r'n[aã]o\s+constitu[ei]m\b.{5,200}?'
        r'reposit[oó]rio\s+oficial\s+da\s+jurisprud[eê]ncia\s+\S{2,10}\s+[Tt]ribunal\.?\s*',
        re.IGNORECASE,
    ),
    re.compile(r'\.{4,}\s*\d{1,3}\s*'),
    re.compile(r'\d+\s*-\s*[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÜ][A-Za-záéíóúàâêôãõçÀ-ÿ\s]+\(Inf\.\s*\d+\)'),
]

# ── Área do direito ────────────────────────────────────────────────────────────

_AREA_MAP: list[tuple[str, re.Pattern]] = [
    ("CRIMINAL", re.compile(
        r"penal|criminal|crime\b|homic[íi]dio|roubo|latrocínio|peculato|"
        r"femini|lesão corporal|associação criminosa|habeas.corpus|"
        r"embriaguez|corrupção ativa|tráfico|estelionato|furto",
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
        r"gratifica[çc][aã]o|precatório|mandado de segurança",
        re.IGNORECASE,
    )),
    ("CONSTITUCIONAL", re.compile(
        r"adin\b|adpf\b|adc\b|ação direta de inconstitucionalidade|"
        r"inconstitucionalidade\s+(?:formal|material)|controle de constitucionalidade",
        re.IGNORECASE,
    )),
    ("CONSUMIDOR", re.compile(
        r"consumidor|energia el[eé]trica|fatura|plano de saúde|negativação",
        re.IGNORECASE,
    )),
    ("FAMILIA", re.compile(
        r"fam[íi]lia|uni[aã]o est[aá]vel|div[oó]rcio|alimentos|"
        r"guarda\s+(?:de\s+)?(?:filho|criança|menor|compartilhad)|paternidade|adoção",
        re.IGNORECASE,
    )),
    ("CIVIL", re.compile(
        r"\bcivil\b|indeniza[çc][aã]o|responsabilidade|contrato|"
        r"poss[ea]|usucapi|loca[çc][aã]o|obriga[çc][aã]o|despejo|seguro\b",
        re.IGNORECASE,
    )),
]


def _classify_area(text: str) -> str:
    for area, pat in _AREA_MAP:
        if pat.search(text):
            return area
    return "OUTRO"


_SECAO_RE = re.compile(
    r'^(Direito\s+(?:Administrativo|Civil(?:\s+e\s+Processual\s+Civil)?|'
    r'Constitucional|da\s+Crian[çc]a\s+e\s+do\s+Adolescente|'
    r'do\s+Consumidor|Empresarial|Penal(?:\s+e\s+Processual\s+Penal)?|'
    r'Penal\s+Militar|Previd[eê]nci[aá]rio|Tribut[aá]rio))\s+',
    re.IGNORECASE,
)

_SECAO_COUNT_RE = re.compile(
    r'Direito\s+(?:Administrativo|Civil|Constitucional|da\s+Crian[çc]a|'
    r'do\s+Consumidor|Empresarial|Penal|Previd[eê]nci[aá]rio|Tribut[aá]rio)',
    re.IGNORECASE,
)


def _classify_area_secao(heading: str) -> str:
    h = heading.lower()
    if "penal" in h or "criminal" in h or "militar" in h:
        return "CRIMINAL"
    if "tribut" in h:
        return "TRIBUTARIO"
    if "administrativo" in h or "previdenci" in h:
        return "ADMINISTRATIVO"
    if "constitucional" in h:
        return "CONSTITUCIONAL"
    if "consumidor" in h:
        return "CONSUMIDOR"
    if "criança" in h or "adolescente" in h or "famíl" in h or "famil" in h:
        return "FAMILIA"
    if "civil" in h or "empresarial" in h:
        return "CIVIL"
    return "ESTADUAL"


# ── Extração e normalização ────────────────────────────────────────────────────

def _normalize_processo(proc: str) -> str:
    proc = proc.strip()
    if re.match(r'^\d{20}$', proc):
        return f"{proc[:7]}-{proc[7:9]}.{proc[9:13]}.{proc[13]}.{proc[14:16]}.{proc[16:20]}"
    return proc


def _parse_date(raw: str) -> Optional[str]:
    raw = raw.strip()
    m = re.search(r"(\d{1,2})[º°]?/(\d{1,2})/(20\d{2})", raw)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    m = re.search(r"(20\d{2})", raw)
    return f"{m.group(1)}-01-01" if m else None


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
    for hre in _HEADER_RES:
        text = hre.sub(" ", text)
    text = re.sub(r" {2,}", " ", text)
    text = re.sub(r" \.", ".", text)
    return text.strip()


def _split_decisions(text: str) -> list[str]:
    """Citação no FIM de cada chunk (padrão TJDFT)."""
    decisions: list[str] = []
    seen: set[str] = set()
    pos = 0
    for m in CITATION_RE.finditer(text):
        end = m.end()
        chunk = text[pos:end].strip()
        key = m.group().strip()[:120]
        if len(chunk) > 150 and key not in seen:
            decisions.append(chunk)
            seen.add(key)
        pos = end
    return decisions


def _ementa_is_polluted(text: str) -> bool:
    if re.search(r'NUPIJUR|CODJU', text, re.IGNORECASE):
        return True
    if len(_SECAO_COUNT_RE.findall(text)) >= 4:
        return True
    return False


def _parse_decision(chunk: str, filename: str) -> Optional[dict]:
    m = DETAIL_RE.search(chunk)
    if not m:
        return None

    processo = _normalize_processo(m.group("processo"))
    relator_raw = re.sub(r'\s+', ' ', m.group("relator")).strip()
    relator_raw = re.sub(
        r'^(?:Designado\s*:?\s*)?(?:Ju[ií]z[ao]?\s+|Des(?:embargador[ao]?)?\s*[.ª]*\s+)',
        '', relator_raw, flags=re.IGNORECASE,
    ).strip()
    relator = relator_raw.title()
    orgao   = re.sub(r'\s+', ' ', m.group("orgao")).strip()
    data    = _parse_date(m.group("data"))

    ementa_raw = chunk[:m.start()].strip()

    if _ementa_is_polluted(ementa_raw):
        return None

    ementa_raw = re.sub(r'\bSumário\b\s*', ' ', ementa_raw, flags=re.IGNORECASE)
    ementa_raw = re.sub(r'\bÍndice\b\s*', ' ', ementa_raw, flags=re.IGNORECASE)
    ementa_raw = re.sub(r'[•·]\s*', ' ', ementa_raw)
    ementa_raw = re.sub(r' {2,}', ' ', ementa_raw).strip()

    sec_m   = _SECAO_RE.match(ementa_raw)
    section = sec_m.group(1).strip() if sec_m else ""
    if sec_m:
        ementa_raw = ementa_raw[sec_m.end():].strip()

    area = _classify_area_secao(section) if section else _classify_area(ementa_raw[:300])

    return {
        "_id":            f"tjdft-{processo}",
        "tribunal":       "TJDFT",
        "tipo":           "Acórdão",
        "numero":         processo,
        "relator":        relator,
        "orgaoJulgador":  orgao,
        "dataJulgamento": data,
        "area":           area,
        "secao":          section or orgao[:40],
        "fonte":          Path(filename).name,
        "ementa":         ementa_raw,
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
    ap = argparse.ArgumentParser(description="Ingestão TJDFT informativos → Elasticsearch")
    ap.add_argument("--folder",  default=str(PDF_FOLDER))
    ap.add_argument("--batch",   type=int, default=50)
    ap.add_argument("--es-url",  default=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"))
    ap.add_argument("--reset",   action="store_true", help="Remove checkpoint e recomeça")
    ap.add_argument("--dry-run", action="store_true", help="Extrai mas não indexa")
    args = ap.parse_args()

    folder = Path(args.folder)
    if not folder.exists():
        sys.exit(f"Pasta não encontrada: {folder}")

    pdfs = sorted(folder.glob("edicao_*.pdf"))
    if not pdfs:
        sys.exit(f"Nenhum PDF edicao_*.pdf em: {folder}")

    if args.reset and CHECKPOINT.exists():
        CHECKPOINT.unlink()
        log.info("Checkpoint removido")

    done = load_checkpoint()
    es   = None if args.dry_run else Elasticsearch(args.es_url)

    counters = {"pdfs": 0, "decisions": 0, "indexed": 0,
                "es_errors": 0, "skipped": 0, "failed": 0}
    buffer: list[dict] = []

    log.info("=" * 60)
    log.info(f"TJDFT -> ES  |  {len(pdfs)} PDFs  |  já feitos: {len(done)}")
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

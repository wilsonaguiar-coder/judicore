#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestão dos Boletins de Informação Jurisprudencial (BIJ) do TRF6 no Elasticsearch.

Formato dos PDFs: BIJ nNN (ex: BIJ1.pdf … BIJ-23-janeiro2025.pdf)
Cada decisão termina com:
  (TRF6, TIPO n. PROCESSO, Rel. NOME, ORGAO, julgado/publicado em DD/MM/AAAA)

Obs: processos podem ter código 4.01 (casos herdados do TRF1) ou 4.06 (TRF6 nativo).

Uso:
    python trf6_ingest_es.py [--folder e:/judicore/temp/trf6]
    python trf6_ingest_es.py --dry-run
    python trf6_ingest_es.py --reset
    python trf6_ingest_es.py --es-url http://localhost:9200
"""

import argparse
import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import Optional

import fitz  # pymupdf
from elasticsearch import Elasticsearch, helpers

# ── Configuração ──────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
DEFAULT_FOLDER = PROJECT_ROOT / "temp" / "trf6"
CHECKPOINT_FILE = SCRIPT_DIR / "trf6_ingest_checkpoint.json"
LOG_FILE = SCRIPT_DIR / "trf6_ingest_es.log"
ES_INDEX = "jurisprudencia"

# ── Regexes ───────────────────────────────────────────────────────────────────

# Citação ao final de cada decisão:
# (TRF6, CCCiv n. 1016345-87.2022.4.01.0000, Rel. Desembargador Federal NOME, 1ª Seção, julgado em 17/11/22)
# Variações: tipo com ponto (IRDR.), processo com sufixo /MG, relator com quebra de linha,
# múltiplos espaços (PDFs recentes), typo "julgao" em edições antigas.
CITATION_RE = re.compile(
    r"\(TRF6,\s+"
    r"(?P<tipo>[A-ZÁÀÃÂÉÊÍÓÔÕÚÇa-záàãâéêíóôõúç./° ]+?)\s+"
    r"n[.°º]?\s*"
    r"(?P<processo>\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})(?:/[A-Z]{0,3})?,?\s*"
    r"Rel\.\s*(?P<relator>[^,]+),\s*"
    r"(?P<orgao>[^,\)]+),\s*"
    r"(?:julga(?:d[ao]|o)|publicad[ao])\s+em\s+"
    r"(?P<data>[\d/]+)",
    re.IGNORECASE,
)

# Área explícita em "Assuntos:" (formato antigo) ou cabeçalho de seção (formato novo)
ASSUNTO_RE = re.compile(
    r"(?:Assuntos?:\s*|^)DIREITO\s+"
    r"(?P<area>ADMINISTRATIVO|AMBIENTAL|CIVIL|CONSTITUCIONAL|PENAL|"
    r"PREVIDENCI[ÁA]RIO|PROCESSUAL(?:\s+(?:CIVIL|PENAL))?|TRIBUT[ÁA]RIO|"
    r"DO\s+CONSUMIDOR|TRABALHISTA)",
    re.IGNORECASE | re.MULTILINE,
)

SECTION_AREA_RE = re.compile(
    r"^[ \t]*(?P<area>Previdenci[aá]rio|Administrativo|Tribut[aá]rio|Penal|Civil|"
    r"Ambiental|Constitucional|Processual|Trabalhista)\s*$",
    re.IGNORECASE | re.MULTILINE,
)

SECTION_AREA_MAP = {
    "PREVIDENCIARIO": "PREVIDENCIARIO",
    "PREVIDENCIÁRIO": "PREVIDENCIARIO",
    "ADMINISTRATIVO": "ADMINISTRATIVO",
    "TRIBUTARIO": "TRIBUTARIO",
    "TRIBUTÁRIO": "TRIBUTARIO",
    "PENAL": "CRIMINAL",
    "CIVIL": "CIVIL",
    "AMBIENTAL": "AMBIENTAL",
    "CONSTITUCIONAL": "ADMINISTRATIVO",
    "PROCESSUAL": "OUTRO",
    "TRABALHISTA": "OUTRO",
    "CONSUMIDOR": "CIVIL",
}

AREA_RULES: list[tuple[str, re.Pattern]] = [
    ("PREVIDENCIARIO", re.compile(
        r"previd[eê]nci|aposen(?:tad|tor)|inss\b|pens[aã]o\s+por\s+morte|"
        r"aux[íi]lio[- ]doen|invalidez\b|segurado\b|sal[aá]rio[- ]matern|RGPS",
        re.IGNORECASE,
    )),
    ("TRIBUTARIO", re.compile(
        r"tribut[aá]r[io]|imposto\b|icms\b|iss\b|ipi\b|pis\b|cofins\b|"
        r"execu[çc][aã]o\s+fiscal|cr[eé]dito\s+tribut|contribui[çc][aã]o\s+(?:social|previd)",
        re.IGNORECASE,
    )),
    ("ADMINISTRATIVO", re.compile(
        r"servidor\s+p[úu]blico|concurso\s+p[úu]blico|licita[çc][aã]o\b|"
        r"improbidade\b|ato\s+administrativo|cargo\s+p[úu]blico|desapropria[çc][aã]o\b",
        re.IGNORECASE,
    )),
    ("CRIMINAL", re.compile(
        r"\bcrime\b|\bpenal\b|\bpena\s|\br[eé]u\b|den[úu]ncia\b|habeas.corpus|"
        r"contrabando\b|estelionato\b|homic[íi]dio\b|tr[aá]fico\b|corrup[çc][aã]o\b",
        re.IGNORECASE,
    )),
    ("AMBIENTAL", re.compile(
        r"ambiental\b|meio\s+ambiente|ibama\b|[aá]rea\s+de\s+preserva[çc][aã]o",
        re.IGNORECASE,
    )),
    ("CIVIL", re.compile(
        r"responsabilidade\s+civil|indeniza[çc][aã]o\s|usucapi[aã]o\b|loca[çc][aã]o\b",
        re.IGNORECASE,
    )),
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_date(raw: str) -> Optional[str]:
    """Converte DD/MM/YY ou DD/MM/YYYY para YYYY-MM-DD."""
    m = re.search(r"(\d{2})/(\d{2})/(\d{2,4})", raw)
    if m:
        d, mo, y = m.groups()
        y_full = f"20{y}" if len(y) == 2 and int(y) < 50 else (f"19{y}" if len(y) == 2 else y)
        return f"{y_full}-{mo}-{d}"
    return None


def clean_relator(raw: str) -> str:
    s = re.sub(r"\s+", " ", raw.replace("\n", " ")).strip()
    return re.sub(
        r"^(?:Des(?:embargador[a]?)?\.?\s+Federal|Ju[íi]z[a]?\s+Federal(?:\s+[Cc]onvocad[oa])?)\s+",
        "",
        s,
        flags=re.IGNORECASE,
    ).strip()


def classify_area(block: str) -> str:
    # 1. Procura "Assuntos: DIREITO XXX" explícito
    m = ASSUNTO_RE.search(block)
    if m:
        key = m.group("area").upper().replace("Á", "A").replace("Ã", "A").replace("É", "E")
        return SECTION_AREA_MAP.get(key, "OUTRO")
    # 2. Procura cabeçalho de seção standalone (formato novo dos BIJs)
    m2 = SECTION_AREA_RE.search(block[:400])
    if m2:
        key = m2.group("area").upper().replace("Á", "A").replace("Ã", "A").replace("É", "E")
        return SECTION_AREA_MAP.get(key, "OUTRO")
    # 3. Fallback por palavras-chave
    for area, pattern in AREA_RULES:
        if pattern.search(block):
            return area
    return "OUTRO"


def clean_block(text: str) -> str:
    text = re.sub(r"P[áa]gina\s+\d+\s*\n?", "", text, flags=re.IGNORECASE)
    text = re.sub(r"(?m)^\s*\d{1,3}\s*$", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def pdf_to_text(path: str) -> str:
    doc = fitz.open(path)
    pages = [doc[i].get_text() for i in range(doc.page_count)]
    doc.close()
    return "\n".join(pages)


# ── Parsing principal ─────────────────────────────────────────────────────────

def extract_decisions(text: str, filename: str) -> list[dict]:
    citations = list(CITATION_RE.finditer(text))

    if not citations:
        log.warning(f"  Nenhuma citacao encontrada em {filename}")
        return []

    decisions = []
    prev_end = 0

    for match in citations:
        block_text = text[prev_end:match.start()]
        citation_text = match.group(0)
        body = clean_block(block_text)

        if len(body.strip()) < 40:
            prev_end = match.end()
            continue

        processo = match.group("processo")
        relator = clean_relator(match.group("relator"))
        orgao = re.sub(r"\s+", " ", match.group("orgao").replace("\n", " ")).strip()
        data = parse_date(match.group("data"))

        ementa = body[:600].strip()
        conteudo = (body + "\n" + citation_text)[:80_000]

        doc = {
            "_id": f"trf6-{processo}",
            "tribunal": "TRF6",
            "numero": processo,
            "ementa": ementa,
            "relator": relator,
            "dataJulgamento": data,
            "area": classify_area(body),
            "orgaoJulgador": orgao,
            "url": "https://www.trf6.jus.br/trf6/jurisprudencia/jurisprudencia",
            "conteudoIntegral": conteudo,
        }
        decisions.append(doc)
        prev_end = match.end()

    log.info(f"  {len(decisions)} decisoes extraidas de {filename}")
    return decisions


# ── Checkpoint ────────────────────────────────────────────────────────────────

def load_checkpoint() -> set[str]:
    if CHECKPOINT_FILE.exists():
        try:
            return set(json.loads(CHECKPOINT_FILE.read_text(encoding="utf-8")))
        except Exception:
            pass
    return set()


def save_checkpoint(done: set[str]) -> None:
    CHECKPOINT_FILE.write_text(json.dumps(sorted(done), ensure_ascii=False, indent=2), encoding="utf-8")


# ── ES bulk insert ────────────────────────────────────────────────────────────

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
    parser = argparse.ArgumentParser(description="Ingestao TRF6 BIJs -> Elasticsearch")
    parser.add_argument("--folder", default=str(DEFAULT_FOLDER))
    parser.add_argument("--batch", type=int, default=50)
    parser.add_argument("--es-url", default=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"))
    parser.add_argument("--reset", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    folder = Path(args.folder)
    if not folder.exists():
        sys.exit(f"Pasta nao encontrada: {folder}")

    pdfs = sorted(folder.glob("*.pdf"))
    if not pdfs:
        sys.exit(f"Nenhum PDF em: {folder}")

    if args.reset and CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        log.info("Checkpoint removido")

    done = load_checkpoint()
    es = None if args.dry_run else Elasticsearch(args.es_url)

    counters = {"pdfs": 0, "decisions": 0, "indexed": 0, "es_errors": 0, "skipped": 0, "failed": 0}
    buffer: list[dict] = []

    log.info("=" * 60)
    log.info(f"TRF6 -> ES  |  {len(pdfs)} PDFs  |  ja feitos: {len(done)}")
    log.info(f"Pasta: {folder}")
    if args.dry_run:
        log.info("DRY-RUN: nao indexa no ES")
    else:
        log.info(f"ES: {args.es_url}  indice: {ES_INDEX}")
    log.info("=" * 60)

    for pdf_path in pdfs:
        fname = pdf_path.name

        if fname in done:
            counters["skipped"] += 1
            continue

        try:
            log.info(f"PDF {fname}")
            text = pdf_to_text(str(pdf_path))
            decisions = extract_decisions(text, fname)
            counters["decisions"] += len(decisions)

            if args.dry_run:
                for d in decisions[:2]:
                    log.info(f"  [dry-run] {d['numero']} | {d['relator']} | {d['dataJulgamento']} | {d['area']}")
                    log.info(f"            orgao: {d['orgaoJulgador']}")
            else:
                buffer.extend(decisions)
                if len(buffer) >= args.batch:
                    bulk_insert(es, buffer, counters)
                    buffer.clear()

            done.add(fname)
            save_checkpoint(done)
            counters["pdfs"] += 1

        except Exception as e:
            log.error(f"{fname}: {e}")
            counters["failed"] += 1

    if not args.dry_run and buffer:
        bulk_insert(es, buffer, counters)

    log.info("=" * 60)
    log.info(f"Concluido: {counters['pdfs']} PDFs | {counters['decisions']} decisoes")
    log.info(f"  Indexados  : {counters['indexed']}")
    log.info(f"  Pulados    : {counters['skipped']}")
    log.info(f"  Falhas PDF : {counters['failed']}")
    log.info(f"  Erros ES   : {counters['es_errors']}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()

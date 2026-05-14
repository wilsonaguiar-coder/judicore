#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestão dos Boletins Jurídicos EMAGIS do TRF4 no Elasticsearch.

Formato dos PDFs: Boletim Jurídico EMAGIS, ex: bol200.pdf … bol270.pdf
Cada decisão termina com:
  (TRF4, TIPO [Nº] PROCESSO, TURMA, RELATOR, [POR UNANIMIDADE/MAIORIA,] JUNTADO AOS AUTOS EM DD.MM.YYYY)

Uso:
    python trf4_ingest_es.py [--folder e:/judicore/temp/trf4]
    python trf4_ingest_es.py --dry-run
    python trf4_ingest_es.py --reset
    python trf4_ingest_es.py --es-url http://localhost:9200
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
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent  # e:/judicore
DEFAULT_FOLDER = PROJECT_ROOT / "temp" / "trf4"
CHECKPOINT_FILE = SCRIPT_DIR / "trf4_ingest_checkpoint.json"
LOG_FILE = SCRIPT_DIR / "trf4_ingest_es.log"
ES_INDEX = "jurisprudencia"

# ── Regexes ───────────────────────────────────────────────────────────────────

# Citação ao final de cada decisão:
# (TRF4, AC 5001234-56.2020.4.04.7100, TERCEIRA TURMA, DESEMBARGADOR FEDERAL FULANO, POR UNANIMIDADE, JUNTADO AOS AUTOS EM 15.03.2023)
CITATION_RE = re.compile(
    r"\(TRF4,\s+"
    r"(?P<tipo>[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][A-ZÁÀÃÂÉÊÍÓÔÕÚÇa-záàãâéêíóôõúç /]+?)\s+"
    r"(?:Nº\s+)?"
    r"(?P<processo>\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}),\s+"
    r"(?P<turma>[^,\n]+),\s+"
    r"(?P<relator>[^,\n]+),\s+"
    r"(?:POR\s+[^,\n]+,\s+)?"
    r"JUNTADO\s+AOS\s+AUTOS\s+EM\s+"
    r"(?P<data>\d{2}\.\d{2}\.\d{4})",
    re.IGNORECASE,
)

# Cabeçalhos de seção (área do direito)
SECTION_RE = re.compile(
    r"^[ \t]*(DIREITO\s+(?:ADMINISTRATIVO|PREVIDENCI[ÁA]RIO|TRIBUT[ÁA]RIO|PENAL|PROCESSUAL(?:\s+CIVIL|\s+PENAL)?|"
    r"CIVIL|AMBIENTAL|CONSTITUCIONAL|ELEITORAL|INTERNACIONAL|DO\s+CONSUMIDOR|URBAN[ÍI]STICO)|"
    r"PROCESSO\s+PENAL|DIREITO\s+DO\s+TRABALHO)\s*$",
    re.MULTILINE | re.IGNORECASE,
)

# Número de edição: bol200.pdf → 200
EDITION_RE = re.compile(r"bol(\d+)", re.IGNORECASE)

# ── Classificação de área ──────────────────────────────────────────────────────

AREA_RULES: list[tuple[str, re.Pattern]] = [
    ("PREVIDENCIARIO", re.compile(
        r"previd[eê]nci|aposen(?:tad|tor)|inss\b|pens[aã]o\s+por\s+morte|"
        r"aux[íi]lio[- ]doen|invalidez\b|segurado\b|sal[aá]rio[- ]matern|RGPS|"
        r"benef[íi]cio\s+previd",
        re.IGNORECASE,
    )),
    ("TRIBUTARIO", re.compile(
        r"tribut[aá]r[io]|imposto\b|icms\b|iss\b|ipi\b|pis\b|cofins\b|"
        r"execu[çc][aã]o\s+fiscal|cr[eé]dito\s+tribut|contribui[çc][aã]o\s+(?:social|previd)|"
        r"\birrf?\b|\birpj\b|\bcsll\b",
        re.IGNORECASE,
    )),
    ("ADMINISTRATIVO", re.compile(
        r"servidor\s+p[úu]blico|concurso\s+p[úu]blico|licita[çc][aã]o\b|"
        r"improbidade\b|ato\s+administrativo|cargo\s+p[úu]blico|fun[çc][aã]o\s+p[úu]blica|"
        r"desapropria[çc][aã]o\b|anatel\b|anvisa\b",
        re.IGNORECASE,
    )),
    ("CRIMINAL", re.compile(
        r"\bcrime\b|\bpenal\b|\bpena\s|\br[eé]u\b|den[úu]ncia\b|habeas.corpus|"
        r"contrabando\b|estelionato\b|homic[íi]dio\b|tr[aá]fico\b|corrup[çc][aã]o\b|"
        r"furto\b|roubo\b|lavagem\s+de\s+dinheiro|descaminho\b",
        re.IGNORECASE,
    )),
    ("AMBIENTAL", re.compile(
        r"ambiental\b|meio\s+ambiente|licen[çc]a\s+ambiental|desmatamento\b|"
        r"ibama\b|[aá]rea\s+de\s+preserva[çc][aã]o",
        re.IGNORECASE,
    )),
    ("CIVIL", re.compile(
        r"responsabilidade\s+civil|indeniza[çc][aã]o\s|usucapi[aã]o\b|"
        r"loca[çc][aã]o\b|propriedade\s|poss(?:e|eiro)\b|valores\s+mobili[aá]rios",
        re.IGNORECASE,
    )),
]

# Mapeamento de cabeçalho de seção → área canônica
SECTION_AREA_MAP = {
    "PREVIDENCIARIO": "PREVIDENCIARIO",
    "TRIBUTARIO": "TRIBUTARIO",
    "ADMINISTRATIVO": "ADMINISTRATIVO",
    "PENAL": "CRIMINAL",
    "PROCESSUAL": "OUTRO",
    "CIVIL": "CIVIL",
    "AMBIENTAL": "AMBIENTAL",
    "CONSTITUCIONAL": "ADMINISTRATIVO",
    "CONSUMIDOR": "CIVIL",
    "TRABALHO": "OUTRO",
    "ELEITORAL": "OUTRO",
    "INTERNACIONAL": "OUTRO",
    "URBANISTICO": "ADMINISTRATIVO",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_date(raw: str) -> Optional[str]:
    raw = raw.replace("\n", " ").strip()
    # DD.MM.YYYY (formato TRF4)
    m = re.search(r"(\d{2})\.(\d{2})\.(\d{4})", raw)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{mo}-{d}"
    # DD/MM/YYYY (fallback)
    dates = re.findall(r"(\d{2})/(\d{2})/(\d{4})", raw)
    if dates:
        d, mo, y = dates[-1]
        return f"{y}-{mo}-{d}"
    m2 = re.search(r"\b(20\d{2})\b", raw)
    if m2:
        return f"{m2.group(1)}-01-01"
    return None


def clean_relator(raw: str) -> str:
    """Remove 'DESEMBARGADOR(A) FEDERAL' e outros títulos do nome do relator."""
    return re.sub(
        r"^(?:DESEMBARGADORA?\s+FEDERAL|JU[ÍI]Z[A]?\s+FEDERAL(?:\s+CONVOCAD[OA])?)\s+",
        "",
        raw.strip(),
        flags=re.IGNORECASE,
    ).strip()


def section_to_area(section_text: str) -> str:
    upper = section_text.upper()
    for key, area in SECTION_AREA_MAP.items():
        if key in upper:
            return area
    return "OUTRO"


def classify_area(text: str, current_section: str = "") -> str:
    if current_section:
        return section_to_area(current_section)
    for area, pattern in AREA_RULES:
        if pattern.search(text):
            return area
    return "OUTRO"


def clean_block(text: str) -> str:
    """Remove cabeçalhos de página e ruídos do bloco de decisão."""
    # Remove cabeçalho padrão TRF4: "Boletim Jurídico\nNúmero XXX"
    text = re.sub(r"Boletim\s+Jur[íi]dico[^\n]*\n[^\n]*\n?", "", text, flags=re.IGNORECASE)
    # Remove números de página soltos
    text = re.sub(r"(?m)^\s*\d{1,3}\s*$", "", text)
    # Colapsa múltiplos newlines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def pdf_to_text(path: str) -> str:
    doc = fitz.open(path)
    pages = [page.get_text() for page in doc]
    doc.close()
    return "\n".join(pages)


def extract_edition(filename: str) -> Optional[str]:
    m = EDITION_RE.search(filename)
    return m.group(1) if m else None


# ── Parsing principal ─────────────────────────────────────────────────────────

def extract_decisions(text: str, filename: str) -> list[dict]:
    """
    Divide o texto do Boletim EMAGIS TRF4 em decisões individuais.

    Cada decisão termina com a citação:
    (TRF4, TIPO PROCESSO, TURMA, RELATOR, [POR UNANIMIDADE,] JUNTADO AOS AUTOS EM DD.MM.YYYY)
    """
    edition = extract_edition(filename)
    citations = list(CITATION_RE.finditer(text))

    if not citations:
        log.warning(f"  Nenhuma citação encontrada em {filename}")
        return []

    decisions = []
    prev_end = 0
    current_section = ""

    for match in citations:
        block_text = text[prev_end:match.start()]
        citation_text = match.group(0)

        # Atualiza seção de área caso haja cabeçalho no bloco atual
        section_matches = list(SECTION_RE.finditer(block_text))
        if section_matches:
            current_section = section_matches[-1].group(1).strip()
            # Texto da decisão começa após o último cabeçalho de seção
            decision_body = block_text[section_matches[-1].end():].strip()
        else:
            decision_body = block_text

        body = clean_block(decision_body)

        # Ignora blocos muito curtos (ruído entre páginas)
        if len(body.strip()) < 60:
            prev_end = match.end()
            continue

        processo = match.group("processo")
        tipo = match.group("tipo").strip()
        turma = match.group("turma").strip()
        relator = clean_relator(match.group("relator").strip())
        data = parse_date(match.group("data"))

        ementa = body[:600].strip()
        conteudo = (body + "\n" + citation_text)[:80_000]

        doc = {
            "_id": f"trf4-{processo}",
            "tribunal": "TRF4",
            "numero": processo,
            "ementa": ementa,
            "relator": relator,
            "dataJulgamento": data,
            "area": classify_area(body, current_section),
            "orgaoJulgador": turma,
            "url": f"https://www.trf4.jus.br/trf4/controlador.php?acao=jurisprudencia_pesquisar&processo={processo}",
            "conteudoIntegral": conteudo,
        }
        decisions.append(doc)
        prev_end = match.end()

    log.info(f"  {len(decisions)} decisões extraídas de {filename} (ed. {edition})")
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
                log.warning(f"  ⚠️  ES erro: {err}")
    except Exception as e:
        log.error(f"❌ Bulk insert falhou: {e}")


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
    parser = argparse.ArgumentParser(description="Ingestão TRF4 Boletins EMAGIS → Elasticsearch")
    parser.add_argument("--folder", default=str(DEFAULT_FOLDER), help="Pasta com PDFs do TRF4")
    parser.add_argument("--batch", type=int, default=50, help="Docs por bulk insert")
    parser.add_argument("--es-url", default=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"))
    parser.add_argument("--reset", action="store_true", help="Remove checkpoint e reprocessa tudo")
    parser.add_argument("--dry-run", action="store_true", help="Extrai mas não indexa no ES")
    args = parser.parse_args()

    folder = Path(args.folder)
    if not folder.exists():
        sys.exit(f"❌ Pasta não encontrada: {folder}")

    pdfs = sorted(folder.glob("*.pdf"))
    if not pdfs:
        sys.exit(f"❌ Nenhum PDF em: {folder}")

    if args.reset and CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        log.info("🗑️  Checkpoint removido")

    done = load_checkpoint()
    es = None if args.dry_run else Elasticsearch(args.es_url)

    counters = {"pdfs": 0, "decisions": 0, "indexed": 0, "es_errors": 0, "skipped": 0, "failed": 0}
    buffer: list[dict] = []

    log.info("=" * 60)
    log.info(f"TRF4 → ES  |  {len(pdfs)} PDFs  |  já feitos: {len(done)}")
    log.info(f"Pasta: {folder}")
    if args.dry_run:
        log.info("⚠️  DRY-RUN: não indexa no ES")
    else:
        log.info(f"ES: {args.es_url}  índice: {ES_INDEX}")
    log.info("=" * 60)

    for pdf_path in pdfs:
        fname = pdf_path.name

        if fname in done:
            counters["skipped"] += 1
            continue

        try:
            log.info(f"📄 {fname}")
            text = pdf_to_text(str(pdf_path))
            decisions = extract_decisions(text, fname)
            counters["decisions"] += len(decisions)

            if args.dry_run:
                for d in decisions[:2]:
                    log.info(f"  [dry-run] {d['numero']} | {d['relator']} | {d['dataJulgamento']} | {d['area']}")
                    log.info(f"            turma: {d['orgaoJulgador']}")
                    log.info(f"            ementa: {d['ementa'][:120]}")
            else:
                buffer.extend(decisions)
                if len(buffer) >= args.batch:
                    bulk_insert(es, buffer, counters)
                    buffer.clear()

            done.add(fname)
            save_checkpoint(done)
            counters["pdfs"] += 1

        except Exception as e:
            log.error(f"❌ {fname}: {e}")
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

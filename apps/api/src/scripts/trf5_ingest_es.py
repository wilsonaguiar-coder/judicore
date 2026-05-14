#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestão dos Boletins de Jurisprudência do TRF5 no Elasticsearch.

Formato dos PDFs: Boletim de Jurisprudência (quinzenal/mensal), ex:
  boletim-jurisprudencia-A2020_01_1.pdf  (quinzenal — nova nomenclatura)
  trf5-2024-06-junho.pdf                 (mensal — nomenclatura antiga)

Cada decisão termina com:
  Processo n° XXXXXXX-XX.XXXX.4.05.XXXX (PJe)
  Relator: Desembargador Federal NOME
  (Julgado em DD de MÊS de AAAA, por unanimidade)
  -- ou --
  (Julgado por unanimidade; data da assinatura eletrônica: DD de MÊS de AAAA)

Uso:
    python trf5_ingest_es.py [--folder e:/judicore/temp/trf5]
    python trf5_ingest_es.py --dry-run
    python trf5_ingest_es.py --reset
    python trf5_ingest_es.py --es-url http://localhost:9200
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
DEFAULT_FOLDER = PROJECT_ROOT / "temp" / "trf5"
CHECKPOINT_FILE = SCRIPT_DIR / "trf5_ingest_checkpoint.json"
LOG_FILE = SCRIPT_DIR / "trf5_ingest_es.log"
ES_INDEX = "jurisprudencia"

# ── Regexes ───────────────────────────────────────────────────────────────────

# Citação ao final de cada decisão (dois formatos históricos):
# Processo n° 0804328-94.2019.4.05.0000 (PJe)
# Relator: Desembargador Federal NOME
# (Julgado em 10 de outubro de 2019, por unanimidade)
#   -- ou (formato a partir de ~2024) --
# (Julgado por unanimidade; data da assinatura eletrônica: 29 de maio de 2024)
CITATION_RE = re.compile(
    r"Processo\s+n[º°\.o]?\s*"
    r"(?P<processo>\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})"
    r"[^\n]*\n"
    r"Relator[^:]*:\s*(?P<relator>[^\n]+)\n"
    r"\((?P<julgamento>Julgad[ao][^\)]{0,300})\)",
    re.IGNORECASE | re.DOTALL,
)

# Seção de área do direito — detecta cabeçalhos como
# "JURISPRUDÊNCIA DE DIREITO ADMINISTRATIVO" (com ou sem espaçamento decorativo)
SECTION_RE = re.compile(
    r"JURISPRUD[ÊE]NCIA\s+DE\s+DIRE[IT]TO\s+"
    r"(?P<area>ADMINISTRATIVO|AMBIENTAL|CIVIL|CONSTITUCIONAL|PENAL|"
    r"PREVIDENCI[ÁA]RIO|PROCESSUAL(?:\s+(?:CIVIL|PENAL))?|TRIBUT[ÁA]RIO|"
    r"DO\s+CONSUMIDOR|INTERNACIONAL|TRABALHISTA|URBAN[ÍI]STICO)",
    re.IGNORECASE,
)

# Turma no corpo da decisão
TURMA_RE = re.compile(
    r"\b(\d)[ªa°]\.?\s+TURMA\b",
    re.IGNORECASE,
)

# Ementa explícita
EMENTA_RE = re.compile(r"EMENTA\s*:", re.IGNORECASE)

# ── Mapeamento seção → área canônica ─────────────────────────────────────────

SECTION_AREA_MAP = {
    "ADMINISTRATIVO": "ADMINISTRATIVO",
    "AMBIENTAL": "AMBIENTAL",
    "CIVIL": "CIVIL",
    "CONSTITUCIONAL": "ADMINISTRATIVO",
    "PENAL": "CRIMINAL",
    "PREVIDENCIARIO": "PREVIDENCIARIO",
    "PREVIDENCIÁRIO": "PREVIDENCIARIO",
    "PROCESSUAL": "OUTRO",
    "TRIBUTARIO": "TRIBUTARIO",
    "TRIBUTÁRIO": "TRIBUTARIO",
    "CONSUMIDOR": "CIVIL",
    "TRABALHISTA": "OUTRO",
    "INTERNACIONAL": "OUTRO",
    "URBANISTICO": "ADMINISTRATIVO",
    "URBANÍSTICO": "ADMINISTRATIVO",
}

# ── Classificação de área por palavras-chave (fallback) ───────────────────────

AREA_RULES: list[tuple[str, re.Pattern]] = [
    ("PREVIDENCIARIO", re.compile(
        r"previd[eê]nci|aposen(?:tad|tor)|inss\b|pens[aã]o\s+por\s+morte|"
        r"aux[íi]lio[- ]doen|invalidez\b|segurado\b|sal[aá]rio[- ]matern|RGPS",
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
        r"improbidade\b|ato\s+administrativo|cargo\s+p[úu]blico|desapropria[çc][aã]o\b",
        re.IGNORECASE,
    )),
    ("CRIMINAL", re.compile(
        r"\bcrime\b|\bpenal\b|\bpena\s|\br[eé]u\b|den[úu]ncia\b|habeas.corpus|"
        r"contrabando\b|estelionato\b|homic[íi]dio\b|tr[aá]fico\b|corrup[çc][aã]o\b|"
        r"furto\b|roubo\b|lavagem\s+de\s+dinheiro",
        re.IGNORECASE,
    )),
    ("AMBIENTAL", re.compile(
        r"ambiental\b|meio\s+ambiente|licen[çc]a\s+ambiental|ibama\b|"
        r"[aá]rea\s+de\s+preserva[çc][aã]o|desmatamento\b",
        re.IGNORECASE,
    )),
    ("CIVIL", re.compile(
        r"responsabilidade\s+civil|indeniza[çc][aã]o\s|usucapi[aã]o\b|"
        r"loca[çc][aã]o\b|propriedade\s|poss(?:e|eiro)\b",
        re.IGNORECASE,
    )),
]

MESES_PT = {
    "janeiro": "01", "fevereiro": "02", "março": "03", "marco": "03",
    "abril": "04", "maio": "05", "junho": "06", "julho": "07",
    "agosto": "08", "setembro": "09", "outubro": "10",
    "novembro": "11", "dezembro": "12",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_date(julgamento: str) -> Optional[str]:
    """Extrai data ISO do campo 'julgamento' — suporta os dois formatos históricos."""
    s = julgamento.replace("\n", " ").replace("\xa0", " ")
    m = re.search(r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})", s, re.IGNORECASE)
    if m:
        d, mes, y = m.groups()
        mo = MESES_PT.get(mes.lower())
        if mo:
            return f"{y}-{mo}-{int(d):02d}"
    m2 = re.search(r"\b(20\d{2})\b", s)
    if m2:
        return f"{m2.group(1)}-01-01"
    return None


def clean_relator(raw: str) -> str:
    """Remove 'Desembargador(a) Federal' e normaliza espaços não-quebráveis."""
    s = raw.replace("\xa0", " ").strip()
    return re.sub(
        r"^(?:Des(?:embargador[a]?)?\.?\s+Federal|Ju[íi]z[a]?\s+Federal(?:\s+Convocad[oa])?)\s+",
        "",
        s,
        flags=re.IGNORECASE,
    ).strip()


def section_to_area(section_text: str) -> str:
    upper = section_text.upper().strip()
    for key, area in SECTION_AREA_MAP.items():
        if key.upper() in upper:
            return area
    return "OUTRO"


def classify_area(text: str, current_section: str = "") -> str:
    if current_section:
        return section_to_area(current_section)
    for area, pattern in AREA_RULES:
        if pattern.search(text):
            return area
    return "OUTRO"


def _clean_ementa_text(raw: str) -> str:
    """Remove hifenização de fim de linha do PDF e normaliza espaços."""
    # "BENE-\nFÍCIO" → "BENEFÍCIO"
    text = re.sub(r"-\s*\n\s*", "", raw)
    # demais quebras de linha → espaço
    return re.sub(r"\s*\n\s*", " ", text).strip()


def extract_ementa(block: str) -> str:
    """Extrai a ementa completa: após 'EMENTA:' se presente, ou tudo antes do corpo ('- ')."""
    m = EMENTA_RE.search(block)
    after = block[m.end():].strip() if m else block

    # Corpo do acórdão começa na primeira linha que inicia com "- " ou "– "
    body_m = re.search(r"(?m)^[-–]\s", after)
    if body_m and body_m.start() > 10:
        ementa_raw = after[:body_m.start()].strip()
    else:
        ementa_raw = re.split(r"\n\s*\n", after.strip(), maxsplit=1)[0]

    return _clean_ementa_text(ementa_raw)


def extract_turma(block: str) -> str:
    """Extrai a turma do texto da decisão (ex: '2ª TURMA')."""
    m = TURMA_RE.search(block)
    return f"{m.group(1)}ª TURMA" if m else ""


def clean_block(text: str) -> str:
    text = re.sub(r"Boletim de Jurisprud[êe]ncia[^\n]*\n?", "", text, flags=re.IGNORECASE)
    text = re.sub(r"(?m)^\s*\d{1,3}\s*$", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def pdf_to_text(path: str) -> str:
    doc = fitz.open(path)
    pages = [page.get_text() for page in doc]
    doc.close()
    return "\n".join(pages)


# ── Parsing principal ─────────────────────────────────────────────────────────

def extract_decisions(text: str, filename: str) -> list[dict]:
    """
    Divide o texto do Boletim TRF5 em decisões individuais.

    Cada decisão termina com:
      Processo n° XXXXXXX / Relator: ... / (Julgado ...)
    """
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

        # Atualiza seção de área se houver cabeçalho no bloco
        section_matches = list(SECTION_RE.finditer(block_text))
        if section_matches:
            current_section = section_matches[-1].group("area").strip()
            decision_body = block_text[section_matches[-1].end():].strip()
        else:
            decision_body = block_text

        body = clean_block(decision_body)

        if len(body.strip()) < 60:
            prev_end = match.end()
            continue

        processo = match.group("processo")
        relator = clean_relator(match.group("relator"))
        data = parse_date(match.group("julgamento"))
        turma = extract_turma(body + "\n" + citation_text)
        ementa = extract_ementa(body)

        doc = {
            "_id": f"trf5-{processo}",
            "tribunal": "TRF5",
            "numero": processo,
            "ementa": ementa,
            "relator": relator,
            "dataJulgamento": data,
            "area": classify_area(body, current_section),
            "orgaoJulgador": turma,
            "url": f"https://www.trf5.jus.br/trf5/consultas-e-servicos/jurisprudencia",
            "conteudoIntegral": (body + "\n" + citation_text)[:80_000],
        }
        decisions.append(doc)
        prev_end = match.end()

    log.info(f"  {len(decisions)} decisões extraídas de {filename}")
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
    parser = argparse.ArgumentParser(description="Ingestão TRF5 Boletins de Jurisprudência → Elasticsearch")
    parser.add_argument("--folder", default=str(DEFAULT_FOLDER), help="Pasta com PDFs do TRF5")
    parser.add_argument("--batch", type=int, default=50, help="Docs por bulk insert")
    parser.add_argument("--es-url", default=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"))
    parser.add_argument("--reset", action="store_true", help="Remove checkpoint e reprocessa tudo")
    parser.add_argument("--dry-run", action="store_true", help="Extrai mas não indexa no ES")
    args = parser.parse_args()

    folder = Path(args.folder)
    if not folder.exists():
        sys.exit(f"Pasta não encontrada: {folder}")

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
    log.info(f"TRF5 -> ES  |  {len(pdfs)} PDFs  |  ja feitos: {len(done)}")
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

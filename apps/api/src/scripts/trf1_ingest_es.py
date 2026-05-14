#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestão dos Boletins Informativos de Jurisprudência do TRF1 no Elasticsearch.

Formato dos PDFs: Boletim Informativo de Jurisprudência (BIJ), ex: 10011-Bij_697.pdf
Cada PDF contém ~20-30 decisões agrupadas por Seção/Turma.
Cada decisão termina com: (TIPO PROCESSO – PJe, rel. des. federal RELATOR, em DATA.)

Uso:
    python trf1_ingest_es.py [--folder e:/judicore/temp/trf1]
    python trf1_ingest_es.py --dry-run    # testa sem indexar no ES
    python trf1_ingest_es.py --reset      # recomeça do zero
    python trf1_ingest_es.py --es-url http://localhost:9200
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional

import fitz  # pymupdf
from elasticsearch import Elasticsearch, helpers

# ── Configuração ──────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent  # e:/judicore
DEFAULT_FOLDER = PROJECT_ROOT / "temp" / "trf1"
CHECKPOINT_FILE = SCRIPT_DIR / "trf1_ingest_checkpoint.json"
LOG_FILE = SCRIPT_DIR / "trf1_ingest_es.log"
ES_INDEX = "jurisprudencia"

# ── Regexes ───────────────────────────────────────────────────────────────────

# Citação ao final de cada decisão:
# (Ap 1049912-15.2023.4.01.3900 – PJe, rel. des. federal Gustavo Soares Amorim, em 05/06/2024.)
# (ApReeNec 0058812-06.2010.4.01.3400 – PJe, rel. des. federal ..., em sessão virtual ... 07/06/2024.)
CITATION_RE = re.compile(
    r"\("
    r"(?P<tipo>[A-Za-z]+)"
    r"\s+"
    r"(?P<processo>\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})"
    r"[^)]{0,300}?"
    r"[Rr]el\.\s*[Dd]es\.(?:\s*[Ff]ederal)?\s+(?P<relator>[A-ZÀ-ÿ][^,\)\n]+?)(?=\s*[,\)])"
    r"[^)]{0,150}?"
    r"[Ee]m\s+(?P<data_raw>[^)]{5,80})\.?\)",
    re.DOTALL,
)

# Cabeçalhos de Seção/Turma entre decisões
ORGAO_RE = re.compile(
    r"\b((?:Prim(?:eira)?|Seg(?:unda)?|Terc(?:eira)?|Quart(?:a)?|Quint(?:a)?|Sext(?:a)?|"
    r"Sét(?:ima)?|Oit(?:ava)?|Especial|Plen[aá]r(?:io)?)\s+"
    r"(?:Turma|Se[çc][aã]o|C[aâ]mara))\b",
    re.IGNORECASE,
)

# Número de edição do boleti no nome do arquivo: 10011-Bij_697.pdf → 697
EDITION_RE = re.compile(r"[Bb]ij_?(\d+)", re.IGNORECASE)

# Classificação de área por palavras-chave
AREA_RULES: list[tuple[str, re.Pattern]] = [
    ("PREVIDENCIARIO", re.compile(
        r"previd[eê]nci|aposen(?:tad|tor)|inss\b|pens[aã]o\s+por\s+morte|"
        r"aux[íi]lio[- ]doen|invalidez\b|segurado\b|salário[- ]matern|RGPS",
        re.IGNORECASE,
    )),
    ("TRIBUTARIO", re.compile(
        r"tribut[aá]r[io]|imposto\b|icms\b|iss\b|ipi\b|pis\b|cofins\b|"
        r"execu[çc][aã]o\s+fiscal|cr[eé]dito\s+tribut|contribui[çc][aã]o\s+(?:social|previd)",
        re.IGNORECASE,
    )),
    ("ADMINISTRATIVO", re.compile(
        r"servidor\s+p[úu]blico|concurso\s+p[úu]blico|licita[çc][aã]o\b|"
        r"improbidade\b|ato\s+administrativo|cargo\s+p[úu]blico|fun[çc][aã]o\s+p[úu]blica",
        re.IGNORECASE,
    )),
    ("CRIMINAL", re.compile(
        r"\bcrime\b|\bpenal\b|\bpena\s|\br[eé]u\b|den[úu]ncia\b|habeas.corpus|"
        r"contrabando\b|estelionato\b|homic[íi]dio\b|tr[aá]fico\b|corrup[çc][aã]o\b",
        re.IGNORECASE,
    )),
    ("AMBIENTAL", re.compile(
        r"ambiental\b|meio\s+ambiente|licen[çc]a\s+ambiental|desmatamento\b|"
        r"ibama\b|[aá]rea\s+de\s+preserva[çc][aã]o",
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

def parse_date(raw: str) -> Optional[str]:
    raw = raw.replace("\n", " ").strip()
    # DD/MM/YYYY — pega a última data (fim do período)
    dates = re.findall(r"(\d{2})/(\d{2})/(\d{4})", raw)
    if dates:
        d, mo, y = dates[-1]
        return f"{y}-{mo}-{d}"
    # DD/MM/YY
    dates = re.findall(r"(\d{2})/(\d{2})/(\d{2})\b", raw)
    if dates:
        d, mo, y = dates[-1]
        y_full = f"20{y}" if int(y) < 50 else f"19{y}"
        return f"{y_full}-{mo}-{d}"
    # DD de MÊS de YYYY
    m = re.search(r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})", raw, re.IGNORECASE)
    if m:
        d, mes, y = m.groups()
        mo = MESES_PT.get(mes.lower())
        if mo:
            return f"{y}-{mo}-{int(d):02d}"
    # Só o ano
    m = re.search(r"\b(20\d{2})\b", raw)
    if m:
        return f"{m.group(1)}-01-01"
    return None


def classify_area(text: str) -> str:
    for area, pattern in AREA_RULES:
        if pattern.search(text):
            return area
    return "OUTRO"


def clean_block(text: str) -> str:
    """Remove cabeçalhos de página e espaços excessivos do bloco de decisão."""
    # Remove padrão de cabeçalho: "N\nBoletim Informativo de Jurisprudência n. XXX\n"
    text = re.sub(r"^\d+\s*\n.*?[Jj]urisprud[êe]ncia[^\n]*\n", "", text, flags=re.MULTILINE)
    # Remove rodapés/números de página soltos
    text = re.sub(r"(?m)^\s*\d{1,3}\s*$", "", text)
    # Colapsa múltiplos newlines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def pdf_to_text(path: str) -> str:
    """Extrai texto de todas as páginas do PDF concatenadas."""
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
    Divide o texto do boletim TRF1 em decisões individuais.

    Cada decisão termina com a citação entre parênteses:
    (TIPO PROCESSO – PJe, rel. des. federal RELATOR, em DATA.)
    """
    edition = extract_edition(filename)

    # Período de sessões da primeira página
    session_match = re.search(r"[Ss]ess[õo]es?\s+de\s+[\d/]+\s+a\s+([\d/]+)", text)
    session_date = session_match.group(1) if session_match else None

    citations = list(CITATION_RE.finditer(text))

    if not citations:
        log.warning(f"  Nenhuma citação encontrada em {filename} — indexando como doc único")
        return [_make_fallback_doc(text, filename, edition)]

    decisions = []
    prev_end = 0
    current_orgao = ""

    for match in citations:
        block_text = text[prev_end:match.start()]
        citation_text = match.group(0)

        body = clean_block(block_text)

        # Ignora blocos muito curtos (ruído entre páginas)
        if len(body.strip()) < 80:
            prev_end = match.end()
            continue

        # Atualiza seção/turma e extrai o texto real da decisão
        # (ignora cabeçalho do boletim e linhas de seção)
        cleaned_orgao_matches = list(ORGAO_RE.finditer(body))
        if cleaned_orgao_matches:
            current_orgao = cleaned_orgao_matches[-1].group(1).strip()
            # Texto da decisão começa APÓS o último cabeçalho de seção
            decision_text = body[cleaned_orgao_matches[-1].end():].strip()
        else:
            decision_text = body

        # Se decision_text ficou vazio (bloco era só cabeçalho), usa body completo
        if len(decision_text) < 80:
            decision_text = body

        processo = match.group("processo")
        relator = match.group("relator").strip()
        data_raw = match.group("data_raw").replace("\n", " ").strip()
        data = parse_date(data_raw) or (parse_date(session_date) if session_date else None)

        ementa = decision_text[:600].strip()
        conteudo = (decision_text + "\n" + citation_text)[:80000]

        doc = {
            "_id": f"trf1-{processo}",
            "tribunal": "TRF1",
            "numero": processo,
            "ementa": ementa,
            "relator": relator,
            "dataJulgamento": data,
            "area": classify_area(decision_text),
            "orgaoJulgador": current_orgao,
            "url": f"https://jurisprudencia.trf1.jus.br/paginador.php?paginador=1&processo={processo}",
            "conteudoIntegral": conteudo,
        }
        decisions.append(doc)
        prev_end = match.end()

    log.info(f"  {len(decisions)} decisões extraídas de {filename} (ed. {edition})")
    return decisions


def _make_fallback_doc(text: str, filename: str, edition: Optional[str]) -> dict:
    name = Path(filename).stem
    body = clean_block(text)
    return {
        "_id": f"trf1-boleti-{edition or name}",
        "tribunal": "TRF1",
        "numero": edition or name,
        "ementa": body[:600].strip(),
        "relator": "Não informado",
        "dataJulgamento": None,
        "area": classify_area(body),
        "url": "",
        "conteudoIntegral": body[:80000],
    }


# ── Checkpoint ────────────────────────────────────────────────────────────────

def load_checkpoint() -> set:
    if not CHECKPOINT_FILE.exists():
        return set()
    try:
        return set(json.loads(CHECKPOINT_FILE.read_text(encoding="utf-8")).get("done", []))
    except Exception:
        return set()


def save_checkpoint(done: set) -> None:
    CHECKPOINT_FILE.write_text(
        json.dumps({"done": list(done)}, ensure_ascii=False),
        encoding="utf-8",
    )


# ── ES Bulk Insert ────────────────────────────────────────────────────────────

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
    parser = argparse.ArgumentParser(description="Ingestão TRF1 BIJs → Elasticsearch")
    parser.add_argument("--folder", default=str(DEFAULT_FOLDER), help="Pasta com PDFs do TRF1")
    parser.add_argument("--batch", type=int, default=50, help="Docs por bulk insert")
    parser.add_argument("--es-url", default=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"))
    parser.add_argument("--reset", action="store_true", help="Remove checkpoint e recomeça")
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

    counters = {
        "pdfs": 0, "decisions": 0, "indexed": 0,
        "es_errors": 0, "skipped": 0, "failed": 0,
    }
    buffer: list[dict] = []

    log.info("=" * 60)
    log.info(f"TRF1 → ES  |  {len(pdfs)} PDFs  |  já feitos: {len(done)}")
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
                # Mostra amostra da primeira decisão
                if decisions:
                    d = decisions[0]
                    log.info(f"  [dry-run] Exemplo: {d['numero']} | {d['relator']} | {d['dataJulgamento']} | {d['area']}")
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

    # Flush restante
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

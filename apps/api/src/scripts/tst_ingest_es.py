#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestão das decisões do TST (184k arquivos HTML em disco) no Elasticsearch.

Cada HTML é um acórdão único. O nome do arquivo é um hash MD5 (sem relação
com o número do processo). Dois formatos identificados:

  Formato A — classes CSS semânticas (Ementa, Autoridade, Date, Relatario…)
  Formato B — apenas p.Normal, ementa como texto bold antes de "Vistos"

Uso:
    python tst_ingest_es.py [--folder e:/judicore/temp/tst]
    python tst_ingest_es.py --dry-run --sample 500
    python tst_ingest_es.py --reset --workers 4
    python tst_ingest_es.py --es-url http://localhost:9200
"""

import argparse
import json
import logging
import os
import re
import sys
import unicodedata
from concurrent.futures import ProcessPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from typing import Optional

from elasticsearch import Elasticsearch, helpers

# ── Configuração ──────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
DEFAULT_FOLDER = PROJECT_ROOT / "temp" / "tst"
CHECKPOINT_FILE = SCRIPT_DIR / "tst_ingest_checkpoint.json"
LOG_FILE = SCRIPT_DIR / "tst_ingest_es.log"
ES_INDEX = "jurisprudencia"
CHECKPOINT_INTERVAL = 5_000

# ── Regexes ───────────────────────────────────────────────────────────────────

PROCESSO_RE = re.compile(
    r"TST\s*[-–]\s*(?:[A-Z]{1,6}\s*[-–]\s*)+\d{3,7}[-–]\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}",
    re.IGNORECASE,
)


def _normalize_processo(raw: str) -> str:
    return re.sub(r"\s*[-–]\s*", "-", raw).upper()

DATE_RE = re.compile(
    r"Bras[íi]lia[,\s]+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})",
    re.IGNORECASE,
)

TURMA_RE = re.compile(
    r"\d[ªa°º]?\s*[Tt]urma|SBDI[-–\s]\d|Pleno|Se[çc][aã]o\s+Especializada",
    re.IGNORECASE,
)

RELATOR_ROLE_RE = re.compile(
    r"Ministr[oa]\s+Relator[a]?(?:\s+Designad[oa])?$",
    re.IGNORECASE,
)

MESES = {
    "janeiro": "01", "fevereiro": "02", "marco": "03",
    "abril": "04", "maio": "05", "junho": "06", "julho": "07",
    "agosto": "08", "setembro": "09", "outubro": "10",
    "novembro": "11", "dezembro": "12",
}


def _normalize(s: str) -> str:
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()


def _parse_date(text: str) -> Optional[str]:
    m = DATE_RE.search(text)
    if not m:
        return None
    day, month_name, year = m.groups()
    mes = MESES.get(_normalize(month_name))
    if not mes:
        return None
    return f"{year}-{mes}-{int(day):02d}"


# ── HTML Parser ───────────────────────────────────────────────────────────────

class _TstParser(HTMLParser):
    """Coleta parágrafos por classe CSS: lista de (class, text, has_bold)."""

    def __init__(self):
        super().__init__()
        self.paragraphs: list[tuple[str, str, bool]] = []
        self._cur_class = ""
        self._cur_text: list[str] = []
        self._cur_bold = False
        self._in_p = False
        self._in_bold = False

    def handle_starttag(self, tag, attrs):
        if tag == "p":
            self._in_p = True
            self._cur_class = ""
            self._cur_text = []
            self._cur_bold = False
            for name, val in attrs:
                if name == "class":
                    self._cur_class = (val or "").strip()
        elif tag in ("b", "strong") and self._in_p:
            self._in_bold = True
            self._cur_bold = True

    def handle_endtag(self, tag):
        if tag == "p" and self._in_p:
            text = " ".join("".join(self._cur_text).split())
            if text:
                self.paragraphs.append((self._cur_class, text, self._cur_bold))
            self._in_p = False
            self._in_bold = False
        elif tag in ("b", "strong"):
            self._in_bold = False

    def handle_data(self, data):
        if self._in_p:
            self._cur_text.append(data)


# ── Parsing principal ─────────────────────────────────────────────────────────

_CDATA_RE = re.compile(r"<!\[CDATA\[(.*?)(?:\]\]>|$)", re.DOTALL)


def _unwrap_cdata(raw: str) -> str:
    """Extrai conteúdo de <![CDATA[...]]> e o envolve em <html><body>."""
    m = _CDATA_RE.search(raw)
    if not m:
        return raw
    inner = m.group(1)
    # Normaliza <br/> para não confundir o parser com tags auto-fechantes
    inner = re.sub(r"<br\s*/?>", " ", inner, flags=re.IGNORECASE)
    return f"<html><body>{inner}</body></html>"


def parse_html_file(path: Path) -> Optional[dict]:
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None

    if len(raw) < 1500:
        return None

    # Formato CDATA: conteúdo embutido em <![CDATA[...]]> sem estrutura html/body
    if raw.lstrip().startswith("<![CDATA["):
        raw = _unwrap_cdata(raw)

    parser = _TstParser()
    try:
        parser.feed(raw)
    except Exception:
        return None

    paragraphs = parser.paragraphs
    if not paragraphs:
        return None

    classes = {cls for cls, _, _ in paragraphs}
    fmt_a = "Ementa" in classes

    ementa_parts: list[str] = []
    processo = ""
    relator = ""
    data_str = ""
    orgao = ""
    full_parts: list[str] = []

    if fmt_a:
        # ── Formato A: classes semânticas ─────────────────────────────────────
        autoridades: list[str] = []

        for cls, text, bold in paragraphs:
            full_parts.append(text)

            if cls == "Ementa":
                ementa_parts.append(text)
            elif cls == "Autoridade" and bold:
                autoridades.append(text)
            elif cls == "Date" and not data_str:
                data_str = text
            elif cls == "Identificaaao" and not orgao:
                if TURMA_RE.search(text):
                    orgao = text.strip("() ")

            if not processo:
                m = PROCESSO_RE.search(text)
                if m:
                    processo = _normalize_processo(m.group(0))

        relator = autoridades[-1] if autoridades else ""

    else:
        # ── Formato B: p.Normal (Courier) ─────────────────────────────────────
        bold_initial: list[str] = []
        found_vistos = False
        prev_text = ""

        for cls, text, bold in paragraphs:
            full_parts.append(text)

            if not found_vistos:
                if "vistos, relatados" in text.lower():
                    found_vistos = True
                elif bold and len(text) > 30:
                    bold_initial.append(text)

            if not processo:
                m = PROCESSO_RE.search(text)
                if m:
                    processo = _normalize_processo(m.group(0))

            if not data_str and DATE_RE.search(text):
                data_str = text

            if RELATOR_ROLE_RE.search(text) and prev_text:
                relator = prev_text

            if not orgao and bold and TURMA_RE.search(text):
                orgao = text.strip("() ")

            prev_text = text

        ementa_parts = bold_initial

    full_text = " ".join(full_parts)

    # ── Fallbacks ─────────────────────────────────────────────────────────────
    if not processo:
        m = PROCESSO_RE.search(full_text)
        if m:
            processo = _normalize_processo(m.group(0))

    if not data_str:
        m = DATE_RE.search(full_text)
        if m:
            data_str = full_text

    if not ementa_parts:
        for cls, text, bold in paragraphs[:40]:
            if bold and len(text) > 60:
                ementa_parts.append(text)
                break

    ementa = " ".join(ementa_parts)[:3000].strip()
    conteudo = full_text[:80_000]

    return {
        "_id": f"tst-{path.stem}",
        "tribunal": "TST",
        "numero": processo or path.stem,
        "ementa": ementa,
        "relator": relator.strip(),
        "dataJulgamento": _parse_date(data_str) if data_str else None,
        "area": "TRABALHISTA",
        "orgaoJulgador": orgao.strip(),
        "url": "https://jurisprudencia.tst.jus.br/",
        "conteudoIntegral": conteudo,
    }


# ── Checkpoint ────────────────────────────────────────────────────────────────

def load_checkpoint() -> set[str]:
    if CHECKPOINT_FILE.exists():
        try:
            return set(json.loads(CHECKPOINT_FILE.read_text(encoding="utf-8")))
        except Exception:
            pass
    return set()


def save_checkpoint(done: set[str]) -> None:
    CHECKPOINT_FILE.write_text(
        json.dumps(sorted(done), ensure_ascii=False, indent=2), encoding="utf-8"
    )


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
    ap = argparse.ArgumentParser(description="Ingestao TST HTML -> Elasticsearch")
    ap.add_argument("--folder", default=str(DEFAULT_FOLDER))
    ap.add_argument("--batch", type=int, default=200)
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 4)
    ap.add_argument("--es-url", default=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"))
    ap.add_argument("--reset", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--sample", type=int, default=0, help="Processar apenas N arquivos (teste)")
    args = ap.parse_args()

    folder = Path(args.folder)
    if not folder.exists():
        sys.exit(f"Pasta nao encontrada: {folder}")

    files = sorted(folder.glob("*.html"))
    if not files:
        sys.exit(f"Nenhum HTML em: {folder}")

    if args.reset and CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        log.info("Checkpoint removido")

    done = load_checkpoint()

    pending = [f for f in files if f.name not in done]
    if args.sample:
        pending = pending[: args.sample]

    es = None if args.dry_run else Elasticsearch(args.es_url)

    counters = {
        "processed": 0, "indexed": 0, "failed_parse": 0,
        "es_errors": 0, "skipped": 0,
    }
    counters["skipped"] = len(files) - len(pending)

    log.info("=" * 60)
    log.info(f"TST -> ES  |  {len(files)} HTMLs totais  |  pendentes: {len(pending)}")
    log.info(f"Pasta: {folder}")
    if args.dry_run:
        log.info(f"DRY-RUN: nao indexa no ES  (workers={args.workers})")
    else:
        log.info(f"ES: {args.es_url}  indice: {ES_INDEX}  workers={args.workers}")
    log.info("=" * 60)

    buffer: list[dict] = []
    SUBMIT_CHUNK = 2000  # submete em lotes para evitar fila de 184k itens de uma vez

    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        for chunk_start in range(0, len(pending), SUBMIT_CHUNK):
            chunk = pending[chunk_start: chunk_start + SUBMIT_CHUNK]
            futures = {pool.submit(parse_html_file, f): f.name for f in chunk}

            for future in as_completed(futures):
                fname = futures[future]
                try:
                    doc = future.result()
                except Exception as e:
                    log.error(f"{fname}: {e}")
                    counters["failed_parse"] += 1
                    done.add(fname)
                    continue

                if doc is None:
                    counters["failed_parse"] += 1
                else:
                    counters["processed"] += 1
                    if args.dry_run:
                        if counters["processed"] <= 8:
                            log.info(
                                f"  [dry-run] {doc['numero']} | {doc['relator'] or '(sem relator)'} "
                                f"| {doc['dataJulgamento']} | {doc['orgaoJulgador'] or '(sem turma)'}"
                            )
                            log.info(f"            ementa: {doc['ementa'][:120]}")
                    else:
                        buffer.append(doc)
                        if len(buffer) >= args.batch:
                            bulk_insert(es, buffer, counters)
                            buffer.clear()

                done.add(fname)

            # flush e checkpoint após cada chunk
            if not args.dry_run and buffer:
                bulk_insert(es, buffer, counters)
                buffer.clear()

            save_checkpoint(done)
            pct = 100 * len(done) / len(files)
            log.info(
                f"  Progresso: {len(done)}/{len(files)} ({pct:.1f}%)  "
                f"indexados={counters['indexed']}  falhas={counters['failed_parse']}"
            )

    log.info("=" * 60)
    log.info(f"Concluido: {counters['processed']} processados | {counters['indexed']} indexados")
    log.info(f"  Pulados    : {counters['skipped']}")
    log.info(f"  Falhas HTML: {counters['failed_parse']}")
    log.info(f"  Erros ES   : {counters['es_errors']}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()

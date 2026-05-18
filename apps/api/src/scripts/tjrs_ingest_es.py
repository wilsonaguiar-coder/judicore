#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestão dos Boletins de Jurisprudência do TJRS no Elasticsearch.

90 HTMLs: boletim_229.html – boletim_318.html
Dois layouts: OLD (229-290, citação no FIM) e NEW (291-318, citação no INÍCIO)

Uso:
    python tjrs_ingest_es.py
    python tjrs_ingest_es.py --dry-run
    python tjrs_ingest_es.py --reset
    python tjrs_ingest_es.py --es-url http://localhost:9200
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from elasticsearch import Elasticsearch, helpers

sys.path.insert(0, str(Path(__file__).parent))
from preview_boletins import (  # noqa: E402
    TRIBUNAL_CFG,
    parse_fields_tjrs,
    process_file,
)

# ── Caminhos ──────────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
HTML_FOLDER  = PROJECT_ROOT / "temp" / "boletins" / "tjrs"
CHECKPOINT   = SCRIPT_DIR / "tjrs_ingest_checkpoint.json"
LOG_FILE     = SCRIPT_DIR / "tjrs_ingest_es.log"
ES_INDEX     = "jurisprudencia"

CFG = TRIBUNAL_CFG["tjrs"]

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
        {
            "_index": ES_INDEX,
            "_id": d["_id"],
            **{k: v for k, v in d.items() if k != "_id"},
        }
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


# ── Processamento por arquivo ─────────────────────────────────────────────────

def process_html(path: Path) -> list[dict]:
    chunks = process_file(path, CFG)
    docs: list[dict] = []
    seen: set[str] = set()
    for chunk in chunks:
        doc = parse_fields_tjrs(chunk, path.name, CFG)
        if doc and doc["_id"] not in seen:
            docs.append(doc)
            seen.add(doc["_id"])
    return docs


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
    ap = argparse.ArgumentParser(description="Ingestão TJRS boletins → Elasticsearch")
    ap.add_argument("--folder",  default=str(HTML_FOLDER))
    ap.add_argument("--batch",   type=int, default=50)
    ap.add_argument("--es-url",  default=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"))
    ap.add_argument("--reset",   action="store_true", help="Remove checkpoint e recomeça")
    ap.add_argument("--dry-run", action="store_true", help="Extrai mas não indexa")
    args = ap.parse_args()

    folder = Path(args.folder)
    if not folder.exists():
        sys.exit(f"Pasta não encontrada: {folder}")

    htmls = sorted(folder.glob("*.html"))
    if not htmls:
        sys.exit(f"Nenhum HTML em: {folder}")

    if args.reset and CHECKPOINT.exists():
        CHECKPOINT.unlink()
        log.info("Checkpoint removido")

    done = load_checkpoint()
    es   = None if args.dry_run else Elasticsearch(args.es_url)

    counters = {"files": 0, "decisions": 0, "indexed": 0,
                "es_errors": 0, "skipped": 0, "failed": 0}
    buffer: list[dict] = []

    log.info("=" * 60)
    log.info(f"TJRS -> ES  |  {len(htmls)} HTMLs  |  já feitos: {len(done)}")
    log.info(f"Pasta: {folder}")
    log.info("DRY-RUN: não indexa no ES" if args.dry_run else f"ES: {args.es_url}  índice: {ES_INDEX}")
    log.info("=" * 60)

    for html in htmls:
        if html.name in done:
            counters["skipped"] += 1
            continue

        try:
            log.info(f"{html.name}")
            docs = process_html(html)
            log.info(f"  -> {len(docs)} decisoes")

            if not docs:
                log.warning(f"  AVISO: 0 decisoes em {html.name}")

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

            done.add(html.name)
            save_checkpoint(done)
            counters["files"] += 1

        except Exception as e:
            log.error(f"{html.name}: {e}")
            counters["failed"] += 1

    if not args.dry_run and buffer:
        bulk_insert(es, buffer, counters)

    log.info("=" * 60)
    log.info(f"Concluído: {counters['files']} HTMLs | {counters['decisions']} decisões")
    log.info(f"  Indexados  : {counters['indexed']}")
    log.info(f"  Pulados    : {counters['skipped']}")
    log.info(f"  Falhas HTML: {counters['failed']}")
    log.info(f"  Erros ES   : {counters['es_errors']}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()

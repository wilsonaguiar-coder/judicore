#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestão de acórdãos TST no Elasticsearch.

Lê tst_jurisprudencia_rr_ro_rot.csv, busca o HTML de cada acórdão em
  https://jurisprudencia-backend2.tst.jus.br/rest/documentos/{id}
extrai ementa, relator, data e inteiro teor, e faz bulk-insert no ES.

Uso:
    cd /opt/judicore/apps/api/src/scripts
    pip install requests beautifulsoup4 elasticsearch
    python tst_ingest_es.py [--workers 3] [--delay 1.0] [--batch 100]

Flags:
    --workers   N de threads simultâneas (padrão: 3)
    --delay     Segundos entre requisições por worker (padrão: 1.0)
    --batch     Documentos por bulk insert no ES (padrão: 100)
    --es-url    URL do Elasticsearch (padrão: http://localhost:9200)
    --reset     Apaga o checkpoint e recomeça do zero
"""

import argparse
import csv
import json
import logging
import os
import random
import re
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup
from elasticsearch import Elasticsearch, helpers

# ─── Configurações ────────────────────────────────────────────────────────────

SCRIPT_DIR      = Path(__file__).parent
CSV_FILE        = SCRIPT_DIR / "tst_jurisprudencia_rr_ro_rot.csv"
CHECKPOINT_FILE = SCRIPT_DIR / "tst_ingest_checkpoint.json"
LOG_FILE        = SCRIPT_DIR / "tst_ingest_es.log"

DOC_URL         = "https://jurisprudencia-backend2.tst.jus.br/rest/documentos/{id}"
ES_INDEX        = "jurisprudencia"

HEADERS = {
    "Referer": "https://jurisprudencia.tst.jus.br/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

MAX_RETRIES        = 6
BACKOFF_BASE       = 5.0
MAX_BACKOFF        = 120.0
CIRCUIT_LIMIT      = 5    # falhas consecutivas por worker antes de pausa longa
CIRCUIT_PAUSE      = 300  # segundos de pausa ao acionar circuit breaker

MESES = {
    "janeiro": "01", "fevereiro": "02", "março": "03", "abril": "04",
    "maio": "05", "junho": "06", "julho": "07", "agosto": "08",
    "setembro": "09", "outubro": "10", "novembro": "11", "dezembro": "12",
}

# ─── Logging ──────────────────────────────────────────────────────────────────

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

# ─── Checkpoint (thread-safe) ─────────────────────────────────────────────────

_ckpt_lock = threading.Lock()

def checkpoint_load() -> set:
    if not CHECKPOINT_FILE.exists():
        return set()
    try:
        data = json.loads(CHECKPOINT_FILE.read_text(encoding="utf-8"))
        return set(data.get("done", []))
    except Exception:
        return set()

def checkpoint_save(done: set):
    with _ckpt_lock:
        CHECKPOINT_FILE.write_text(
            json.dumps({"done": list(done), "updated_at": datetime.now().isoformat()},
                       ensure_ascii=False),
            encoding="utf-8",
        )

# ─── HTML → documento ─────────────────────────────────────────────────────────

def _paragraphs(soup: BeautifulSoup) -> list[tuple]:
    """Retorna lista de (elemento_p, texto_limpo) para todos os <p> com conteúdo."""
    result = []
    for p in soup.find_all("p"):
        text = re.sub(r"\s+", " ", p.get_text(separator=" ", strip=True)).strip()
        if text:
            result.append((p, text))
    return result


def _extract_ementa(paragraphs: list[tuple]) -> str:
    """
    A ementa fica entre o cabeçalho (ACÓRDÃO / turma / siglas) e
    a linha 'Vistos, relatados e discutidos'.
    """
    ementa_parts = []
    collecting = False

    for p, text in paragraphs:
        # Para de coletar ao encontrar o corpo do acórdão
        if re.match(r"^Vistos,?\s+relatados", text, re.IGNORECASE):
            break

        if not collecting:
            # Pula cabeçalho: título, turma entre parênteses, siglas de servidor
            if re.search(r"A\s*C\s*Ó\s*R\s*D\s*Ã\s*O", text, re.IGNORECASE):
                continue
            if re.match(r"^\s*\(", text):   # "(8ª Turma)"
                continue
            if re.match(r"^[A-Z]{2,}/", text):  # "GMDMC/Fc/gl/wa"
                continue
            # Primeiro parágrafo substantivo = início da ementa
            if p.find("b") or re.match(r"^[A-Z]\)", text):
                collecting = True

        if collecting:
            ementa_parts.append(text)

    return " ".join(ementa_parts).strip()


def _extract_relator(paragraphs: list[tuple]) -> str:
    """
    O relator aparece como <b>Nome</b> no parágrafo imediatamente antes
    de 'Ministra Relatora' / 'Ministro Relator'.
    """
    for i, (p, text) in enumerate(paragraphs):
        if re.search(r"Ministr[ao][- ]Relator[a]?", text, re.IGNORECASE):
            if i > 0:
                prev_p, prev_text = paragraphs[i - 1]
                b = prev_p.find("b")
                return b.get_text(strip=True) if b else prev_text
    return "Não informado"


def _extract_data(paragraphs: list[tuple], fallback: str) -> str:
    """Extrai 'Brasília, DD de MMMM de YYYY' e converte para YYYY-MM-DD."""
    full = " ".join(t for _, t in paragraphs)
    m = re.search(
        r"Bras[íi]lia,\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})",
        full,
        re.IGNORECASE,
    )
    if m:
        day, month_name, year = m.groups()
        month = MESES.get(month_name.lower())
        if month:
            return f"{year}-{month}-{int(day):02d}"
    return fallback


def _extract_orgao(paragraphs: list[tuple]) -> str:
    for _, text in paragraphs[:6]:
        m = re.search(r"\(([^)]*Turma[^)]*|Pleno|Órgão Especial[^)]*)\)", text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return ""


def parse_html(
    html: str,
    id_hash: str,
    num_formatado: str,
    data_publicacao: str,
) -> Optional[dict]:
    try:
        soup = BeautifulSoup(html, "html.parser")
        paragraphs = _paragraphs(soup)
        if not paragraphs:
            return None

        ementa        = _extract_ementa(paragraphs) or "Ementa não disponível"
        relator       = _extract_relator(paragraphs)
        data_julg     = _extract_data(paragraphs, data_publicacao)
        inteiro_teor  = "\n".join(t for _, t in paragraphs)

        return {
            "_id":             f"tst-{id_hash}",
            "tribunal":        "TST",
            "numero":          num_formatado,
            "ementa":          ementa[:10000],
            "relator":         relator,
            "dataJulgamento":  data_julg,
            "area":            "TRABALHISTA",
            "url":             f"https://jurisprudencia.tst.jus.br/#!/resultado?id={id_hash}",
            "conteudoIntegral": inteiro_teor[:80000],
        }
    except Exception as e:
        log.warning(f"parse_html erro [{id_hash}]: {e}")
        return None

# ─── HTTP fetch com retry + circuit breaker ───────────────────────────────────

def fetch_doc(session: requests.Session, id_hash: str, delay: float) -> Optional[str]:
    url     = DOC_URL.format(id=id_hash)
    backoff = BACKOFF_BASE

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.get(url, timeout=30)

            if resp.status_code == 200:
                ct = resp.headers.get("Content-Type", "")
                if "html" not in ct.lower() and len(resp.text) < 200:
                    log.warning(f"⚠️  [{id_hash}] Resposta suspeita (CT={ct}, len={len(resp.text)})")
                    return None
                return resp.text

            if resp.status_code in (429, 500, 502, 503, 504):
                wait = backoff + random.uniform(0, backoff * 0.2)
                log.warning(f"⚠️  [{id_hash}] HTTP {resp.status_code} → retry em {wait:.1f}s (t{attempt})")
                time.sleep(wait)
                backoff = min(backoff * 2, MAX_BACKOFF)
                continue

            log.warning(f"❌ [{id_hash}] HTTP {resp.status_code} — pulando")
            return None

        except requests.exceptions.Timeout:
            log.warning(f"⏱️  [{id_hash}] Timeout (t{attempt})")
        except requests.exceptions.RequestException as e:
            log.warning(f"❌ [{id_hash}] {type(e).__name__}: {e} (t{attempt})")

        if attempt < MAX_RETRIES:
            time.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF)

    log.error(f"❌ [{id_hash}] Falhou após {MAX_RETRIES} tentativas")
    return None


def nova_sessao() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    return s

# ─── Worker ───────────────────────────────────────────────────────────────────

def worker(
    rows: list[dict],
    delay: float,
    es: Elasticsearch,
    done: set,
    counters: dict,
    lock: threading.Lock,
    batch_size: int,
    worker_id: int,
):
    session       = nova_sessao()
    buffer        = []
    fail_streak   = 0
    session_count = 0

    for row in rows:
        id_hash      = row["id_hash"]
        num_fmt      = row["num_formatado"]
        data_pub     = row["data_publicacao"]

        with lock:
            if id_hash in done:
                counters["skipped"] += 1
                continue

        # Renova sessão a cada 500 documentos
        session_count += 1
        if session_count % 500 == 0:
            session = nova_sessao()
            log.info(f"[w{worker_id}] Sessão renovada ({session_count} docs)")

        html = fetch_doc(session, id_hash, delay)

        if html is None:
            fail_streak += 1
            with lock:
                counters["failed"] += 1
            if fail_streak >= CIRCUIT_LIMIT:
                log.warning(f"[w{worker_id}] 🔴 Circuit breaker ({fail_streak} falhas) → pausa {CIRCUIT_PAUSE}s")
                time.sleep(CIRCUIT_PAUSE)
                session = nova_sessao()
                fail_streak = 0
                log.info(f"[w{worker_id}] 🟢 Retomando")
            time.sleep(delay)
            continue

        fail_streak = 0
        doc = parse_html(html, id_hash, num_fmt, data_pub)

        if doc:
            buffer.append(doc)

        with lock:
            done.add(id_hash)
            counters["processed"] += 1

        # Flush buffer
        if len(buffer) >= batch_size:
            _bulk_insert(es, buffer, lock, counters)
            buffer.clear()
            checkpoint_save(done)

        time.sleep(delay + random.uniform(0, delay * 0.3))

    # Flush restante
    if buffer:
        _bulk_insert(es, buffer, lock, counters)
        checkpoint_save(done)


def _bulk_insert(es: Elasticsearch, docs: list[dict], lock: threading.Lock, counters: dict):
    actions = [
        {"_index": ES_INDEX, "_id": d["_id"], **{k: v for k, v in d.items() if k != "_id"}}
        for d in docs
    ]
    try:
        ok, errors = helpers.bulk(es, actions, raise_on_error=False)
        with lock:
            counters["indexed"] += ok
            counters["es_errors"] += len(errors) if errors else 0
        if errors:
            log.warning(f"⚠️  Bulk: {len(errors)} erros ES")
    except Exception as e:
        log.error(f"❌ Bulk insert falhou: {e}")

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Ingestão TST → Elasticsearch")
    parser.add_argument("--workers",  type=int,   default=3)
    parser.add_argument("--delay",    type=float, default=1.0)
    parser.add_argument("--batch",    type=int,   default=100)
    parser.add_argument("--es-url",   default=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"))
    parser.add_argument("--reset",    action="store_true")
    args = parser.parse_args()

    if args.reset and CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        log.info("🗑️  Checkpoint removido")

    # Lê CSV
    if not CSV_FILE.exists():
        sys.exit(f"CSV não encontrado: {CSV_FILE}")

    with open(CSV_FILE, encoding="utf-8-sig") as f:
        all_rows = list(csv.DictReader(f))

    total = len(all_rows)
    done  = checkpoint_load()

    log.info("=" * 60)
    log.info(f"TST → ES  |  total: {total}  |  já feitos: {len(done)}")
    log.info(f"workers={args.workers}  delay={args.delay}s  batch={args.batch}")
    log.info(f"ES: {args.es_url}  índice: {ES_INDEX}")
    estimativa_h = ((total - len(done)) * args.delay) / args.workers / 3600
    log.info(f"Estimativa: ~{estimativa_h:.1f}h")
    log.info("=" * 60)

    es = Elasticsearch(args.es_url)

    # Divide as linhas entre os workers (round-robin preserva ordem)
    partitions = [all_rows[i::args.workers] for i in range(args.workers)]

    counters = {"processed": 0, "indexed": 0, "failed": 0, "skipped": 0, "es_errors": 0}
    lock     = threading.Lock()

    t_start = time.time()

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [
            executor.submit(worker, part, args.delay, es, done, counters, lock, args.batch, i + 1)
            for i, part in enumerate(partitions)
        ]
        try:
            for f in as_completed(futures):
                f.result()  # propaga exceções não tratadas
        except KeyboardInterrupt:
            log.info("\n⛔ Interrompido — checkpoint salvo")
            checkpoint_save(done)

    elapsed = time.time() - t_start
    log.info("=" * 60)
    log.info(f"Concluído em {elapsed/3600:.1f}h")
    log.info(f"  Processados : {counters['processed']}")
    log.info(f"  Indexados   : {counters['indexed']}")
    log.info(f"  Pulados     : {counters['skipped']}")
    log.info(f"  Falhas HTTP : {counters['failed']}")
    log.info(f"  Erros ES    : {counters['es_errors']}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()

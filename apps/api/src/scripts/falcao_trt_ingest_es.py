#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestão de acórdãos dos 24 TRTs via API pública do Sistema Falcão.

Estratégia: varre SEMANA a SEMANA de 2020-01-01 até hoje usando o termo
"reclamante" (presente em >99% dos acórdãos trabalhistas). A API no-auth
limita a 3 páginas por busca — com PAGE_SIZE=50 isso dá 150 docs/semana,
suficiente para a maioria das semanas dos TRTs.

Filtra client-side pelo campo 'tribunal' para manter apenas TRT1-TRT24
(exclui TST, CSJT, etc.).

Uso:
    python falcao_trt_ingest_es.py
    python falcao_trt_ingest_es.py --dry-run --semana 2020-01-06
    python falcao_trt_ingest_es.py --reset
    python falcao_trt_ingest_es.py --inicio 2023-01-01 --fim 2023-12-31
    python falcao_trt_ingest_es.py --texto "rescisao" --es-url http://localhost:9200
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import date, timedelta
from html.parser import HTMLParser
from pathlib import Path
from typing import Optional

import requests
from elasticsearch import Elasticsearch, helpers

# ── Configuração ──────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
CHECKPOINT_FILE = SCRIPT_DIR / "falcao_trt_checkpoint.json"
LOG_FILE = SCRIPT_DIR / "falcao_trt_ingest_es.log"
ES_INDEX = "jurisprudencia"

FALCAO_URL = (
    "https://jurisprudencia.jt.jus.br"
    "/jurisprudencia-nacional-backend/api/no-auth/pesquisa"
)
PAGE_SIZE = 50
MAX_PAGES = 3          # limite da API no-auth; acima disso retorna erro 403
TEXTO_PADRAO = "acórdão"   # presente em todos os documentos do tipo acórdão
DATA_INICIO_PADRAO = "2020-01-01"
DELAY_PAGINA = 1.5     # segundos entre páginas (respeito ao servidor)

MESES_PT = {
    "janeiro": "01", "fevereiro": "02", "março": "03", "marco": "03",
    "abril": "04", "maio": "05", "junho": "06", "julho": "07",
    "agosto": "08", "setembro": "09", "outubro": "10",
    "novembro": "11", "dezembro": "12",
}

# Número CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO
PROCESSO_ANO_RE = re.compile(r"\d{7}-\d{2}\.(\d{4})\.\d\.\d{2}\.\d{4}")

# ── HTML Parser ───────────────────────────────────────────────────────────────

class _FalcaoParser(HTMLParser):
    """Extrai ementa e texto completo do HTML de textoAcordao."""

    def __init__(self):
        super().__init__()
        self.ementa_parts: list[str] = []
        self.full_parts: list[str] = []
        self._cur_class = ""
        self._cur_text: list[str] = []
        self._in_p = False
        self._in_skip = False
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if self._in_skip:
            self._skip_depth += 1
            return
        if tag in ("img", "style", "script", "table", "td", "tr"):
            self._in_skip = True
            self._skip_depth = 1
            return
        if tag == "p":
            self._in_p = True
            self._cur_class = ""
            self._cur_text = []
            for name, val in attrs:
                if name == "class":
                    self._cur_class = (val or "").strip()

    def handle_endtag(self, tag):
        if self._in_skip:
            self._skip_depth -= 1
            if self._skip_depth <= 0:
                self._in_skip = False
            return
        if tag == "p" and self._in_p:
            text = " ".join("".join(self._cur_text).split()).strip()
            if text and len(text) > 2:
                self.full_parts.append(text)
                if "Ementa" in self._cur_class:
                    self.ementa_parts.append(text)
            self._in_p = False
            self._cur_class = ""
            self._cur_text = []

    def handle_data(self, data):
        if self._in_skip or not self._in_p:
            return
        self._cur_text.append(data)


def parse_html(html: str) -> tuple[str, str]:
    """Retorna (ementa, conteudo_integral) extraídos do HTML do acórdão."""
    # Remove imagens base64 antes de parsear (economiza memória)
    html = re.sub(r'src="data:[^"]{50,}"', 'src=""', html)
    parser = _FalcaoParser()
    try:
        parser.feed(html)
    except Exception:
        pass
    ementa = " ".join(parser.ementa_parts)[:5000].strip()
    conteudo = " ".join(parser.full_parts)[:80_000].strip()
    return ementa, conteudo


# ── Extração de data ───────────────────────────────────────────────────────────

def extract_date(text: str, numero_processo: str) -> Optional[str]:
    # 1. "DD de Mês de YYYY"
    m = re.search(r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})", text, re.IGNORECASE)
    if m:
        d, mes, y = m.groups()
        mo = MESES_PT.get(mes.lower())
        if mo:
            return f"{y}-{mo}-{int(d):02d}"
    # 2. DD/MM/YYYY (última ocorrência — tende a ser a data do acórdão)
    dates = re.findall(r"\b(\d{2})/(\d{2})/(\d{4})\b", text)
    if dates:
        d, mo, y = dates[-1]
        if 1 <= int(mo) <= 12:
            return f"{y}-{mo}-{d}"
    # 3. Fallback: ano do número do processo
    m2 = PROCESSO_ANO_RE.search(numero_processo or "")
    if m2:
        return f"{m2.group(1)}-01-01"
    return None


# ── Construção do documento ES ────────────────────────────────────────────────

def build_doc(item: dict) -> Optional[dict]:
    tribunal = (item.get("tribunal") or "").strip()

    # Mantém apenas TRT1-TRT24
    if not tribunal.upper().startswith("TRT"):
        return None

    numero = (item.get("numeroProcesso") or "").strip()
    relator = (item.get("relator") or "").strip()
    turma = (item.get("turma") or "").strip()
    classe = (item.get("classeProcesso") or "").strip()
    html = item.get("textoAcordao") or ""

    ementa, conteudo = parse_html(html)
    data = extract_date(conteudo, numero)

    doc_id = f"falcao-{tribunal.lower()}-{numero}" if numero else None
    if not doc_id:
        return None

    return {
        "_id": doc_id,
        "tribunal": tribunal.upper(),
        "numero": numero,
        "ementa": ementa,
        "relator": relator,
        "dataJulgamento": data,
        "area": "TRABALHISTA",
        "orgaoJulgador": turma,
        "classeProcesso": classe,
        "url": (
            "https://jurisprudencia.jt.jus.br/jurisprudencia-nacional/pesquisa"
            f"?texto={numero}&colecao=acordaos"
        ),
        "conteudoIntegral": conteudo,
    }


# ── Gerador de semanas ────────────────────────────────────────────────────────

def iter_weeks(inicio: str, fim: str):
    """Gera pares (seg, dom) para cada semana ISO do intervalo."""
    cur = date.fromisoformat(inicio)
    fim_date = date.fromisoformat(fim)
    # Recua para a segunda-feira da semana de início
    cur -= timedelta(days=cur.weekday())
    while cur <= fim_date:
        last = min(cur + timedelta(days=6), fim_date)
        yield cur.isoformat(), last.isoformat()
        cur += timedelta(days=7)


# ── HTTP ──────────────────────────────────────────────────────────────────────

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://jurisprudencia.jt.jus.br/",
    "Origin": "https://jurisprudencia.jt.jus.br",
})


def fetch_page(data_inicio: str, data_fim: str, page: int, texto: str) -> dict:
    params = {
        "sessionId": "judicore-ingest",
        "latitude": "0",
        "longitude": "0",
        "texto": texto,
        "verTodosPrecedentes": "false",
        "tribunais": "",
        "pesquisaSomenteNasEmentas": "false",
        "filtroRapidoData": "IntervaloSelecionado",
        "dataInicio": data_inicio,
        "dataFim": data_fim,
        "colecao": "acordaos",
        "page": str(page),
        "size": str(PAGE_SIZE),
    }
    for attempt in range(4):
        try:
            resp = SESSION.get(FALCAO_URL, params=params, timeout=45)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            if attempt == 3:
                raise
            wait = 10 * (attempt + 1)
            log.warning(f"  Tentativa {attempt + 1}/4 falhou ({e}) — aguarda {wait}s")
            time.sleep(wait)


def get_total(data: dict) -> int:
    """Extrai total de documentos de um response, tentando vários nomes de campo."""
    for key in ("totalElements", "total", "totalDocumentos", "count", "hits"):
        v = data.get(key)
        if isinstance(v, int):
            return v
    # Alguns backends retornam paginação aninhada
    page_info = data.get("page") or {}
    if isinstance(page_info, dict):
        for key in ("totalElements", "total", "totalPages"):
            v = page_info.get(key)
            if isinstance(v, int):
                return v
    return 0


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
        json.dumps(sorted(done), ensure_ascii=False), encoding="utf-8"
    )


# ── ES bulk ───────────────────────────────────────────────────────────────────

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


# ── Logging ───────────────────────────────────────────────────────────────────

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


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description="Ingestão Falcão TRTs → Elasticsearch")
    ap.add_argument(
        "--es-url",
        default=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"),
    )
    ap.add_argument("--batch", type=int, default=100, help="Docs por bulk insert")
    ap.add_argument("--reset", action="store_true", help="Remove checkpoint e recomeça")
    ap.add_argument("--dry-run", action="store_true", help="Extrai mas não indexa")
    ap.add_argument(
        "--semana",
        help="Processar apenas a semana que contém esta data, ex: 2020-01-06",
        metavar="YYYY-MM-DD",
    )
    ap.add_argument("--inicio", default=DATA_INICIO_PADRAO, metavar="YYYY-MM-DD")
    ap.add_argument("--fim", default=date.today().isoformat(), metavar="YYYY-MM-DD")
    ap.add_argument(
        "--texto",
        default=TEXTO_PADRAO,
        help="Termo de busca (não pode ser vazio na API no-auth)",
    )
    args = ap.parse_args()

    if args.reset and CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        log.info("Checkpoint removido")

    done = load_checkpoint()
    es = None if args.dry_run else Elasticsearch(args.es_url)

    counters = {
        "semanas": 0, "pages": 0, "docs_api": 0,
        "trt_docs": 0, "indexed": 0, "es_errors": 0,
        "skipped": 0, "cap_warnings": 0,
    }
    buffer: list[dict] = []

    if args.semana:
        ref = date.fromisoformat(args.semana)
        seg = ref - timedelta(days=ref.weekday())
        dom = seg + timedelta(days=6)
        semanas = [(seg.isoformat(), dom.isoformat())]
    else:
        semanas = list(iter_weeks(args.inicio, args.fim))

    log.info("=" * 60)
    log.info(f"Falcão TRTs → ES  |  {len(semanas)} semanas")
    log.info(f"Período: {semanas[0][0]} → {semanas[-1][1]}")
    log.info(f"Texto de busca: '{args.texto}'")
    log.info(f"Limite API: {MAX_PAGES} páginas × {PAGE_SIZE} docs = {MAX_PAGES * PAGE_SIZE} docs/semana")
    if args.dry_run:
        log.info("DRY-RUN: não indexa no ES")
    else:
        log.info(f"ES: {args.es_url}  índice: {ES_INDEX}")
    log.info("=" * 60)

    for data_inicio, data_fim in semanas:
        semana_key = data_inicio  # YYYY-MM-DD da segunda-feira

        if semana_key in done:
            counters["skipped"] += 1
            continue

        log.info(f"── {data_inicio} → {data_fim}")

        page = 0
        total_pages = None
        semana_trt = 0

        while True:
            try:
                resp = fetch_page(data_inicio, data_fim, page, args.texto)
            except Exception as e:
                log.error(f"  Erro página {page}: {e} — pulando restante da semana")
                break

            documentos = resp.get("documentos") or []

            if total_pages is None:
                total = get_total(resp)
                total_pages = max(1, -(-total // PAGE_SIZE)) if total else 1
                if total_pages > MAX_PAGES:
                    log.warning(
                        f"  AVISO: {total} docs ({total_pages} pág) excede limite "
                        f"de {MAX_PAGES} pág — alguns docs serão perdidos. "
                        f"Use --semana com intervalo menor ou --texto mais específico."
                    )
                    total_pages = MAX_PAGES
                    counters["cap_warnings"] += 1
                else:
                    log.info(f"  Total API: {total} docs → {total_pages} pág(s)")

            counters["pages"] += 1
            counters["docs_api"] += len(documentos)

            for item in documentos:
                doc = build_doc(item)
                if doc is None:
                    continue
                counters["trt_docs"] += 1
                semana_trt += 1

                if args.dry_run:
                    if counters["trt_docs"] <= 6:
                        log.info(
                            f"  [dry] {doc['tribunal']} | {doc['numero']} "
                            f"| {doc['relator'][:30]} | {doc['dataJulgamento']}"
                        )
                        log.info(f"        ementa: {doc['ementa'][:120]}")
                else:
                    buffer.append(doc)
                    if len(buffer) >= args.batch:
                        bulk_insert(es, buffer, counters)
                        buffer.clear()

            page += 1
            if not documentos or page >= total_pages:
                break

            time.sleep(DELAY_PAGINA)

        if not args.dry_run and buffer:
            bulk_insert(es, buffer, counters)
            buffer.clear()

        done.add(semana_key)
        save_checkpoint(done)
        counters["semanas"] += 1
        log.info(
            f"  ✓ {data_inicio}: {semana_trt} TRTs  "
            f"| total indexados: {counters['indexed']}"
        )

    log.info("=" * 60)
    log.info(
        f"Concluído: {counters['semanas']} semanas | "
        f"{counters['docs_api']} docs API | "
        f"{counters['trt_docs']} TRTs encontrados"
    )
    log.info(f"  Indexados      : {counters['indexed']}")
    log.info(f"  Semanas puladas: {counters['skipped']}")
    log.info(f"  Avisos de cap  : {counters['cap_warnings']}")
    log.info(f"  Erros ES       : {counters['es_errors']}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()

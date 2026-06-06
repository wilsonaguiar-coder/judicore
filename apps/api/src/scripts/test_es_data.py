#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Testes de sanidade do índice Elasticsearch após repopulação.

Verifica:
  1. Total de documentos no índice
  2. Contagem por tribunal
  3. Campos obrigatórios presentes (sem null/vazio em >90% dos docs)
  4. Distribuição de datas (sem concentração anômala)
  5. Busca por texto funciona
  6. Amostra de 3 documentos por tribunal (para inspeção visual)

Uso:
    python test_es_data.py
    python test_es_data.py --es-url http://localhost:9200
    python test_es_data.py --via-tunnel      # abre tunnel antes de testar
"""

import argparse
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

# Força UTF-8 no stdout para evitar crash em terminais Windows cp1252
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from elasticsearch import Elasticsearch

ES_INDEX = "jurisprudencia"
SSH_HOST = "2.24.75.193"
SSH_USER = "root"
SSH_KEY = os.path.expanduser("~/.ssh/judicore_vps")
REMOTE_ES_PORT = 9200
LOCAL_TUNNEL_PORT = 19200

REQUIRED_FIELDS = ["tribunal", "numero", "ementa", "dataJulgamento", "relator"]

OK  = "\033[92m[OK]\033[0m"
ERR = "\033[91m[ERRO]\033[0m"
WRN = "\033[93m[AVISO]\033[0m"
INF = "\033[94m[INFO]\033[0m"


def _wait_port(port: int, timeout: float = 20.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("localhost", port), timeout=1):
                return True
        except OSError:
            time.sleep(0.4)
    return False


def section(title: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print("=" * 60)


def check_total(es: Elasticsearch) -> int:
    section("1. Total de documentos")
    resp = es.count(index=ES_INDEX)
    total = resp["count"]
    symbol = OK if total > 1000 else ERR
    print(f"  {symbol}  Total: {total:,} documentos")
    return total


def check_por_tribunal(es: Elasticsearch) -> None:
    section("2. Contagem por tribunal")
    # Tenta tribunal.keyword; se vazio, tenta campo texto puro
    for field in ("tribunal.keyword", "tribunal"):
        resp = es.search(
            index=ES_INDEX,
            body={
                "size": 0,
                "aggs": {
                    "por_tribunal": {
                        "terms": {"field": field, "size": 50, "order": {"_count": "desc"}}
                    }
                },
            },
        )
        buckets = resp["aggregations"]["por_tribunal"]["buckets"]
        if buckets:
            break
    if not buckets:
        print(f"  {ERR}  Nenhum bucket — campo 'tribunal' pode nao ter sub-field keyword nem ser agregavel")
        return
    for b in buckets:
        bar = "█" * min(40, b["doc_count"] // max(1, buckets[0]["doc_count"] // 40))
        print(f"  {b['key']:<10}  {b['doc_count']:>7,}  {bar}")


def check_campos_obrigatorios(es: Elasticsearch) -> None:
    section("3. Campos obrigatórios preenchidos")
    total = es.count(index=ES_INDEX)["count"]
    for field in REQUIRED_FIELDS:
        missing = es.count(
            index=ES_INDEX,
            body={"query": {"bool": {"must_not": {"exists": {"field": field}}}}},
        )["count"]
        pct_ok = (1 - missing / total) * 100 if total else 0
        symbol = OK if pct_ok >= 90 else (WRN if pct_ok >= 50 else ERR)
        print(f"  {symbol}  {field:<20}  preenchido: {pct_ok:.1f}%  (vazios: {missing:,})")


def check_datas(es: Elasticsearch) -> None:
    section("4. Distribuição de anos (dataJulgamento)")
    resp = es.search(
        index=ES_INDEX,
        body={
            "size": 0,
            "aggs": {
                "por_ano": {
                    "date_histogram": {
                        "field": "dataJulgamento",
                        "calendar_interval": "year",
                        "format": "yyyy",
                        "min_doc_count": 1,
                    }
                }
            },
        },
    )
    buckets = resp["aggregations"]["por_ano"]["buckets"]
    if not buckets:
        print(f"  {WRN}  Nenhum bucket — campo 'dataJulgamento' pode não ser do tipo date")
        return
    for b in buckets:
        print(f"  {b['key_as_string']}  {b['doc_count']:>7,}")


def check_busca_texto(es: Elasticsearch) -> None:
    section("5. Busca por texto")
    termos = ["responsabilidade civil", "indenização", "contrato", "servidor público"]
    for termo in termos:
        resp = es.search(
            index=ES_INDEX,
            body={"query": {"multi_match": {"query": termo, "fields": ["ementa", "texto"]}}, "size": 1},
        )
        hits = resp["hits"]["total"]["value"]
        symbol = OK if hits > 0 else WRN
        print(f"  {symbol}  '{termo}'  ->  {hits:,} resultado(s)")


def check_amostras(es: Elasticsearch) -> None:
    section("6. Amostra de documentos por tribunal")
    resp = es.search(
        index=ES_INDEX,
        body={
            "size": 0,
            "aggs": {
                "tribunais": {
                    "terms": {"field": "tribunal.keyword", "size": 30},
                    "aggs": {
                        "sample": {"top_hits": {"size": 1, "_source": REQUIRED_FIELDS + ["area", "url"]}}
                    },
                }
            },
        },
    )
    for b in resp["aggregations"]["tribunais"]["buckets"]:
        tribunal = b["key"]
        hits = b["sample"]["hits"]["hits"]
        if not hits:
            continue
        src = hits[0]["_source"]
        ementa_preview = (src.get("ementa") or "")[:120].replace("\n", " ")
        print(f"\n  [{tribunal}]")
        print(f"    Processo : {src.get('numero', '—')}")
        print(f"    Data     : {src.get('dataJulgamento', '—')}")
        print(f"    Relator  : {src.get('relator', '—')}")
        print(f"    Área     : {src.get('area', '—')}")
        print(f"    Ementa   : {ementa_preview}...")


def main() -> None:
    ap = argparse.ArgumentParser(description="Testa sanidade dos dados no Elasticsearch")
    ap.add_argument("--es-url", default=f"http://localhost:{LOCAL_TUNNEL_PORT}")
    ap.add_argument("--via-tunnel", action="store_true", help="Abre tunnel SSH antes de testar")
    args = ap.parse_args()

    tunnel = None
    if args.via_tunnel:
        print(f"Abrindo tunnel SSH: localhost:{LOCAL_TUNNEL_PORT} -> {SSH_HOST}:{REMOTE_ES_PORT}")
        tunnel = subprocess.Popen(
            [
                "ssh", "-N", "-i", SSH_KEY,
                "-L", f"{LOCAL_TUNNEL_PORT}:localhost:{REMOTE_ES_PORT}",
                "-o", "StrictHostKeyChecking=no",
                "-o", "ServerAliveInterval=30",
                f"{SSH_USER}@{SSH_HOST}",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if not _wait_port(LOCAL_TUNNEL_PORT):
            tunnel.terminate()
            sys.exit("ERRO: tunnel não ficou pronto.")
        print("Tunnel ativo.\n")

    try:
        es = Elasticsearch(args.es_url)
        if not es.ping():
            sys.exit(f"ERRO: não conseguiu conectar em {args.es_url}")

        print(f"\nConectado: {args.es_url}  |  índice: {ES_INDEX}")

        total = check_total(es)
        if total == 0:
            print(f"\n{ERR} Índice vazio — nada a testar.")
            return

        check_por_tribunal(es)
        check_campos_obrigatorios(es)
        check_datas(es)
        check_busca_texto(es)
        check_amostras(es)

        print(f"\n{'=' * 60}")
        print(f"  Testes concluídos  |  {total:,} documentos no índice")
        print("=" * 60)

    finally:
        if tunnel:
            tunnel.terminate()
            try:
                tunnel.wait(timeout=3)
            except subprocess.TimeoutExpired:
                tunnel.kill()
            print("\nTunnel fechado.")


if __name__ == "__main__":
    main()

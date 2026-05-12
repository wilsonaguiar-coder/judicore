#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coletor de Jurisprudência do TST
Extrai: ID (hash) e Data de Publicação → CSV
Período: 01/01/2020 até hoje
API: https://jurisprudencia-backend2.tst.jus.br/rest/pesquisa-textual
"""

import requests
import csv
import json
import time
import random
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, List

# ================= CONFIGURAÇÕES =================
BASE_URL = "https://jurisprudencia-backend2.tst.jus.br/rest/pesquisa-textual"
HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Origin": "https://jurisprudencia.tst.jus.br",
    "Referer": "https://jurisprudencia.tst.jus.br/"
}

DELAY_BASE  = 12.0   # segundos entre páginas (TST bloqueia com < 10s)
DELAY_DAY   = 120.0  # pausa entre meses (resetar rate limit)
DELAY_BATCH = 90.0   # pausa extra a cada BATCH_SIZE páginas dentro do mês
BATCH_SIZE  = 7      # páginas antes de pausar (TST bloqueia após ~7-8)
MAX_DELAY   = 60.0
BACKOFF_MULTIPLIER = 2.0
MAX_TENTATIVAS = 5
TIMEOUT = 45

CHECKPOINT_FILE = "tst_checkpoint.json"
OUTPUT_CSV = "tst_jurisprudencia_id_data.csv"


def criar_payload(data_inicio: str, data_fim: str) -> dict:
    return {
        "ou": None, "e": None, "termoExato": "", "naoContem": None,
        "ementa": None, "dispositivo": None,
        "numeracaoUnica": {
            "numero": None, "digito": None, "ano": None,
            "orgao": "", "tribunal": None, "vara": None
        },
        "orgaosJudicantes": [], "ministros": [], "convocados": [],
        "classesProcessuais": [
            {"codFase": "RR",  "desFase": "Recurso de Revista"},
            {"codFase": "RO",  "desFase": "Recurso Ordinário"},
            {"codFase": "ROT", "desFase": "Recurso Ordinário Trabalhista"},
        ],
        "indicadores": [], "assuntos": [],
        "tipos": ["ACORDAO", "SUM"],
        "orgao": "TST",
        "publicacaoInicial": data_inicio,
        "publicacaoFinal": data_fim
    }


def requisitar_com_backoff(pagina: int, tamanho: int, payload: dict) -> Optional[dict]:
    delay = DELAY_BASE
    url = f"{BASE_URL}/{pagina}/{tamanho}"
    params = {"a": f"{random.random():.16f}"}

    for tentativa in range(MAX_TENTATIVAS):
        try:
            response = requests.post(
                url, json=payload, headers=HEADERS,
                params=params, timeout=TIMEOUT
            )

            if response.status_code == 200:
                return response.json()

            if response.status_code in [429, 500, 502, 503, 504]:
                wait = delay + random.uniform(0, delay * 0.2)
                print(f"  ⚠️  HTTP {response.status_code} | Aguardando {wait:.1f}s (tentativa {tentativa+1})")
                time.sleep(wait)
                delay = min(delay * BACKOFF_MULTIPLIER, MAX_DELAY)
                continue

            if 400 <= response.status_code < 500:
                print(f"  ❌ Erro cliente {response.status_code}: {response.text[:200]}")
                return None

        except requests.exceptions.Timeout:
            print(f"  ⏱️  Timeout (tentativa {tentativa+1}/{MAX_TENTATIVAS})")
        except requests.exceptions.RequestException as e:
            print(f"  ❌ Erro de rede: {type(e).__name__}: {e}")

        if tentativa < MAX_TENTATIVAS - 1:
            time.sleep(delay)

    print(f"  ❌ Falha após {MAX_TENTATIVAS} tentativas na página {pagina}")
    return None


def carregar_checkpoint() -> Dict:
    if Path(CHECKPOINT_FILE).exists():
        try:
            with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def salvar_checkpoint(checkpoint: Dict):
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump(checkpoint, f, indent=2, ensure_ascii=False)


def extrair_dados(registro: dict) -> Optional[Dict]:
    reg = registro.get("registro", {})
    doc_id = reg.get("id")
    if not doc_id:
        return None
    return {
        "id_hash": doc_id,
        "data_publicacao": (reg.get("dtaPublicacao") or "")[:10],
        "numero_processo": reg.get("numero"),
        "num_formatado": reg.get("numFormatado") or "",
    }


def carregar_ids_existentes() -> set:
    """Carrega todos os IDs já gravados no CSV para deduplicação."""
    ids = set()
    if not Path(OUTPUT_CSV).exists():
        return ids
    with open(OUTPUT_CSV, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("id_hash"):
                ids.add(row["id_hash"])
    return ids


def salvar_em_csv(dados: List[Dict], ids_vistos: set) -> int:
    """Salva registros novos no CSV, ignorando duplicatas. Retorna quantos foram salvos."""
    novos = [d for d in dados if d["id_hash"] not in ids_vistos]
    if not novos:
        return 0
    fieldnames = list(novos[0].keys())
    file_exists = Path(OUTPUT_CSV).exists()
    with open(OUTPUT_CSV, "a", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerows(novos)
    for d in novos:
        ids_vistos.add(d["id_hash"])
    return len(novos)


def processar_dia(data_str: str, checkpoint: Dict, ids_vistos: set, dry_run: bool = False,
                  inicio_override: str = None, fim_override: str = None, chave_override: str = None) -> int:
    chave  = chave_override or data_str
    inicio = inicio_override or data_str
    fim    = fim_override    or data_str

    entrada = checkpoint.get(chave, {})
    paginas_feitas = entrada.get("paginas_feitas", 0) if isinstance(entrada, dict) else 0
    paginas_total  = entrada.get("paginas_total",  0) if isinstance(entrada, dict) else 0

    if paginas_total > 0 and paginas_feitas >= paginas_total:
        print(f"  ⏭️  {chave}: já coletado ({paginas_feitas}/{paginas_total} págs)")
        return 0

    payload = criar_payload(inicio, fim)
    res_inicial = requisitar_com_backoff(pagina=1, tamanho=1, payload=payload)
    if not res_inicial or "totalRegistros" not in res_inicial:
        print(f"  ❌ Não foi possível obter total para {data_str}")
        return 0

    total_registros = res_inicial["totalRegistros"]
    if total_registros == 0:
        print(f"  ⚪ {chave}: sem registros")
        checkpoint[chave] = {"paginas_total": 0, "paginas_feitas": 0}
        salvar_checkpoint(checkpoint)
        return 0

    total_paginas  = (total_registros + 99) // 100
    pag_inicio     = paginas_feitas + 1
    print(f"  📊 {chave}: {total_registros} docs brutos | {total_paginas} págs | Retomando da pág {pag_inicio}")

    if dry_run:
        checkpoint[chave] = {"paginas_total": total_paginas, "paginas_feitas": total_paginas}
        salvar_checkpoint(checkpoint)
        return total_registros

    registros_coletados = 0

    for pagina in range(pag_inicio, total_paginas + 1):
        print(f"    📄 Página {pagina}/{total_paginas}...", end=" ", flush=True)
        resultado = requisitar_com_backoff(pagina, 100, payload)

        if not resultado or "registros" not in resultado:
            print("❌ Falha — salvando checkpoint e abortando este mês")
            checkpoint[chave] = {"paginas_total": total_paginas, "paginas_feitas": pagina - 1}
            salvar_checkpoint(checkpoint)
            return registros_coletados

        dados = [extrair_dados(r) for r in resultado.get("registros", []) if extrair_dados(r)]
        salvos = salvar_em_csv(dados, ids_vistos) if dados else 0
        registros_coletados += salvos
        total_pagina = len(resultado.get("registros", []))
        print(f"✓ +{salvos} (de {total_pagina} — dupl: {len(dados) - salvos})")

        checkpoint[chave] = {"paginas_total": total_paginas, "paginas_feitas": pagina}
        salvar_checkpoint(checkpoint)

        if pagina < total_paginas:
            if pagina % BATCH_SIZE == 0:
                print(f"  😴 Pausa anti-rate-limit ({DELAY_BATCH:.0f}s) após {pagina} páginas...")
                time.sleep(DELAY_BATCH + random.uniform(0, 10))
            else:
                time.sleep(DELAY_BASE + random.uniform(0, 1.5))

    print(f"  ✅ {chave}: {registros_coletados} docs coletados")
    return registros_coletados


def coletar_periodo(data_inicio: str, data_fim: str, dry_run: bool = False):
    print(f"\n{'='*60}")
    print(f"TST Jurisprudência — Coleta {'[DRY-RUN] ' if dry_run else ''}de IDs (janela mensal)")
    print(f"Período: {data_inicio} → {data_fim}")
    print(f"CSV: {OUTPUT_CSV} | Checkpoint: {CHECKPOINT_FILE}")
    print(f"{'='*60}\n")

    checkpoint   = carregar_checkpoint()
    ids_vistos   = carregar_ids_existentes()
    print(f"IDs já no CSV: {len(ids_vistos)}")

    dt_inicio = datetime.strptime(data_inicio, "%Y-%m-%d")
    dt_fim    = datetime.strptime(data_fim,    "%Y-%m-%d")
    # Começa no primeiro dia do mês inicial
    dt_atual  = dt_inicio.replace(day=1)
    total_geral  = 0
    meses_feitos = 0

    while dt_atual <= dt_fim:
        # Último dia do mês corrente
        if dt_atual.month == 12:
            ultimo = dt_atual.replace(day=31)
        else:
            ultimo = dt_atual.replace(month=dt_atual.month + 1, day=1) - timedelta(days=1)
        fim_janela = min(ultimo, dt_fim)

        inicio_str = dt_atual.strftime("%Y-%m-%d")
        fim_str    = fim_janela.strftime("%Y-%m-%d")
        chave      = dt_atual.strftime("%Y-%m")  # chave do checkpoint: YYYY-MM

        # Avança para o próximo mês
        if dt_atual.month == 12:
            dt_atual = dt_atual.replace(year=dt_atual.year + 1, month=1, day=1)
        else:
            dt_atual = dt_atual.replace(month=dt_atual.month + 1, day=1)

        # Usa chave mensal no checkpoint
        entrada = checkpoint.get(chave, {})
        if isinstance(entrada, dict) and entrada.get("paginas_total", 0) > 0 and \
                entrada.get("paginas_feitas", 0) >= entrada.get("paginas_total", 0):
            print(f"  ⏭️  {chave}: já coletado")
            continue

        # Reutiliza processar_dia com janela mensal
        count = processar_dia(f"{chave}-01", checkpoint, ids_vistos, dry_run,
                              inicio_override=inicio_str, fim_override=fim_str, chave_override=chave)
        total_geral  += count
        meses_feitos += 1

        if meses_feitos % 6 == 0:
            csv_lines = sum(1 for _ in open(OUTPUT_CSV, encoding="utf-8-sig")) - 1 if Path(OUTPUT_CSV).exists() else 0
            print(f"\n  📈 {meses_feitos} meses | {total_geral} coletados nesta sessão | CSV total: {csv_lines}\n")

        if count > 0 and dt_atual <= dt_fim:
            print(f"  💤 Pausa de {DELAY_DAY:.0f}s entre meses...")
            time.sleep(DELAY_DAY + random.uniform(0, 10))

    csv_total = 0
    if Path(OUTPUT_CSV).exists():
        with open(OUTPUT_CSV, encoding="utf-8-sig") as f:
            csv_total = sum(1 for _ in f) - 1  # desconta header

    print(f"\n{'='*60}")
    print(f"{'COLETA CONCLUIDA' if not dry_run else 'DRY-RUN CONCLUIDO'}")
    print(f"Registros nesta sessão: {total_geral}")
    print(f"Total no CSV:           {csv_total}")
    print(f"{'='*60}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Coletor de Jurisprudência TST")
    parser.add_argument("--inicio", default="2020-01-01", help="Data inicial (YYYY-MM-DD)")
    parser.add_argument("--fim",    default=datetime.now().strftime("%Y-%m-%d"), help="Data final (YYYY-MM-DD)")
    parser.add_argument("--dry-run",  action="store_true", help="Simular sem salvar dados")
    parser.add_argument("--reset",    action="store_true", help="Limpar checkpoint e recomeçar")

    args = parser.parse_args()

    if args.reset and Path(CHECKPOINT_FILE).exists():
        Path(CHECKPOINT_FILE).unlink()
        print(f"Checkpoint removido: {CHECKPOINT_FILE}")

    coletar_periodo(args.inicio, args.fim, args.dry_run)

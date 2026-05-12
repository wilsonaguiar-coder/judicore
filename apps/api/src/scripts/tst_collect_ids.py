#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coletor de Jurisprudência do TST - VERSÃO PRODUÇÃO
Extrai ID (hash) e Data de Publicação de ACORDÃOS RR, RO e ROT
Filtro aplicado LOCALMENTE (API não suporta filtro de classe)
Janela diária → evita paginação quebrada do TST (cada dia = ~1 página)
API: https://jurisprudencia-backend2.tst.jus.br/rest/pesquisa-textual
"""

import requests
import csv
import json
import time
import random
import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, List, Set

# ================= CONFIGURAÇÕES GLOBAIS =================
BASE_URL = "https://jurisprudencia-backend2.tst.jus.br/rest/pesquisa-textual"

HEADERS = {
    "Content-Type": "application/json",
    "Accept": "*/*",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Origin": "https://jurisprudencia.tst.jus.br",
    "Referer": "https://jurisprudencia.tst.jus.br/",
    "X-Requested-With": "XMLHttpRequest",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
}

PAGE_SIZE    = 1000   # registros por página (API suporta 1000 com timeout=90s)

DELAY_BASE   = 5.0    # segundos entre dias
DELAY_EXTRA  = 60.0   # pausa extra para dias com mais de 1 página
DELAY_BATCH  = 90.0   # pausa a cada BATCH_SIZE páginas
BATCH_SIZE   = 7
MAX_DELAY    = 60.0
BACKOFF_MULTIPLIER = 2.0
MAX_TENTATIVAS = 5
TIMEOUT = 90          # aumentado para acomodar respostas com 500 registros

# Circuit breaker: detecta bloqueio silencioso da API
CIRCUIT_BREAKER_LIMITE = 3    # páginas consecutivas com poucos registros
CIRCUIT_MIN_BRUTOS     = 5    # abaixo disso considera "suspeito"
CIRCUIT_PAUSA          = 300  # segundos de pausa ao acionar

CHECKPOINT_FILE = "tst_checkpoint.json"
OUTPUT_CSV      = "tst_jurisprudencia_rr_ro_rot.csv"
LOG_FILE        = "tst_coleta.log"


# ================= FILTRO LOCAL =================

def eh_recurso_desejado(registro: dict) -> bool:
    """Filtra RR, RO e ROT localmente via codFase, com fallback em numFormatado."""
    reg = registro.get("registro", {})
    cod_fase = (reg.get("codFase") or "").strip()
    if cod_fase in {"RR", "RO", "ROT"}:
        return True
    num_fmt = (reg.get("numFormatado") or "").upper().strip()
    return num_fmt.startswith("RR ") or num_fmt.startswith("RO ") or num_fmt.startswith("ROT ")


# ================= REQUISIÇÃO =================

CLASSES_PROCESSUAIS = [
    {"codFase": "RR",  "desFase": "Recurso de Revista"},
    {"codFase": "RO",  "desFase": "Recurso Ordinário"},
    {"codFase": "ROT", "desFase": "Recurso Ordinário Trabalhista"},
]


def criar_payload(data_inicio: str, data_fim: str) -> dict:
    """Payload com filtro de classe no formato exato do site — validado via F12."""
    return {
        "ou": None, "e": None, "termoExato": "", "naoContem": None,
        "ementa": None, "dispositivo": None,
        "numeracaoUnica": {
            "numero": None, "digito": None, "ano": None,
            "orgao": "", "tribunal": None, "vara": None
        },
        "orgaosJudicantes": [], "ministros": [], "convocados": [],
        "classesProcessuais": CLASSES_PROCESSUAIS,
        "indicadores": [], "assuntos": [],
        "tipos": ["ACORDAO"],
        "orgao": "TST",
        "publicacaoInicial": data_inicio,
        "publicacaoFinal": data_fim,
        "ordenacao": None,
    }


def nova_sessao() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    try:
        s.get("https://jurisprudencia.tst.jus.br/", timeout=10)
    except Exception:
        pass
    return s


def requisitar(sessao: requests.Session, pagina: int, tamanho: int, payload: dict) -> Optional[dict]:
    delay = DELAY_BASE
    url = f"{BASE_URL}/{pagina}/{tamanho}"

    for tentativa in range(MAX_TENTATIVAS):
        try:
            response = sessao.post(url, json=payload, timeout=TIMEOUT)

            if response.status_code == 200:
                # Detecta resposta HTML (bloqueio silencioso)
                content_type = response.headers.get("Content-Type", "")
                if "html" in content_type.lower():
                    log(f"⚠️  Resposta HTML na p{pagina} — possível bloqueio | CT: {content_type}")
                    return None

                try:
                    data = response.json()
                except json.JSONDecodeError:
                    log(f"❌ JSON inválido na p{pagina} | início: {response.text[:150]!r}")
                    return None

                if not isinstance(data, dict):
                    log(f"⚠️  Resposta não é dict na p{pagina}: {type(data).__name__}")
                    return None

                # Valida chaves esperadas
                if "registros" not in data and "totalRegistros" not in data:
                    log(f"⚠️  Estrutura inesperada na p{pagina} | chaves: {list(data.keys())}")
                    return None

                return data

            if response.status_code in [429, 500, 502, 503, 504]:
                wait = delay + random.uniform(0, delay * 0.2)
                log(f"⚠️  HTTP {response.status_code} | Retry em {wait:.1f}s (tentativa {tentativa+1})")
                time.sleep(wait)
                delay = min(delay * BACKOFF_MULTIPLIER, MAX_DELAY)
                continue

            if 400 <= response.status_code < 500:
                log(f"❌ Erro cliente {response.status_code}: {response.text[:200]}")
                return None

        except requests.exceptions.Timeout:
            log(f"⏱️  Timeout na p{pagina} (tentativa {tentativa+1})")
        except requests.exceptions.RequestException as e:
            log(f"❌ Erro de rede: {type(e).__name__}: {e}")

        if tentativa < MAX_TENTATIVAS - 1:
            time.sleep(delay)

    log(f"❌ Falha após {MAX_TENTATIVAS} tentativas na p{pagina}")
    return None


# ================= LOG E PERSISTÊNCIA =================

def log(mensagem: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    linha = f"[{timestamp}] {mensagem}"
    print(linha, flush=True)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(linha + "\n")
    except Exception:
        pass


def carregar_checkpoint() -> Dict:
    if Path(CHECKPOINT_FILE).exists():
        try:
            with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log(f"⚠️  Erro ao carregar checkpoint: {e}")
    return {}


def salvar_checkpoint(checkpoint: Dict):
    try:
        with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
            json.dump(checkpoint, f, indent=2, ensure_ascii=False)
    except Exception as e:
        log(f"❌ Erro ao salvar checkpoint: {e}")


def extrair_dados(registro: dict) -> Optional[Dict]:
    if not eh_recurso_desejado(registro):
        return None
    reg = registro.get("registro", {})
    doc_id = reg.get("id")
    if not doc_id:
        return None
    return {
        "id_hash":         doc_id,
        "data_publicacao": (reg.get("dtaPublicacao") or "")[:10],
        "numero_processo": reg.get("numero"),
        "num_formatado":   reg.get("numFormatado") or "",
        "cod_fase":        reg.get("codFase") or "",
    }


def carregar_ids_existentes() -> Set[str]:
    ids: Set[str] = set()
    if not Path(OUTPUT_CSV).exists():
        return ids
    try:
        with open(OUTPUT_CSV, encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                if row.get("id_hash"):
                    ids.add(row["id_hash"])
    except Exception as e:
        log(f"⚠️  Erro ao carregar IDs existentes: {e}")
    return ids


def salvar_em_csv(dados: List[Dict], ids_vistos: Set[str]) -> int:
    novos = [d for d in dados if d["id_hash"] not in ids_vistos]
    if not novos:
        return 0
    fieldnames = list(novos[0].keys())
    file_exists = Path(OUTPUT_CSV).exists()
    try:
        with open(OUTPUT_CSV, "a", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            if not file_exists:
                writer.writeheader()
            writer.writerows(novos)
        for d in novos:
            ids_vistos.add(d["id_hash"])
        return len(novos)
    except Exception as e:
        log(f"❌ Erro ao salvar CSV: {e}")
        return 0


def log_fases(registros: list, prefixo: str = ""):
    """Loga distribuição de codFase para debugging."""
    fases: Dict[str, int] = {}
    for r in registros:
        fase = (r.get("registro", {}).get("codFase") or "N/A").strip()
        fases[fase] = fases.get(fase, 0) + 1
    log(f"  {prefixo}codFase: {dict(sorted(fases.items()))}")


# ================= CIRCUIT BREAKER =================

def checar_circuit_breaker(brutos: int, contador: list, sessao_ref: list) -> None:
    """
    contador = [int]  — lista mutável com contagem de páginas suspeitas consecutivas.
    sessao_ref = [Session] — lista mutável; circuit breaker pode trocar a sessão.
    """
    if brutos <= CIRCUIT_MIN_BRUTOS:
        contador[0] += 1
        if contador[0] >= CIRCUIT_BREAKER_LIMITE:
            log(f"🔴 CIRCUIT BREAKER: {contador[0]} páginas com ≤{CIRCUIT_MIN_BRUTOS} registros "
                f"→ pausando {CIRCUIT_PAUSA}s e renovando sessão")
            time.sleep(CIRCUIT_PAUSA)
            sessao_ref[0] = nova_sessao()
            contador[0] = 0
            log("🟢 Sessão renovada, retomando coleta")
    else:
        contador[0] = 0


# ================= COLETA POR DIA =================

def processar_dia(data_str: str, checkpoint: Dict, ids_vistos: Set[str],
                  sessao_ref: list, cb_contador: list, dry_run: bool = False) -> int:
    """
    sessao_ref  = [Session] — sessão compartilhada; circuit breaker pode trocar.
    cb_contador = [int]     — contador persistente de páginas suspeitas entre dias.
    """
    entrada = checkpoint.get(data_str, {})
    paginas_feitas = entrada.get("paginas_feitas", 0) if isinstance(entrada, dict) else 0
    paginas_total  = entrada.get("paginas_total",  0) if isinstance(entrada, dict) else 0

    if paginas_total > 0 and paginas_feitas >= paginas_total:
        return 0  # já coletado, pula silenciosamente

    payload = criar_payload(data_str, data_str)

    res_p1 = requisitar(sessao_ref[0], 1, PAGE_SIZE, payload)
    if not res_p1 or "totalRegistros" not in res_p1:
        log(f"❌ {data_str}: sem resposta válida da API")
        if res_p1:
            log(f"   chaves recebidas: {list(res_p1.keys())}")
        return 0

    total_registros = res_p1["totalRegistros"]
    if total_registros == 0:
        checkpoint[data_str] = {"paginas_total": 0, "paginas_feitas": 0}
        salvar_checkpoint(checkpoint)
        return 0

    total_paginas = (total_registros + PAGE_SIZE - 1) // PAGE_SIZE
    if total_paginas > 1:
        log(f"  📊 {data_str}: {total_registros} brutos | {total_paginas} págs")

    if dry_run:
        checkpoint[data_str] = {"paginas_total": total_paginas, "paginas_feitas": total_paginas}
        salvar_checkpoint(checkpoint)
        return total_registros

    registros_coletados = 0
    paginas_para_processar = [(1, res_p1)] + [(p, None) for p in range(max(2, paginas_feitas + 1), total_paginas + 1)]

    for pagina, resultado_pre in paginas_para_processar:
        if pagina < paginas_feitas + 1:
            continue

        resultado = resultado_pre or requisitar(sessao_ref[0], pagina, PAGE_SIZE, payload)
        if not resultado or "registros" not in resultado:
            log(f"❌ {data_str} p{pagina}: falha — salvando checkpoint")
            if resultado:
                log(f"   chaves recebidas: {list(resultado.keys())}")
            checkpoint[data_str] = {"paginas_total": total_paginas, "paginas_feitas": pagina - 1}
            salvar_checkpoint(checkpoint)
            return registros_coletados

        brutos = resultado.get("registros", [])

        # Circuit breaker: detecta bloqueio silencioso
        checar_circuit_breaker(len(brutos), cb_contador, sessao_ref)

        # Log de codFase nos dias com múltiplas páginas (ajuda a calibrar o filtro)
        if total_paginas > 1 and pagina <= 2:
            log_fases(brutos, prefixo=f"p{pagina} ")

        dados  = [extrair_dados(r) for r in brutos if extrair_dados(r)]
        salvos = salvar_em_csv(dados, ids_vistos) if dados else 0
        registros_coletados += salvos

        if salvos > 0 or total_paginas > 1:
            log(f"  📄 {data_str} p{pagina}/{total_paginas}: +{salvos} (de {len(brutos)} brutos, {len(dados)} RR/RO/ROT)")

        checkpoint[data_str] = {"paginas_total": total_paginas, "paginas_feitas": pagina}
        salvar_checkpoint(checkpoint)

        if pagina < total_paginas:
            if pagina % BATCH_SIZE == 0:
                log(f"  😴 Pausa anti-rate-limit ({DELAY_BATCH:.0f}s)...")
                time.sleep(DELAY_BATCH + random.uniform(0, 10))
            else:
                time.sleep(DELAY_EXTRA + random.uniform(0, 5))

    return registros_coletados


# ================= LOOP PRINCIPAL =================

def coletar_periodo(data_inicio: str, data_fim: str, dry_run: bool = False):
    log(f"\n{'='*60}")
    log(f"TST Jurisprudência — RR/RO/ROT {'[DRY-RUN] ' if dry_run else ''}(janela diária)")
    log(f"Período: {data_inicio} → {data_fim}")
    log(f"CSV: {OUTPUT_CSV} | Checkpoint: {CHECKPOINT_FILE}")
    log(f"{'='*60}")

    checkpoint = carregar_checkpoint()
    ids_vistos = carregar_ids_existentes()
    log(f"IDs já no CSV: {len(ids_vistos)}")

    # Sessão compartilhada entre dias — encapsulada em lista para mutação pelo circuit breaker
    sessao_ref  = [nova_sessao()]
    cb_contador = [0]  # contador persistente do circuit breaker

    dt_atual = datetime.strptime(data_inicio, "%Y-%m-%d")
    dt_fim   = datetime.strptime(data_fim,    "%Y-%m-%d")
    total_geral = 0
    dias_feitos = 0

    while dt_atual <= dt_fim:
        data_str  = dt_atual.strftime("%Y-%m-%d")
        dt_atual += timedelta(days=1)

        count = processar_dia(data_str, checkpoint, ids_vistos, sessao_ref, cb_contador, dry_run)
        if count > 0:
            total_geral += count
            log(f"  ✅ {data_str}: +{count} | total: {total_geral}")

        dias_feitos += 1
        if dias_feitos % 100 == 0:
            csv_lines = sum(1 for _ in open(OUTPUT_CSV, encoding="utf-8-sig")) - 1 if Path(OUTPUT_CSV).exists() else 0
            log(f"\n📈 {dias_feitos} dias | {total_geral} nesta sessão | CSV total: {csv_lines}\n")

        time.sleep(DELAY_BASE + random.uniform(0, 1))

    csv_total = sum(1 for _ in open(OUTPUT_CSV, encoding="utf-8-sig")) - 1 if Path(OUTPUT_CSV).exists() else 0
    log(f"\n{'='*60}")
    log(f"{'CONCLUÍDO' if not dry_run else 'DRY-RUN CONCLUÍDO'}")
    log(f"Nesta sessão: {total_geral} | Total CSV: {csv_total}")
    log(f"{'='*60}")


# ================= EXECUÇÃO =================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Coletor TST RR/RO/ROT — janela diária")
    parser.add_argument("--inicio", default="2020-01-01")
    parser.add_argument("--fim",    default=datetime.now().strftime("%Y-%m-%d"))
    parser.add_argument("--dry-run",       action="store_true")
    parser.add_argument("--reset",         action="store_true")
    parser.add_argument("--testar-filtro", action="store_true", help="Testa filtro em 1 página e sai")

    args = parser.parse_args()

    if args.reset and Path(CHECKPOINT_FILE).exists():
        Path(CHECKPOINT_FILE).unlink()
        log(f"🗑️  Checkpoint removido")

    if args.testar_filtro:
        log("🧪 Testando filtro local em 1 página (2020-01-07)...")
        sessao  = nova_sessao()
        payload = criar_payload("2020-01-07", "2020-01-07")
        resp    = requisitar(sessao, 1, 20, payload)
        if resp and "registros" in resp:
            total  = len(resp["registros"])
            passou = sum(1 for r in resp["registros"] if eh_recurso_desejado(r))
            log(f"✅ {total} brutos | {passou} passaram no filtro ({passou/total*100:.1f}%)")
            log_fases(resp["registros"])
            for i, reg in enumerate(resp["registros"][:5], 1):
                r       = reg.get("registro", {})
                num_fmt = r.get("numFormatado", "N/A")
                cod     = r.get("codFase", "?")
                ok      = "✅" if eh_recurso_desejado(reg) else "❌"
                log(f"  {ok} {i}. {num_fmt[:50]} | codFase: {cod}")
        else:
            log("❌ Falha ao buscar página de teste")
            if resp:
                log(f"   chaves recebidas: {list(resp.keys())}")
        sys.exit(0)

    coletar_periodo(args.inicio, args.fim, args.dry_run)

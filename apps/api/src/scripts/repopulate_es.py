#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Repopula o Elasticsearch do VPS a partir dos dados locais em temp/base_es/.

Abre um tunnel SSH (localhost:19200 -> VPS:9200) e roda todos os scripts
de ingestão em sequência. Os dados nunca saem deste PC — apenas os
documentos indexados trafegam pelo tunnel.

Uso:
    python repopulate_es.py                     # tudo
    python repopulate_es.py --source tst        # só TST
    python repopulate_es.py --source trf1,trf2  # TRF1 e TRF2
    python repopulate_es.py --dry-run           # extrai mas não indexa
    python repopulate_es.py --reset             # ignora checkpoints
    python repopulate_es.py --list              # lista fontes disponíveis

Fontes disponíveis (nome como passado em --source):
    tst, trf1, trf2, trf4, trf5, trf6,
    tjac, tjba, tjce, tjdft, tjes, tjgo, tjmg,
    tjpa, tjpi, tjrn, tjrr, tjrs, tjsc,
    falcao  (baixa via API pública — sem arquivo local)
"""

import argparse
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

# ── Configuração SSH ──────────────────────────────────────────────────────────

SSH_HOST = "2.24.75.193"
SSH_USER = "root"
SSH_KEY = os.path.expanduser("~/.ssh/judicore_vps")
REMOTE_ES_PORT = 9200
LOCAL_TUNNEL_PORT = 19200

# ── Caminhos ──────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent   # d:/backup/judicore
BASE_ES = PROJECT_ROOT / "temp" / "base_es"

# ── Mapeamento fonte -> (script, pasta_local) ─────────────────────────────────
# pasta_local=None significa que o script não usa --folder (baixa da rede)

SOURCES: dict[str, tuple[str, Path | None]] = {
    # TRFs
    "trf1": ("trf1_ingest_es.py", BASE_ES / "trfs" / "trf1"),
    "trf2": ("trf2_ingest_es.py", BASE_ES / "trfs" / "trf2"),
    "trf4": ("trf4_ingest_es.py", BASE_ES / "trfs" / "trf4"),
    "trf5": ("trf5_ingest_es.py", BASE_ES / "trfs" / "trf5"),
    "trf6": ("trf6_ingest_es.py", BASE_ES / "trfs" / "trf6"),
    # TJs
    "tjac":  ("tjac_ingest_es.py",  BASE_ES / "tjs" / "tjac"),
    "tjba":  ("tjba_ingest_es.py",  BASE_ES / "tjs" / "tjba"),
    "tjce":  ("tjce_ingest_es.py",  BASE_ES / "tjs" / "tjce"),
    "tjdft": ("tjdft_ingest_es.py", BASE_ES / "tjs" / "tjdft"),
    "tjes":  ("tjes_ingest_es.py",  BASE_ES / "tjs" / "tjes"),
    "tjgo":  ("tjgo_ingest_es.py",  BASE_ES / "tjs" / "tjgo"),
    "tjmg":  ("tjmg_ingest_es.py",  BASE_ES / "tjs" / "tjmg"),
    "tjpa":  ("tjpa_ingest_es.py",  BASE_ES / "tjs" / "tjpa"),
    "tjpi":  ("tjpi_ingest_es.py",  BASE_ES / "tjs" / "tjpi"),
    "tjrn":  ("tjrn_ingest_es.py",  BASE_ES / "tjs" / "tjrn"),
    "tjrr":  ("tjrr_ingest_es.py",  BASE_ES / "tjs" / "tjrr"),
    "tjrs":  ("tjrs_ingest_es.py",  BASE_ES / "tjs" / "tjrs"),
    "tjsc":  ("tjsc_ingest_es.py",  BASE_ES / "tjs" / "tjsc"),
    # TST (184k HTMLs)
    "tst": ("tst_ingest_es.py", BASE_ES / "tst"),
    # Falcão TRTs (API pública — sem arquivo local)
    "falcao": ("falcao_trt_ingest_es.py", None),
}

# Ordem de execução: primeiro os menores (TJs/TRFs), depois TST (demorado)
DEFAULT_ORDER = [
    "tjac", "tjba", "tjce", "tjdft", "tjes", "tjgo", "tjmg",
    "tjpa", "tjpi", "tjrn", "tjrr", "tjrs", "tjsc",
    "trf1", "trf2", "trf4", "trf5", "trf6",
    "falcao",
    "tst",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _wait_port(port: int, timeout: float = 20.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("localhost", port), timeout=1):
                return True
        except OSError:
            time.sleep(0.4)
    return False


def _open_tunnel() -> subprocess.Popen:
    print(f"Abrindo tunnel SSH: localhost:{LOCAL_TUNNEL_PORT} -> {SSH_HOST}:{REMOTE_ES_PORT}")
    proc = subprocess.Popen(
        [
            "ssh", "-N",
            "-i", SSH_KEY,
            "-L", f"{LOCAL_TUNNEL_PORT}:localhost:{REMOTE_ES_PORT}",
            "-o", "StrictHostKeyChecking=no",
            "-o", "ServerAliveInterval=30",
            "-o", "ServerAliveCountMax=10",
            "-o", "ExitOnForwardFailure=yes",
            f"{SSH_USER}@{SSH_HOST}",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if not _wait_port(LOCAL_TUNNEL_PORT):
        proc.terminate()
        sys.exit("ERRO: tunnel SSH não ficou pronto em 20s. Verifique ~/.ssh/judicore_vps e conexão com o VPS.")
    print("Tunnel ativo.\n")
    return proc


def _run_source(name: str, script: str, folder: Path | None, dry_run: bool, reset: bool) -> int:
    script_path = SCRIPT_DIR / script
    if not script_path.exists():
        print(f"  [SKIP] Script não encontrado: {script_path}")
        return 0

    if folder is not None:
        if not folder.exists():
            print(f"  [SKIP] Pasta não encontrada: {folder}")
            return 0

    print(f"\n{'=' * 60}")
    print(f"Indexando: {name.upper()}")
    if folder:
        print(f"  Fonte: {folder}")
    print(f"{'=' * 60}")

    cmd = [sys.executable, str(script_path), "--es-url", f"http://localhost:{LOCAL_TUNNEL_PORT}"]

    if folder is not None:
        cmd += ["--folder", str(folder)]

    if name == "tst":
        cmd += ["--workers", "4"]

    if dry_run:
        cmd += ["--dry-run"]
    if reset:
        cmd += ["--reset"]

    result = subprocess.run(cmd)
    return result.returncode


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Repopula o Elasticsearch do VPS a partir dos dados em temp/base_es/",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument(
        "--source",
        help="Fontes separadas por vírgula (ex: tst,trf1). Omita para todas.",
    )
    ap.add_argument("--dry-run", action="store_true", help="Extrai mas não indexa")
    ap.add_argument("--reset", action="store_true", help="Ignora checkpoints")
    ap.add_argument("--list", action="store_true", help="Lista fontes e sai")
    args = ap.parse_args()

    if args.list:
        print("Fontes disponíveis:")
        for name, (script, folder) in SOURCES.items():
            status = "OK" if (folder is None or folder.exists()) else "SEM DADOS"
            print(f"  {name:<10}  {status}  {'(API pública)' if folder is None else str(folder)}")
        return

    # Selecionar fontes
    if args.source:
        requested = [s.strip() for s in args.source.split(",")]
        unknown = [s for s in requested if s not in SOURCES]
        if unknown:
            sys.exit(f"Fontes desconhecidas: {', '.join(unknown)}. Use --list para ver as disponíveis.")
        to_run = requested
    else:
        to_run = DEFAULT_ORDER

    print("=" * 60)
    print("Repopulação Elasticsearch — JudiCore")
    print(f"  VPS: {SSH_HOST}:{REMOTE_ES_PORT}")
    print(f"  Fontes: {', '.join(to_run)}")
    if args.dry_run:
        print("  MODO DRY-RUN — nenhum dado será indexado")
    if args.reset:
        print("  MODO RESET — checkpoints serão ignorados")
    print("=" * 60)

    tunnel = _open_tunnel()
    errors: list[str] = []

    try:
        for name in to_run:
            script, folder = SOURCES[name]
            rc = _run_source(name, script, folder, args.dry_run, args.reset)
            if rc != 0:
                errors.append(f"{name} (código {rc})")

    finally:
        tunnel.terminate()
        try:
            tunnel.wait(timeout=3)
        except subprocess.TimeoutExpired:
            tunnel.kill()
        print("\nTunnel fechado.")

    print("\n" + "=" * 60)
    if errors:
        print(f"CONCLUÍDO COM ERROS em: {', '.join(errors)}")
        sys.exit(1)
    else:
        print("CONCLUÍDO com sucesso.")
    print("=" * 60)


if __name__ == "__main__":
    main()

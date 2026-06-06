#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Repopula o Elasticsearch com os dados dos TRFs.

Dados em: temp/base_es/trfs/{tribunal}/
Abre tunnel SSH (localhost:19200 -> VPS:9200) e roda cada script em sequência.

Uso:
    python ingest_trfs.py                    # todos os TRFs
    python ingest_trfs.py --tribunal trf1    # só TRF1
    python ingest_trfs.py --dry-run
    python ingest_trfs.py --reset
"""

import argparse
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

SSH_HOST = "2.24.75.193"
SSH_USER = "root"
SSH_KEY = os.path.expanduser("~/.ssh/judicore_vps")
REMOTE_ES_PORT = 9200
LOCAL_TUNNEL_PORT = 19200

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
TRFS_DIR = PROJECT_ROOT / "temp" / "base_es" / "trfs"

TRFS = {
    "trf1": "trf1_ingest_es.py",
    "trf2": "trf2_ingest_es.py",
    "trf4": "trf4_ingest_es.py",
    "trf5": "trf5_ingest_es.py",
    "trf6": "trf6_ingest_es.py",
}


def _wait_port(port: int, timeout: float = 20.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("localhost", port), timeout=1):
                return True
        except OSError:
            time.sleep(0.4)
    return False


def main() -> None:
    ap = argparse.ArgumentParser(description="Ingestão TRFs -> Elasticsearch via tunnel SSH")
    ap.add_argument("--tribunal", help="Sigla (ex: trf1). Omita para todos.")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--reset", action="store_true")
    args = ap.parse_args()

    if args.tribunal:
        t = args.tribunal.lower()
        if t not in TRFS:
            sys.exit(f"Tribunal '{t}' desconhecido. Disponíveis: {', '.join(sorted(TRFS))}")
        to_run = {t: TRFS[t]}
    else:
        to_run = TRFS

    print("=" * 60)
    print(f"Ingestão TRFs  |  {len(to_run)} tribunal(is)")
    print(f"Dados em: {TRFS_DIR}")
    print(f"ES VPS: {SSH_HOST}:{REMOTE_ES_PORT}")
    print("=" * 60)

    print(f"\nAbrindo tunnel SSH: localhost:{LOCAL_TUNNEL_PORT} -> {SSH_HOST}:{REMOTE_ES_PORT}")
    tunnel = subprocess.Popen(
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
        tunnel.terminate()
        sys.exit("ERRO: tunnel SSH não ficou pronto em 20s.")

    print("Tunnel ativo.\n")
    errors: list[str] = []

    try:
        for tribunal, script_name in to_run.items():
            folder = TRFS_DIR / tribunal
            script = SCRIPT_DIR / script_name

            if not script.exists():
                print(f"[SKIP] Script não encontrado: {script_name}")
                continue
            if not folder.exists():
                print(f"[SKIP] Sem dados para {tribunal}: {folder}")
                continue

            print(f"\n{'=' * 60}")
            print(f"Indexando: {tribunal.upper()}  |  {folder}")
            print("=" * 60)

            cmd = [
                sys.executable, str(script),
                "--es-url", f"http://localhost:{LOCAL_TUNNEL_PORT}",
                "--folder", str(folder),
            ]
            if args.dry_run:
                cmd += ["--dry-run"]
            if args.reset:
                cmd += ["--reset"]

            rc = subprocess.run(cmd).returncode
            if rc != 0:
                errors.append(tribunal)

    finally:
        tunnel.terminate()
        try:
            tunnel.wait(timeout=3)
        except subprocess.TimeoutExpired:
            tunnel.kill()
        print("\nTunnel fechado.")

    print("\n" + "=" * 60)
    if errors:
        print(f"CONCLUÍDO — erros em: {', '.join(errors)}")
        sys.exit(1)
    else:
        print("CONCLUÍDO com sucesso.")
    print("=" * 60)


if __name__ == "__main__":
    main()

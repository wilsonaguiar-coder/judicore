#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Wrapper: abre tunnel SSH para o ES do servidor e roda tst_ingest_es.py localmente.

Os 184k HTMLs ficam no disco local; os documentos indexados vão para o ES
do servidor via tunnel SSH (não é necessário copiar 12GB para o servidor).

Uso:
    python tst_tunnel_run.py [--workers 4] [--sample 0] [--dry-run] [--reset]
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
INGEST_SCRIPT = SCRIPT_DIR / "tst_ingest_es.py"


def _wait_port(port: int, timeout: float = 15.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("localhost", port), timeout=1):
                return True
        except OSError:
            time.sleep(0.3)
    return False


def main():
    ap = argparse.ArgumentParser(description="Roda ingestão TST via tunnel SSH")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--sample", type=int, default=0)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--reset", action="store_true")
    args = ap.parse_args()

    # Inicia tunnel via ssh nativo (key já está em authorized_keys)
    print(f"Abrindo tunnel SSH: localhost:{LOCAL_TUNNEL_PORT} -> {SSH_HOST}:{REMOTE_ES_PORT}")
    tunnel_proc = subprocess.Popen(
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

    try:
        if not _wait_port(LOCAL_TUNNEL_PORT):
            print("ERRO: tunnel não ficou pronto em 15s", file=sys.stderr)
            tunnel_proc.terminate()
            sys.exit(1)

        print(f"Tunnel ativo. Iniciando indexação com {args.workers} workers...\n")

        cmd = [
            sys.executable, str(INGEST_SCRIPT),
            "--es-url", f"http://localhost:{LOCAL_TUNNEL_PORT}",
            "--workers", str(args.workers),
        ]
        if args.sample:
            cmd += ["--sample", str(args.sample)]
        if args.dry_run:
            cmd += ["--dry-run"]
        if args.reset:
            cmd += ["--reset"]

        result = subprocess.run(cmd)
        sys.exit(result.returncode)

    finally:
        tunnel_proc.terminate()
        try:
            tunnel_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            tunnel_proc.kill()
        print("\nTunnel fechado.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Abre tunnel SSH com paramiko e roda tjsc_ingest_es.py localmente.

Os PDFs ficam no disco local; os documentos indexados vão para o ES
do servidor via tunnel SSH.

Uso:
    python tjsc_tunnel_run.py [--reset] [--dry-run]
"""

import argparse
import os
import select
import socketserver
import subprocess
import sys
import threading
import time
from pathlib import Path

import paramiko

SSH_HOST           = "2.24.75.193"
SSH_USER           = "root"
SSH_PASS           = "Ugaz#@2026ok"
SSH_KEY            = os.path.expanduser("~/.ssh/judicore_vps")
REMOTE_ES_PORT     = 9200
LOCAL_TUNNEL_PORT  = 19200

SCRIPT_DIR    = Path(__file__).parent
INGEST_SCRIPT = SCRIPT_DIR / "tjsc_ingest_es.py"


# ── Port-forward via paramiko ─────────────────────────────────────────────────

class _Handler(socketserver.BaseRequestHandler):
    def handle(self):
        try:
            chan = self.server.ssh_transport.open_channel(
                "direct-tcpip",
                ("localhost", REMOTE_ES_PORT),
                self.request.getpeername(),
            )
        except Exception as e:
            print(f"  [tunnel] Canal SSH falhou: {e}", file=sys.stderr)
            return
        if chan is None:
            print("  [tunnel] Canal SSH retornou None", file=sys.stderr)
            return
        try:
            while True:
                r, _, _ = select.select([self.request, chan], [], [], 5)
                if self.request in r:
                    data = self.request.recv(4096)
                    if not data:
                        break
                    chan.send(data)
                if chan in r:
                    data = chan.recv(4096)
                    if not data:
                        break
                    self.request.send(data)
        finally:
            chan.close()
            self.request.close()


class _ForwardServer(socketserver.ThreadingTCPServer):
    daemon_threads    = True
    allow_reuse_address = True

    def __init__(self, server_address, handler, transport):
        self.ssh_transport = transport
        super().__init__(server_address, handler)


def _start_tunnel(transport: paramiko.Transport) -> _ForwardServer:
    server = _ForwardServer(("127.0.0.1", LOCAL_TUNNEL_PORT), _Handler, transport)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server


def _wait_port(port: int, timeout: float = 15.0) -> bool:
    import socket
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return True
        except OSError:
            time.sleep(0.3)
    return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Ingestão TJSC via tunnel SSH (paramiko)")
    ap.add_argument("--reset",   action="store_true", help="Remove checkpoint e recomeça")
    ap.add_argument("--dry-run", action="store_true", help="Extrai mas não indexa")
    args = ap.parse_args()

    print(f"Conectando SSH: {SSH_USER}@{SSH_HOST}")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    key_file = SSH_KEY if os.path.exists(SSH_KEY) else None
    client.connect(
        hostname=SSH_HOST,
        username=SSH_USER,
        password=SSH_PASS,
        key_filename=key_file,
        timeout=30,
        look_for_keys=False,
        allow_agent=False,
    )
    print(f"Abrindo tunnel: localhost:{LOCAL_TUNNEL_PORT} -> {SSH_HOST}:{REMOTE_ES_PORT}")
    transport = client.get_transport()
    transport.set_keepalive(30)

    forward_server = _start_tunnel(transport)
    try:
        if not _wait_port(LOCAL_TUNNEL_PORT):
            print("ERRO: tunnel não ficou pronto em 15s", file=sys.stderr)
            sys.exit(1)

        print("Tunnel ativo. Iniciando indexação TJSC...\n")

        cmd = [
            sys.executable, str(INGEST_SCRIPT),
            "--es-url", f"http://localhost:{LOCAL_TUNNEL_PORT}",
        ]
        if args.reset:
            cmd += ["--reset"]
        if args.dry_run:
            cmd += ["--dry-run"]

        result = subprocess.run(cmd)
        sys.exit(result.returncode)

    finally:
        forward_server.shutdown()
        client.close()
        print("\nTunnel fechado.")


if __name__ == "__main__":
    main()

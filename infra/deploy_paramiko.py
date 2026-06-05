#!/usr/bin/env python3
import sys
import argparse
import paramiko

# Force UTF-8 output so VPS terminal symbols don't crash on Windows cp1252
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

CMD_WEB = (
    'cd /opt/judicore && git pull && '
    'cd apps/web && pnpm install --frozen-lockfile && pnpm run build && '
    'pm2 restart judicore-web || true'
)

CMD_API = (
    'cd /opt/judicore && git pull && '
    'cd packages/ai && pnpm install --frozen-lockfile && pnpm run build && '
    'cd /opt/judicore/apps/api && pnpm install --frozen-lockfile && pnpm run build && '
    'pm2 restart judicore-api || true'
)


def run_commands(ssh, label, command):
    print(f"\n$ {command}")
    _stdin, stdout, stderr = ssh.exec_command(command)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    exit_status = stdout.channel.recv_exit_status()
    if out:
        print(out)
    if err:
        print(err, file=sys.stderr)
    print(f"[exit: {exit_status}]")
    if exit_status != 0:
        print(f"{label} failed (exit {exit_status})", file=sys.stderr)


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('host')
    p.add_argument('user')
    p.add_argument('password')
    args = p.parse_args()

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        print(f"Connecting to {args.user}@{args.host}...")
        client.connect(args.host, username=args.user, password=args.password, timeout=20)

        print('\n--- Deploying web ---')
        run_commands(client, 'web', CMD_WEB)

        print('\n--- Deploying api ---')
        run_commands(client, 'api', CMD_API)

        print('\nDone.')
    except Exception as e:
        print('Error:', e, file=sys.stderr)
        sys.exit(1)
    finally:
        client.close()

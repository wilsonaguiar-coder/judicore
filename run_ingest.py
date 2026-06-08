import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname="2.24.75.193", username="root", password="Ugaz#@2026ok")

commands = [
    "cd /opt/judicore && git pull",
    "cd /opt/judicore/apps/api && set -a && source .env && set +a && npx tsx src/scripts/ingest-legis.ts"
]

for cmd in commands:
    print(f"Executando: {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    
    if out: print(out)
    if err: print(f"ERRO: {err}")

client.close()
print("Finalizado teste de ingestão")

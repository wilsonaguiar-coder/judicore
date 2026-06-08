import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname="2.24.75.193", username="root", password="Ugaz#@2026ok")

commands = [
    "cd /opt/judicore && git pull",
    "cd /opt/judicore/packages/db && set -a && source /opt/judicore/apps/api/.env && set +a && npx prisma db push --accept-data-loss",
    "cd /opt/judicore/packages/db && npx prisma generate"
]

for cmd in commands:
    print(f"Executando: {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    
    if out: print(out)
    if err: print(f"ERRO: {err}")

client.close()
print("Finalizado push do schema")

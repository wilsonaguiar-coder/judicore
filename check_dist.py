import paramiko
import sys
import json
import time

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

# Verifica como o judicore-api está sendo iniciado
print("=== Verificando PM2 startup do API ===")
stdin, stdout, _ = client.exec_command("pm2 show judicore-api 2>/dev/null | head -40")
print(stdout.read().decode()[:1000])

# Verifica se existe um dist compilado
print("\n=== Verificando compilação ===")
stdin2, stdout2, _ = client.exec_command("ls /opt/judicore/packages/ai/dist/ 2>/dev/null | head -20")
print("AI dist:", stdout2.read().decode())

stdin3, stdout3, _ = client.exec_command("ls /opt/judicore/packages/db/dist/ 2>/dev/null | head -20")
print("DB dist:", stdout3.read().decode())

client.close()

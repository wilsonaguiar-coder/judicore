import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

print("=== PM2 STATUS ===")
stdin, stdout, stderr = client.exec_command("pm2 list")
print(stdout.read().decode('utf-8', errors='ignore'))

print("\n=== PM2 LOGS: WEB ===")
stdin, stdout, stderr = client.exec_command("pm2 logs judicore-web --lines 30 --nostream")
print(stdout.read().decode('utf-8', errors='ignore'))
print(stderr.read().decode('utf-8', errors='ignore'))

print("\n=== PM2 LOGS: API ===")
stdin, stdout, stderr = client.exec_command("pm2 logs judicore-api --lines 30 --nostream")
print(stdout.read().decode('utf-8', errors='ignore'))
print(stderr.read().decode('utf-8', errors='ignore'))

client.close()

import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

cmd = """
cd /opt/judicore/apps/web
pm2 delete judicore-web
npm run build
pm2 start npm --name "judicore-web" -- start
pm2 save
"""

print("Restaurando judicore-web...")
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='ignore'))
print(stderr.read().decode('utf-8', errors='ignore'))

client.close()

import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

cmd = """
bash -c '
# Deleta o endpoint de teste que está travando o build
rm -rf /opt/judicore/apps/web/src/app/api/test-beta

cd /opt/judicore/apps/web
# Limpa cache do next
rm -rf .next
# Roda o build novamente
npm run build

pm2 delete judicore-web || true
pm2 start npm --name "judicore-web" -- run start
pm2 save
'
"""

stdin, stdout, stderr = client.exec_command(cmd)
print("STDOUT:", stdout.read().decode('utf-8', errors='ignore'))
print("STDERR:", stderr.read().decode('utf-8', errors='ignore'))
client.close()

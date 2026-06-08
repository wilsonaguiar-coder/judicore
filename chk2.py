import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

cmd = """
bash -c '
source /root/.nvm/nvm.sh || true
export PATH=$PATH:/usr/local/bin
cd /opt/judicore/apps/web
pm2 delete judicore-web || true
echo "Starting Next.js..."
pm2 start npm --name "judicore-web" -- run start
pm2 save
pm2 list
'
"""

stdin, stdout, stderr = client.exec_command(cmd)
print("STDOUT:", stdout.read().decode('utf-8', errors='ignore'))
print("STDERR:", stderr.read().decode('utf-8', errors='ignore'))
client.close()

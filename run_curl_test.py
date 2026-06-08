import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=host, username=user, password=password)

cmd = """
cd /opt/judicore
git pull origin main

cd packages/db
npx prisma migrate deploy
npx prisma generate
cd ../..

cd apps/web
npm run build
pm2 restart judicore-web

curl -s "http://localhost:3000/api/test-beta"
"""

stdin, stdout, stderr = client.exec_command(cmd)

out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')

with open("curl_output.txt", "w", encoding="utf-8") as f:
    f.write(out)
    if err:
        f.write("\nERRORS:\n" + err)

print("Teste concluído, output salvo em curl_output.txt")
client.close()

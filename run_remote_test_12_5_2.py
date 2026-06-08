import paramiko
import sys

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

export $(grep -v '^#' apps/api/.env | xargs)

cd packages/db
npx prisma migrate deploy
npx prisma generate
cd ../..

sed -i '/import "dotenv\\/config";/d' run-beta-12-5-2-test.ts
npm install dotenv

npx tsx --env-file=apps/api/.env run-beta-12-5-2-test.ts
"""

stdin, stdout, stderr = client.exec_command(cmd)

out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')

with open("test_output_12_5_2.txt", "w", encoding="utf-8") as f:
    f.write(out)
    if err:
        f.write("\nERRORS:\n" + err)

print("Teste concluído, output salvo em test_output_12_5_2.txt")
client.close()

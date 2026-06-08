import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

# Restart pm2 web process with env vars exported from api .env
cmd = """
set -a
source /opt/judicore/apps/api/.env
set +a

pm2 restart judicore-web --update-env
sleep 6

curl -s --max-time 300 "http://localhost:3000/api/test-beta"
"""

stdin, stdout, stderr = client.exec_command(cmd, timeout=360)

out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')

with open("audit_5cases_raw3.txt", "w", encoding="utf-8") as f:
    f.write(out)
    if err:
        f.write("\nERRORS:\n" + err)

try:
    json_start = out.rfind('{"success"')
    if json_start >= 0:
        json_str = out[json_start:]
        data = json.loads(json_str)
        with open("audit_5cases.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Sucesso!")
        for r in data.get('results', []):
            if 'error' in r:
                print(f"  Caso {r['caso']}: ERRO — {r['error']}")
            else:
                print(f"  Caso {r['caso']} ({r.get('pieceType','')}): {r.get('chars',0)} chars | {r.get('outputTokensGpt',0)} tokens output | {r.get('elapsedMs',0)//1000}s")
    else:
        print("JSON não encontrado. Últimas 300 chars:")
        print(out[-300:])
except Exception as e:
    print(f"Erro ao parsear JSON: {e}")

client.close()

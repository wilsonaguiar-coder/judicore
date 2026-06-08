import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

# A rota Next.js no ambiente de produção precisa do .env.local ou .env.production
# Vamos injetar o env no .env.production antes do build e verificar as keys
cmd = """
cd /opt/judicore/apps/web

# Copia as vars da API para o env do web
grep -E 'GEMINI_API_KEY|OPENAI_API_KEY' /opt/judicore/apps/api/.env > .env.local
echo "Env vars injetadas:"
cat .env.local

npm run build
pm2 restart judicore-web

sleep 8

curl -s --max-time 300 "http://localhost:3000/api/test-beta"
"""

stdin, stdout, stderr = client.exec_command(cmd, timeout=420)

out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')

with open("audit_5cases_raw2.txt", "w", encoding="utf-8") as f:
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
        print(f"Sucesso! {len(data.get('results', []))} peças geradas.")
        for r in data.get('results', []):
            if 'error' in r:
                print(f"  Caso {r['caso']}: ERRO — {r['error']}")
            else:
                print(f"  Caso {r['caso']}: OK — {r.get('chars', 0)} chars, {r.get('outputTokensGpt', 0)} tokens output")
    else:
        print("JSON não encontrado.")
        print("Últimas 500 chars:", out[-500:])
except Exception as e:
    print(f"Erro: {e}")

client.close()

import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

cmd = """
cd /opt/judicore
git pull origin main

cd apps/web
npm run build
pm2 restart judicore-web

sleep 8

curl -s --max-time 300 "http://localhost:3000/api/test-beta"
"""

stdin, stdout, stderr = client.exec_command(cmd, timeout=360)

out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')

# Salva o JSON cru
with open("audit_5cases_raw.txt", "w", encoding="utf-8") as f:
    f.write(out)
    if err:
        f.write("\nERRORS:\n" + err)

# Tenta extrair e salvar o JSON de resultado separado
try:
    # Encontra o JSON na saída (depois do build output)
    json_start = out.rfind('{"success"')
    if json_start >= 0:
        json_str = out[json_start:]
        data = json.loads(json_str)
        with open("audit_5cases.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Sucesso! {len(data.get('results', []))} peças geradas.")
    else:
        print("JSON não encontrado na saída.")
except Exception as e:
    print(f"Erro ao parsear JSON: {e}")

client.close()

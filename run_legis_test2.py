import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

test_script = """
import os
import time
from pathlib import Path

# Tentando usar SDK antigo se google-genai novo nao tiver no venv
try:
    from google import genai
    from google.genai import types
    NEW_SDK = True
except ImportError:
    import google.generativeai as genai
    NEW_SDK = False

env_path = Path("/opt/judicore/services/search/.env")
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if line.startswith("GEMINI_API_KEY="):
            os.environ["GEMINI_API_KEY"] = line.split("=", 1)[1].strip()

if not NEW_SDK:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
else:
    client = genai.Client()

artigos_teste = [
    "Artigo 57 da Lei 8.213/1991",
    "Artigo 74 da Lei 8.213/1991",
    "Artigo 103 da Lei 8.213/1991",
    "Artigo 300 da Lei 13.105/2015",
    "Artigo 186 da Lei 10.406/2002",
    "Artigo 3º da CLT (Decreto-Lei 5.452/1943)",
    "Artigo 6º da Lei 8.078/1990",
    "Artigo 121 do Código Penal",
    "Artigo 150 do Código Tributário Nacional",
    "Artigo 5º da Constituição Federal"
]

sys_prompt = \"\"\"Você é um assistente estrito de recuperação de texto legal do Brasil.
A sua ÚNICA função é retornar o texto literal e exato (ipsis litteris) do caput do dispositivo legal solicitado.
REGRAS:
1. NÃO invente, não altere palavras e não resuma. O texto deve ser idêntico ao oficial.
2. Retorne APENAS o texto do caput, sem introdução ou aspas.
3. Se não tiver certeza absoluta do texto, responda 'ALUCINACAO_DETECTADA'.
\"\"\"

resultados = []
print(f"Iniciando extração via Gemini 1.5 Flash (SDK {'novo' if NEW_SDK else 'antigo'})...\\n")

for i, art in enumerate(artigos_teste):
    print(f"[{i+1}/{len(artigos_teste)}] Buscando: {art}")
    try:
        if NEW_SDK:
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=f"Retorne o texto exato de: {art}",
                config=types.GenerateContentConfig(
                    system_instruction=sys_prompt,
                    temperature=0.0
                )
            )
            text = response.text.strip()
        else:
            model = genai.GenerativeModel("gemini-1.5-flash", system_instruction=sys_prompt)
            response = model.generate_content(
                f"Retorne o texto exato de: {art}",
                generation_config={"temperature": 0.0}
            )
            text = response.text.strip()
        resultados.append({"artigo": art, "texto": text})
    except Exception as e:
        resultados.append({"artigo": art, "texto": f"ERRO_API: {str(e)}"})
    time.sleep(1)

output_md = "/opt/judicore/test_legis_resultados.md"
with open(output_md, "w", encoding="utf-8") as f:
    f.write("# Resultado do Teste de Memória Paramétrica (Gemini Flash)\\n\\n")
    for r in resultados:
        f.write(f"### {r['artigo']}\\n")
        f.write(f"> {r['texto']}\\n\\n")

print(f"Teste finalizado.")
"""

client.exec_command("cat > /tmp/test_legis.py << 'EOF'\n" + test_script + "\nEOF")
# Use the venv Python!
stdin, stdout, stderr = client.exec_command("/opt/judicore/services/search/venv/bin/python /tmp/test_legis.py")

output = stdout.read().decode('utf-8', errors='ignore')
errors = stderr.read().decode('utf-8', errors='ignore')

sftp = client.open_sftp()
try:
    sftp.get("/opt/judicore/test_legis_resultados.md", "d:\\backup\\judicore\\test_legis_resultados.md")
    print("Arquivo baixado com sucesso.")
except Exception as e:
    print(f"Erro ao baixar: {e}")
sftp.close()
client.close()

print("STDOUT:", output)
print("STDERR:", errors)

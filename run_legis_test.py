import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

test_script = """
import os
import json
import time
from pathlib import Path
from google import genai
from google.genai import types

# Carregar chave do Gemini
env_path = Path("/opt/judicore/services/search/.env")
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if line.startswith("GEMINI_API_KEY="):
            os.environ["GEMINI_API_KEY"] = line.split("=", 1)[1].strip()

client = genai.Client()

artigos_teste = [
    # Previdenciário (Muito comuns e alguns obscuros)
    "Artigo 57 da Lei 8.213/1991",
    "Artigo 74 da Lei 8.213/1991",
    "Artigo 103 da Lei 8.213/1991",
    "Artigo 15 da Lei 8.213/1991",
    "Artigo 86 da Lei 8.213/1991",
    # Processo Civil (CPC)
    "Artigo 300 da Lei 13.105/2015",
    "Artigo 98 da Lei 13.105/2015",
    "Artigo 1009 da Lei 13.105/2015",
    "Artigo 487 da Lei 13.105/2015",
    "Artigo 319 da Lei 13.105/2015",
    "Artigo 85 da Lei 13.105/2015",
    "Artigo 373 da Lei 13.105/2015",
    "Artigo 932 da Lei 13.105/2015",
    # Civil (CC)
    "Artigo 186 da Lei 10.406/2002",
    "Artigo 927 da Lei 10.406/2002",
    "Artigo 422 da Lei 10.406/2002",
    "Artigo 1.228 da Lei 10.406/2002",
    "Artigo 1.694 da Lei 10.406/2002",
    "Artigo 406 da Lei 10.406/2002",
    "Artigo 475 da Lei 10.406/2002",
    # Trabalhista (CLT)
    "Artigo 3º da CLT (Decreto-Lei 5.452/1943)",
    "Artigo 477 da CLT",
    "Artigo 482 da CLT",
    "Artigo 818 da CLT",
    "Artigo 134 da CLT",
    "Artigo 840 da CLT",
    # Consumidor (CDC)
    "Artigo 6º da Lei 8.078/1990",
    "Artigo 14 da Lei 8.078/1990",
    "Artigo 42 da Lei 8.078/1990",
    "Artigo 49 da Lei 8.078/1990",
    "Artigo 39 da Lei 8.078/1990",
    # Penal e Processo Penal
    "Artigo 121 do Código Penal (Decreto-Lei 2.848/1940)",
    "Artigo 155 do Código Penal",
    "Artigo 157 do Código Penal",
    "Artigo 33 da Lei 11.343/2006 (Lei de Drogas)",
    "Artigo 312 do Código de Processo Penal",
    "Artigo 226 do Código de Processo Penal",
    # Tributário (CTN)
    "Artigo 150 do Código Tributário Nacional (Lei 5.172/1966)",
    "Artigo 156 do CTN",
    "Artigo 174 do CTN",
    # Administrativo / Servidores
    "Artigo 81 da Lei 8.112/1990",
    "Artigo 132 da Lei 8.112/1990",
    "Artigo 37 da Constituição Federal",
    # Constituição Federal
    "Artigo 5º da Constituição Federal",
    "Artigo 201 da Constituição Federal",
    "Artigo 195 da Constituição Federal",
    # Leis Especiais Variadas
    "Artigo 1º da Lei 8.036/1990 (FGTS)",
    "Artigo 2º da Lei 9.099/1995 (JEC)",
    "Artigo 1º da Lei 12.016/2009 (Mandado de Segurança)",
    "Artigo 10 da Lei 8.429/1992 (Improbidade Administrativa)"
]

sys_prompt = \"\"\"Você é um assistente estrito de recuperação de texto legal.
A sua ÚNICA função é retornar o texto literal e exato (ipsis litteris) do dispositivo legal solicitado.
REGRAS:
1. NÃO invente, não altere palavras e não resuma. O texto deve ser idêntico ao publicado no Diário Oficial.
2. Se você não tiver certeza absoluta de TODAS as palavras do artigo, responda APENAS: "ALUCINACAO_DETECTADA".
3. Retorne APENAS o texto do caput do artigo, sem explicações, sem introdução. Não inclua parágrafos ou incisos a menos que solicitado.
4. Se a lei ou artigo não existir, responda "ALUCINACAO_DETECTADA".
\"\"\"

resultados = []

print("Iniciando extração de 50 artigos via Gemini 1.5 Flash (On-The-Fly)\\n")

for i, art in enumerate(artigos_teste):
    print(f"[{i+1}/50] Buscando: {art}")
    try:
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=f"Retorne o texto exato de: {art}",
            config=types.GenerateContentConfig(
                system_instruction=sys_prompt,
                temperature=0.0
            )
        )
        text = response.text.strip()
        resultados.append({"artigo": art, "texto": text})
    except Exception as e:
        print(f"Erro no artigo {art}: {e}")
        resultados.append({"artigo": art, "texto": f"ERRO_API: {str(e)}"})
    time.sleep(0.5)

# Salvar arquivo de resultados
output_md = "/opt/judicore/test_legis_resultados.md"
with open(output_md, "w", encoding="utf-8") as f:
    f.write("# Resultado do Teste de Memória Paramétrica (Gemini Flash)\\n\\n")
    for r in resultados:
        f.write(f"### {r['artigo']}\\n")
        f.write(f"> {r['texto']}\\n\\n")
        f.write("---\\n")

print(f"\\nTeste finalizado. Resultados salvos em {output_md}")
"""

# Salva e roda o script no servidor remoto
client.exec_command("cat > /tmp/test_legis.py << 'EOF'\n" + test_script + "\nEOF")
stdin, stdout, stderr = client.exec_command("python3 /tmp/test_legis.py")

output = stdout.read().decode('utf-8', errors='ignore')
errors = stderr.read().decode('utf-8', errors='ignore')

# Traz o arquivo de volta para a máquina local
sftp = client.open_sftp()
try:
    sftp.get("/opt/judicore/test_legis_resultados.md", "d:\\backup\\judicore\\test_legis_resultados.md")
    print("Arquivo de resultados baixado com sucesso.")
except Exception as e:
    print(f"Erro ao baixar resultados: {e}")
sftp.close()
client.close()

print("STDOUT:", output)
print("STDERR:", errors)

import urllib.request
import json
import time

artigos_teste = [
    # Previdenciário
    "Artigo 57 da Lei 8.213/1991", "Artigo 74 da Lei 8.213/1991", "Artigo 103 da Lei 8.213/1991",
    "Artigo 15 da Lei 8.213/1991", "Artigo 86 da Lei 8.213/1991", "Artigo 42 da Lei 8.213/1991",
    "Artigo 55 da Lei 8.213/1991", "Artigo 21 da Lei 8.212/1991",
    # Processo Civil (CPC)
    "Artigo 300 da Lei 13.105/2015", "Artigo 98 da Lei 13.105/2015", "Artigo 1009 da Lei 13.105/2015",
    "Artigo 487 da Lei 13.105/2015", "Artigo 319 da Lei 13.105/2015", "Artigo 85 da Lei 13.105/2015",
    "Artigo 373 da Lei 13.105/2015", "Artigo 932 da Lei 13.105/2015",
    # Civil (CC)
    "Artigo 186 da Lei 10.406/2002", "Artigo 927 da Lei 10.406/2002", "Artigo 422 da Lei 10.406/2002",
    "Artigo 1.228 da Lei 10.406/2002", "Artigo 1.694 da Lei 10.406/2002", "Artigo 406 da Lei 10.406/2002",
    "Artigo 475 da Lei 10.406/2002", "Artigo 1.336 da Lei 10.406/2002",
    # Trabalhista (CLT)
    "Artigo 3º da CLT", "Artigo 477 da CLT", "Artigo 482 da CLT",
    "Artigo 818 da CLT", "Artigo 134 da CLT", "Artigo 840 da CLT",
    "Artigo 58 da CLT", "Artigo 71 da CLT",
    # Consumidor (CDC)
    "Artigo 6º da Lei 8.078/1990", "Artigo 14 da Lei 8.078/1990", "Artigo 42 da Lei 8.078/1990",
    "Artigo 49 da Lei 8.078/1990", "Artigo 39 da Lei 8.078/1990",
    # Penal e Processo Penal
    "Artigo 121 do Código Penal", "Artigo 155 do Código Penal", "Artigo 157 do Código Penal",
    "Artigo 33 da Lei 11.343/2006", "Artigo 312 do Código de Processo Penal",
    # Tributário e Administrativo
    "Artigo 150 do CTN", "Artigo 156 do CTN", "Artigo 81 da Lei 8.112/1990",
    # CF e Especiais
    "Artigo 5º da Constituição Federal", "Artigo 37 da Constituição Federal",
    "Artigo 1º da Lei 8.036/1990", "Artigo 2º da Lei 9.099/1995", "Artigo 10 da Lei 8.429/1992"
]

sys_prompt = "Você é um assistente estrito de recuperação de texto legal. A sua ÚNICA função é retornar o texto literal e exato (ipsis litteris) do caput do dispositivo legal solicitado. REGRAS: 1. NÃO invente, não altere palavras e não resuma. O texto deve ser idêntico ao oficial do Diário Oficial. 2. Retorne APENAS o texto do caput, sem introdução. 3. Se não tiver certeza absoluta, responda 'ALUCINACAO_DETECTADA'."

url = "http://localhost:11434/api/generate"

resultados = []
print("Iniciando extração de 50 artigos via Ollama Local (Modelo Qwen)\\n")

for i, art in enumerate(artigos_teste):
    print(f"[{i+1}/50] Buscando: {art}")
    data = {
        "model": "qwen2.5", # Assumindo que o nome do modelo é qwen2.5 ou qwen
        "system": sys_prompt,
        "prompt": f"Retorne o texto exato de: {art}",
        "stream": False,
        "options": {"temperature": 0.0}
    }
    
    try:
        req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=30) as response:
            resp_data = json.loads(response.read().decode('utf-8'))
            text = resp_data.get('response', '').strip()
    except Exception as e:
        # Tenta com o nome apenas "qwen" se qwen2.5 falhar
        try:
            data["model"] = "qwen"
            req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=30) as response:
                resp_data = json.loads(response.read().decode('utf-8'))
                text = resp_data.get('response', '').strip()
        except Exception as e2:
            text = f"ERRO: {e2}"
            
    resultados.append({"artigo": art, "texto": text})

with open("qwen_test_resultados.md", "w", encoding="utf-8") as f:
    f.write("# Teste de Extração Literal (Ollama Qwen 2.5)\\n\\n")
    for r in resultados:
        f.write(f"### {r['artigo']}\\n> {r['texto']}\\n\\n---\\n")

print("\\nTeste concluído. Verifique o arquivo qwen_test_resultados.md")

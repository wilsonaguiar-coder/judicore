import paramiko
import sys
import json
import time

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

# Fix: inject env vars into the web process via ecosystem or stop/start with env
print("Parando judicore-web e reiniciando com env vars...")
fix_env_cmd = """
source /opt/judicore/apps/api/.env
export DATABASE_URL GEMINI_API_KEY OPENAI_API_KEY
pm2 stop judicore-web
pm2 start judicore-web --update-env
sleep 5
echo "=== VARS ==="
pm2 env 1 | grep -E 'GEMINI|OPENAI'
"""
stdin, stdout, stderr = client.exec_command(fix_env_cmd)
out = stdout.read().decode('utf-8', errors='ignore')
print(out[:500])

CASOS = [
    {"id": 1, "tipo": "Petição Inicial",
     "orientacao": "Redigir petição inicial previdenciária pleiteando aposentadoria especial por exposição habitual a ruído acima de 85dB durante 25 anos. O autor trabalhou como operador de máquinas em metalúrgica com PPP e LTCAT atestando exposição a ruído de 92dB. INSS indeferiu alegando que EPIs neutralizavam a nocividade.",
     "doc": "Carlos Eduardo Ferreira, CPF 987.654.321-00, RG 12.345.678-9, Av. Industrial 500, São Paulo SP 01310-100. Metalúrgica Progresso Ltda de 01/03/1995 a 01/03/2020, Operador de Máquinas. PPP emitido pela empresa: ruído 92dB sem EPI eficaz. LTCAT 2019 confirma exposição habitual e permanente."},
    {"id": 2, "tipo": "Contrarrazões",
     "orientacao": "Redigir contrarrazões previdenciárias em face de recurso do INSS que questiona apenas a RMI já fixada em sentença transitada em julgado. O tempo de contribuição de 32 anos é incontroverso. Pugnar pelo improvimento total do recurso.",
     "doc": "Processo 5001234-56.2022.4.03.6100. Ana Paula Souza, CPF 111.222.333-44, Rua das Palmeiras 200 Campinas SP 13000-000. Sentença 15/04/2024: 32 anos contribuição, RMI R$3.200,00 aprovados. INSS recorreu 10/05/2024 apenas quanto à RMI."},
    {"id": 3, "tipo": "Contestação",
     "orientacao": "Redigir contestação em ação de indenização por dano moral decorrente de negativação indevida no SPC e Serasa. A dívida de R$1.200,00 foi quitada em 15/01/2024 e a negativação permaneceu por 8 meses. O autor pede R$30.000,00. Contestar o quantum como excessivo e pugnar pela improcedência ou redução.",
     "doc": "Ré: Financeira Crédito Fácil S.A., CNPJ 00.111.222/0001-33. Autor: Roberto Alves Lima, CPF 444.555.666-77. Dívida R$1.200,00 quitada 15/01/2024 conforme comprovante. Negativação permaneceu até 20/09/2024. Pedido: R$30.000,00 danos morais."},
    {"id": 4, "tipo": "Sentença",
     "orientacao": "Redigir sentença previdenciária julgando procedente o pedido de auxílio por incapacidade temporária. Laudo pericial atesta incapacidade total temporária por 180 dias em razão de hérnia discal L4-L5. INSS havia indeferido administrativamente. Condenar INSS a implantar o benefício e pagar retroativas desde a DII.",
     "doc": "Processo 5009876-54.2023.4.03.6200. Marcos Vinícius Costa, CPF 555.666.777-88. Perito Dr. João Rodrigues CRM 12345: incapacidade total temporária 180 dias por hérnia L4-L5. DII: 05/03/2024. INSS negou em 01/04/2024."},
    {"id": 5, "tipo": "Decisão Interlocutória",
     "orientacao": "Redigir decisão interlocutória apreciando pedido de tutela de urgência em ação previdenciária. Autor idoso de 78 anos está sem receber aposentadoria por tempo de contribuição por erro administrativo do INSS há 3 meses. Deferir a tutela de urgência determinando implantação imediata do benefício.",
     "doc": "Processo 5005555-11.2024.4.03.6300. José Benedito Ferreira, 78 anos, CPF 222.333.444-55, Rua do Amparo 89 São Paulo SP. Aposentado desde 2015. INSS suspendeu o pagamento em agosto/2024 por suposto erro cadastral. Sem renda há 3 meses."}
]

results = []

for caso in CASOS:
    print(f"\nGerando Caso {caso['id']}: {caso['tipo']}...")
    t0 = time.time()
    
    # Escreve o documento num arquivo temporário no servidor e faz upload via curl
    write_doc = f"echo '{caso['doc']}' > /tmp/doc_{caso['id']}.txt"
    client.exec_command(write_doc)[1].read()
    
    curl_cmd = f"""curl -s --max-time 120 -X POST http://localhost:3000/api/piece-generation \\
        -F "userId=cmosstzkf00007w17jjo10cwo" \\
        -F "pieceType={caso['tipo']}" \\
        -F "userOrientation={caso['orientacao']}" \\
        -F "file_0=@/tmp/doc_{caso['id']}.txt;type=text/plain" \\
        -F "category_0=Documentos do Caso"
    """
    stdin2, stdout2, stderr2 = client.exec_command(curl_cmd, timeout=130)
    resp = stdout2.read().decode('utf-8', errors='ignore')
    elapsed = time.time() - t0
    
    print(f"  {elapsed:.0f}s | Resposta: {resp[:150]}...")
    
    try:
        data = json.loads(resp)
        draft = data.get('draft', '')
        results.append({
            "caso": caso['id'],
            "tipo": caso['tipo'],
            "chars": len(draft),
            "draft": draft,
            "generationId": data.get('generationId'),
            "error": data.get('error'),
            "elapsed": round(elapsed)
        })
    except Exception as e:
        results.append({"caso": caso['id'], "tipo": caso['tipo'], "raw": resp[:300], "error": str(e), "elapsed": round(elapsed)})

with open("audit_5cases.json", "w", encoding="utf-8") as f:
    json.dump({"results": results}, f, ensure_ascii=False, indent=2)

print(f"\n{'='*60}")
print("RESUMO:")
for r in results:
    if 'draft' in r and r['chars'] > 0:
        print(f"  Caso {r['caso']} ({r['tipo']}): {r['chars']} chars | {r['elapsed']}s")
    else:
        print(f"  Caso {r['caso']} ({r['tipo']}): ERRO — {r.get('error','?')}")

client.close()

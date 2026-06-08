import paramiko
import sys
import json
import time

sys.stdout.reconfigure(encoding='utf-8')

JWT_SECRET = "ccf88759af40e87adc764a70aa52217a0ec754a355f0cfe0da9eaaeb2af8a07f"
USER_ID = "cmosstzkf00007w17jjo10cwo"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

# Gera JWT direto no servidor usando node
gen_token_cmd = f"""node -e "
const crypto = require('crypto');
const header = Buffer.from(JSON.stringify({{alg:'HS256',typ:'JWT'}})).toString('base64url');
const payload = Buffer.from(JSON.stringify({{sub:'{USER_ID}',role:'ADMIN',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+86400}})).toString('base64url');
const sig = crypto.createHmac('sha256','{JWT_SECRET}').update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+sig);
"
"""
stdin, stdout, stderr = client.exec_command(gen_token_cmd)
token = stdout.read().decode('utf-8').strip()
err = stderr.read().decode('utf-8').strip()
print(f"Token gerado: {token[:60]}..." if token else f"Erro: {err}")

if not token:
    client.close()
    sys.exit(1)

CASOS = [
    {
        "id": 1,
        "pieceType": "Petição Inicial",
        "userOrientation": "Redigir petição inicial previdenciária pleiteando aposentadoria especial por exposição habitual a ruído acima de 85dB durante 25 anos. O autor trabalhou como operador de máquinas em metalúrgica. Possui PPP e LTCAT atestando a exposição. INSS indeferiu alegando que EPIs neutralizavam a nocividade."
    },
    {
        "id": 2,
        "pieceType": "Contrarrazões",
        "userOrientation": "Redigir contrarrazões previdenciárias em face de recurso do INSS que questiona tempo de contribuição já incontroverso reconhecido em sentença de primeiro grau transitada em julgado. INSS recorre apenas quanto à RMI. Pugnar pelo improvimento do recurso."
    },
    {
        "id": 3,
        "pieceType": "Contestação",
        "userOrientation": "Redigir contestação em ação de indenização por dano moral decorrente de negativação indevida no SPC/Serasa. A dívida foi quitada há 8 meses mas a negativação permanece. Contestar o valor de R$ 30.000,00 como excessivo e pugnar pela improcedência ou redução do quantum."
    },
    {
        "id": 4,
        "pieceType": "Sentença",
        "userOrientation": "Redigir sentença previdenciária julgando procedente pedido de auxílio por incapacidade temporária. Laudo pericial atesta incapacidade total e temporária por 180 dias. INSS havia indeferido administrativamente. Condenar o INSS a implantar o benefício e pagar parcelas retroativas."
    },
    {
        "id": 5,
        "pieceType": "Decisão Interlocutória",
        "userOrientation": "Redigir decisão interlocutória apreciando pedido de tutela de urgência em ação previdenciária. Autor idoso de 78 anos está sem receber aposentadoria por erro administrativo do INSS há 3 meses. Deferir a tutela de urgência determinando ao INSS a imediata implantação do benefício."
    }
]

DOCS = [
    "Autor: Carlos Eduardo Ferreira, CPF 987.654.321-00, RG 12.345.678-9, Av. Industrial 500, São Paulo SP 01310-100. Metalúrgica Progresso Ltda, 01/03/1995 a 01/03/2020, Operador de Máquinas. PPP: ruído 92dB sem EPI eficaz. LTCAT 2019 confirma exposição habitual permanente.",
    "Processo 5001234-56.2022.4.03.6100. Ana Paula Souza, CPF 111.222.333-44, Rua das Palmeiras 200, Campinas SP 13000-000. Sentença 15/04/2024: 32 anos contribuição, RMI R$3.200,00. INSS recorreu 10/05/2024 apenas quanto à RMI.",
    "Ré: Financeira Crédito Fácil S.A., CNPJ 00.111.222/0001-33. Autor: Roberto Alves Lima, CPF 444.555.666-77. Dívida R$1.200,00 quitada 15/01/2024. Negativação permaneceu até 20/09/2024. Pedido: R$30.000,00 danos morais.",
    "Processo 5009876-54.2023.4.03.6200. Marcos Vinícius Costa, CPF 555.666.777-88. Perito Dr. João Rodrigues CRM 12345: incapacidade total temporária 180 dias por hérnia L4-L5. DII 05/03/2024. INSS negou 01/04/2024.",
    "Processo 5005555-11.2024.4.03.6300. José Benedito Ferreira, 78 anos, CPF 222.333.444-55, Rua do Amparo 89, São Paulo SP. Aposentadoria suspensa agosto/2024 por erro cadastral INSS. Sem renda há 3 meses."
]

results = []

for i, caso in enumerate(CASOS):
    print(f"\nGerando Caso {caso['id']}: {caso['pieceType']}...")
    t0 = time.time()
    
    doc_b64_cmd = f"""python3 -c "import base64; print(base64.b64encode(b'''{DOCS[i]}''').decode())" """
    stdin2, stdout2, _ = client.exec_command(doc_b64_cmd)
    doc_b64 = stdout2.read().decode().strip()
    
    curl_cmd = f"""curl -s -X POST http://localhost:3001/pipeline/generate \\
        -H "Authorization: Bearer {token}" \\
        -F "pieceType={caso['pieceType']}" \\
        -F "userOrientation={caso['userOrientation']}" \\
        -F "category_0=Documentos do Caso" \\
        -F "file_0=@/dev/stdin;filename=doc.txt;type=text/plain" <<< '{DOCS[i]}'"""
    
    stdin3, stdout3, stderr3 = client.exec_command(curl_cmd, timeout=120)
    resp = stdout3.read().decode('utf-8', errors='ignore')
    elapsed = time.time() - t0
    
    print(f"  Resposta ({elapsed:.0f}s): {resp[:200]}")
    
    try:
        data = json.loads(resp)
        results.append({
            "caso": caso['id'],
            "pieceType": caso['pieceType'],
            "data": data,
            "elapsed": elapsed
        })
    except:
        results.append({"caso": caso['id'], "pieceType": caso['pieceType'], "raw": resp[:500], "elapsed": elapsed})

with open("audit_5cases.json", "w", encoding="utf-8") as f:
    json.dump({"results": results}, f, ensure_ascii=False, indent=2)

print(f"\nAuditoria concluída. {len(results)} casos salvos em audit_5cases.json")
client.close()

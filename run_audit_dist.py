import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

audit_script = r"""
import { GenerationPipeline } from "/opt/judicore/packages/ai/dist/generation-pipeline/generation.pipeline.js";
import { prisma } from "/opt/judicore/packages/db/dist/index.js";

const USER_ID = "cmosstzkf00007w17jjo10cwo";

const CASOS = [
  { id: 1, tipo: "Petição Inicial",
    orientacao: "Petição inicial previdenciária pleiteando aposentadoria especial por exposição habitual a ruído acima de 85dB durante 25 anos. Operador de máquinas em metalúrgica. Possui PPP e LTCAT atestando exposição a ruído de 92dB sem EPI eficaz. INSS indeferiu alegando que EPIs neutralizavam a nocividade.",
    doc: "Carlos Eduardo Ferreira, CPF 987.654.321-00, RG 12.345.678-9, Av. Industrial 500, São Paulo SP CEP 01310-100. Metalúrgica Progresso Ltda de 01/03/1995 a 01/03/2020, Operador de Máquinas. PPP emitido: ruído 92dB sem EPI eficaz. LTCAT 2019 confirma exposição habitual permanente a agente nocivo acima de 85dB."
  },
  { id: 2, tipo: "Contrarrazões",
    orientacao: "Contrarrazões previdenciárias em face de recurso do INSS que questiona apenas a RMI de sentença transitada em julgado. Tempo de contribuição de 32 anos é incontroverso. Pugnar pelo improvimento total do recurso e manutenção integral da sentença.",
    doc: "Processo 5001234-56.2022.4.03.6100. Ana Paula Souza, CPF 111.222.333-44, Rua das Palmeiras 200 Campinas SP CEP 13000-000. Sentença 15/04/2024: 32 anos contribuição, RMI R$ 3.200,00. INSS recorreu 10/05/2024 apenas quanto à RMI, não contestando o tempo de contribuição."
  },
  { id: 3, tipo: "Contestação",
    orientacao: "Contestação em ação de indenização por dano moral por negativação indevida no SPC e Serasa. A dívida de R$ 1.200,00 foi quitada em 15/01/2024 e negativação permaneceu por 8 meses indevidamente. Autor pede R$ 30.000,00 a título de danos morais. Contestar o quantum como excessivo e pugnar pela improcedência ou redução.",
    doc: "Ré: Financeira Crédito Fácil S.A., CNPJ 00.111.222/0001-33. Autor: Roberto Alves Lima, CPF 444.555.666-77. Dívida de R$ 1.200,00 foi quitada em 15/01/2024 conforme comprovante de pagamento. Negativação permaneceu no SPC e Serasa até 20/09/2024. Autor pleiteia R$ 30.000,00 danos morais."
  },
  { id: 4, tipo: "Sentença",
    orientacao: "Sentença previdenciária julgando procedente pedido de auxílio por incapacidade temporária (auxílio-doença). Laudo pericial atesta incapacidade total temporária para atividade habitual por 180 dias. INSS havia indeferido administrativamente. Condenar INSS a implantar benefício e pagar retroativas desde DII 05/03/2024.",
    doc: "Processo 5009876-54.2023.4.03.6200. Marcos Vinícius Costa, CPF 555.666.777-88. Perito judicial Dr. João Rodrigues CRM 12345 atestou em 10/10/2024 incapacidade total temporária para atividade de motorista profissional por 180 dias em razão de hérnia discal L4-L5 diagnosticada em março de 2024. DII: 05/03/2024. INSS negou em 01/04/2024."
  },
  { id: 5, tipo: "Decisão Interlocutória",
    orientacao: "Decisão interlocutória apreciando pedido de tutela de urgência em ação previdenciária. Autor idoso de 78 anos está sem receber aposentadoria por tempo de contribuição por erro administrativo do INSS há 3 meses. Comprovados fumus boni iuris e periculum in mora. Deferir a tutela de urgência determinando implantação imediata do benefício.",
    doc: "Processo 5005555-11.2024.4.03.6300. José Benedito Ferreira, 78 anos, CPF 222.333.444-55, Rua do Amparo 89 São Paulo SP. Aposentado por tempo de contribuição desde 2015. INSS suspendeu o pagamento em agosto de 2024 por suposto erro cadastral. Autor apresentou documentação comprobatória do direito. Está sem renda há 3 meses."
  }
];

async function main() {
  const results: any[] = [];
  for (const caso of CASOS) {
    process.stderr.write(`Gerando Caso ${caso.id}: ${caso.tipo}...\n`);
    const t0 = Date.now();
    try {
      const res = await (GenerationPipeline as any).execute({
        userId: USER_ID, pieceType: caso.tipo, userOrientation: caso.orientacao,
        files: [{ buffer: Buffer.from(caso.doc), mimeType: "text/plain", category: "Documentos do Caso" }]
      });
      const gen = await (prisma as any).pieceGeneration.findUnique({ where: { id: res.generationId } });
      const elapsed = Date.now() - t0;
      results.push({
        caso: caso.id, tipo: caso.tipo, generationId: res.generationId,
        chars: res.draft.length, draft: res.draft,
        inputTokensGpt: gen?.inputTokensGpt, outputTokensGpt: gen?.outputTokensGpt, elapsedMs: elapsed
      });
      process.stderr.write(`  OK: ${res.draft.length} chars, ${gen?.outputTokensGpt} tkns, ${Math.round(elapsed/1000)}s\n`);
    } catch(e: any) {
      results.push({ caso: caso.id, tipo: caso.tipo, error: e.message });
      process.stderr.write(`  ERRO: ${e.message}\n`);
    }
  }
  await (prisma as any).$disconnect();
  process.stdout.write(JSON.stringify({ results }));
}

main();
"""

# Escreve o script na pasta do packages/ai
write_cmd = f"cat > /opt/judicore/packages/ai/audit_runner.ts << 'ENDOFSCRIPT'\n{audit_script}\nENDOFSCRIPT"
client.exec_command(write_cmd)[1].read()

# Roda com --env-file a partir de packages/ai (onde tsx e dotenv estão instalados)
run_cmd = "cd /opt/judicore/packages/ai && npx tsx --env-file=../../apps/api/.env audit_runner.ts 2>/tmp/audit_stderr.txt"
print("Executando os 5 casos (3-5 minutos)...")
stdin, stdout, _ = client.exec_command(run_cmd, timeout=600)
out = stdout.read().decode('utf-8', errors='ignore')

stderr_log = client.exec_command("cat /tmp/audit_stderr.txt")[1].read().decode('utf-8', errors='ignore')
print("LOG:", stderr_log[:3000])

try:
    json_start = out.find('{"results"')
    if json_start >= 0:
        data = json.loads(out[json_start:])
        with open("audit_5cases.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("\nSUCESSO!")
        for r in data['results']:
            if 'error' in r:
                print(f"  Caso {r['caso']} ({r.get('tipo','')}): ERRO — {r['error'][:100]}")
            else:
                print(f"  Caso {r['caso']} ({r['tipo']}): {r['chars']} chars | {r.get('outputTokensGpt',0)} tkns | {round(r.get('elapsedMs',0)/1000)}s")
    else:
        print("JSON não encontrado. Saída:", out[:500])
except Exception as e:
    print(f"Parse error: {e}")

client.close()

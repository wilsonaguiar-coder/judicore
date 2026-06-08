import paramiko
import sys
import json
import time

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname='2.24.75.193', username='root', password='Ugaz#@2026ok')

print("=== Step 1: Build packages ===")
build_cmd = """
cd /opt/judicore
source apps/api/.env
export DATABASE_URL GEMINI_API_KEY OPENAI_API_KEY

cd packages/db && npx tsc --noEmit false 2>&1 | tail -3
cd /opt/judicore/packages/ai && npx tsc --noEmit false 2>&1 | tail -3
echo "BUILD DONE"
"""
stdin, stdout, stderr = client.exec_command(build_cmd, timeout=120)
out = stdout.read().decode()
print(out)

# Verifica se gerou o novo arquivo compilado
check_cmd = "ls /opt/judicore/packages/ai/dist/generation-pipeline/"
stdin2, stdout2, _ = client.exec_command(check_cmd)
print("dist/generation-pipeline:", stdout2.read().decode())

print("\n=== Step 2: Rodar auditoria de packages/ai ===")
audit_script = '''
import "../../../apps/api/src/server.js";
'''

# Roda de dentro de packages/ai com tsx que resolve os workspace deps corretamente
run_cmd = """
cd /opt/judicore
source apps/api/.env
export $(grep -v '^#' apps/api/.env | xargs)

cat > /tmp/audit_v2.ts << 'EOF'
import "dotenv/config";
import { GenerationPipeline } from "./packages/ai/src/generation-pipeline/generation.pipeline.js";
import { prisma } from "./packages/db/src/index.js";

const USER_ID = "cmosstzkf00007w17jjo10cwo";

const CASOS = [
  { id: 1, tipo: "Petição Inicial",
    orientacao: "Petição inicial previdenciária - aposentadoria especial por exposição habitual a ruído acima de 85dB durante 25 anos. Operador de máquinas em metalúrgica, PPP e LTCAT. INSS indeferiu alegando EPIs neutralizavam a nocividade.",
    doc: "Carlos Eduardo Ferreira, CPF 987.654.321-00, RG 12.345.678-9, Av. Industrial 500, SP, CEP 01310-100. Metalúrgica Progresso Ltda 01/03/1995 a 01/03/2020. PPP: ruído 92dB sem EPI eficaz. LTCAT 2019 confirma exposição."
  },
  { id: 2, tipo: "Contrarrazões",
    orientacao: "Contrarrazões previdenciárias - recurso INSS questiona apenas RMI de sentença com tempo de contribuição incontroverso (32 anos). Pugnar pelo improvimento do recurso.",
    doc: "Processo 5001234-56.2022.4.03.6100. Ana Paula Souza, CPF 111.222.333-44, Campinas SP. Sentença 15/04/2024: 32 anos, RMI R$3.200,00. INSS recorreu 10/05/2024 apenas quanto à RMI."
  },
  { id: 3, tipo: "Contestação",
    orientacao: "Contestação de indenização por dano moral por negativação indevida. Dívida quitada há 8 meses, negativação permanece. Quantum excessivo R$30.000,00. Pugnar pela improcedência ou redução.",
    doc: "Ré: Financeira Crédito Fácil S.A., CNPJ 00.111.222/0001-33. Roberto Alves Lima, CPF 444.555.666-77. Dívida R$1.200,00 quitada 15/01/2024. Negativação até 20/09/2024. Pedido R$30.000,00."
  },
  { id: 4, tipo: "Sentença",
    orientacao: "Sentença previdenciária - auxílio incapacidade temporária. Laudo atesta incapacidade total 180 dias por hérnia L4-L5. INSS indeferiu. Condenar INSS a implantar e pagar retroativas desde DII.",
    doc: "Processo 5009876-54.2023.4.03.6200. Marcos Vinícius Costa, CPF 555.666.777-88. Perito Dr. João Rodrigues CRM 12345: incapacidade 180 dias, hérnia L4-L5. DII: 05/03/2024. INSS negou 01/04/2024."
  },
  { id: 5, tipo: "Decisão Interlocutória",
    orientacao: "Decisão interlocutória - tutela de urgência previdenciária. Idoso 78 anos sem aposentadoria há 3 meses por erro INSS. Deferir tutela imediata.",
    doc: "Processo 5005555-11.2024.4.03.6300. José Benedito Ferreira, 78 anos, CPF 222.333.444-55, São Paulo SP. Aposentado desde 2015. INSS suspendeu agosto/2024 por erro cadastral. Sem renda há 3 meses."
  }
];

async function main() {
  const results: any[] = [];
  for (const caso of CASOS) {
    process.stderr.write("Gerando Caso " + caso.id + ": " + caso.tipo + "...\\n");
    const t0 = Date.now();
    try {
      const res = await GenerationPipeline.execute({
        userId: USER_ID, pieceType: caso.tipo, userOrientation: caso.orientacao,
        files: [{ buffer: Buffer.from(caso.doc), mimeType: "text/plain", category: "Documentos" }]
      });
      const gen = await prisma.pieceGeneration.findUnique({ where: { id: res.generationId } });
      const elapsed = Date.now() - t0;
      results.push({ caso: caso.id, tipo: caso.tipo, generationId: res.generationId,
        chars: res.draft.length, draft: res.draft,
        inputTokensGpt: gen?.inputTokensGpt, outputTokensGpt: gen?.outputTokensGpt, elapsedMs: elapsed });
      process.stderr.write("  OK: " + res.draft.length + " chars\\n");
    } catch(e: any) {
      results.push({ caso: caso.id, tipo: caso.tipo, error: e.message });
      process.stderr.write("  ERRO: " + e.message + "\\n");
    }
  }
  await prisma.$disconnect();
  process.stdout.write(JSON.stringify({ results }));
}
main();
EOF

npx tsx /tmp/audit_v2.ts 2>/tmp/audit_v2_stderr.txt
"""
print("Executando...")
stdin3, stdout3, _ = client.exec_command(run_cmd, timeout=600)
out3 = stdout3.read().decode('utf-8', errors='ignore')
stderr_log = client.exec_command("cat /tmp/audit_v2_stderr.txt")[1].read().decode('utf-8', errors='ignore')
print("LOG:", stderr_log[:2000])

try:
    json_start = out3.find('{"results"')
    if json_start >= 0:
        data = json.loads(out3[json_start:])
        with open("audit_5cases.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("SUCESSO!")
        for r in data['results']:
            if 'error' in r:
                print(f"  Caso {r['caso']}: ERRO — {r['error']}")
            else:
                print(f"  Caso {r['caso']} ({r['tipo']}): {r['chars']} chars | {r.get('outputTokensGpt',0)} tkns | {round(r.get('elapsedMs',0)/1000)}s")
    else:
        print("JSON não encontrado. Saída:", out3[:500])
except Exception as e:
    print(f"Erro: {e}")

client.close()

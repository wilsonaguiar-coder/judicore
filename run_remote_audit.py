import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

host = "2.24.75.193"
user = "root"
password = "Ugaz#@2026ok"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=host, username=user, password=password)

# Define the typescript code
ts_code = """
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const latestGen = await prisma.pieceGeneration.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (!latestGen) {
    console.log("Nenhuma geracao encontrada.");
    return;
  }

  const extraction = await prisma.legalExtractionRecord.findUnique({
    where: { generationId: latestGen.id }
  });

  const matrix = await prisma.legalMatrixRecord.findUnique({
    where: { generationId: latestGen.id }
  });

  const draft = await prisma.legalDraftRecord.findUnique({
    where: { generationId: latestGen.id }
  });

  console.log("=== Generation ID ===");
  console.log(latestGen.id);
  
  console.log("\\n=== Stats ===");
  console.log(`Input Tokens Gemini: ${latestGen.inputTokensGemini}`);
  console.log(`Output Tokens Gemini: ${latestGen.outputTokensGemini}`);
  console.log(`Input Tokens GPT: ${latestGen.inputTokensGpt}`);
  console.log(`Output Tokens GPT: ${latestGen.outputTokensGpt}`);
  
  console.log("\\n=== Extraction Data ===");
  console.log(JSON.stringify(extraction?.dataJson || {}, null, 2));

  console.log("\\n=== Matrix Data ===");
  console.log(JSON.stringify(matrix?.dataJson || {}, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
"""

sftp = client.open_sftp()
with sftp.file('/opt/judicore/packages/db/get_audit_data.ts', 'w') as f:
    f.write(ts_code)
sftp.close()

cmd = "cd /opt/judicore/packages/db && set -a && source /opt/judicore/apps/api/.env && set +a && npx tsx get_audit_data.ts"
stdin, stdout, stderr = client.exec_command(cmd)

out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')

with open("audit_output.txt", "w", encoding="utf-8") as f:
    f.write(out)
    if err:
        f.write("\\nERRORS:\\n" + err)

print("Output salvo em audit_output.txt")
client.close()

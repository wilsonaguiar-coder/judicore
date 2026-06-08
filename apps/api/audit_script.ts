import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const lastGeneration = await prisma.pieceGeneration.findFirst({
    where: { pieceType: 'PETICAO_INICIAL' },
    orderBy: { createdAt: 'desc' },
    include: { snapshot: true }
  });

  if (!lastGeneration) {
    console.log("Nenhuma geração encontrada.");
    return;
  }

  console.log("Generation ID:", lastGeneration.id);
  console.log("Tokens GPT Input:", lastGeneration.inputTokensGpt);
  console.log("Tokens GPT Output:", lastGeneration.outputTokensGpt);
  
  if (lastGeneration.snapshot) {
     fs.writeFileSync('/opt/judicore/audit_snapshot.json', JSON.stringify(lastGeneration.snapshot, null, 2));
     console.log("Snapshot salvo em /opt/judicore/audit_snapshot.json");
  } else {
     console.log("Sem snapshot!");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

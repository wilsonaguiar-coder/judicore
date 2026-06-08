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

  console.log("=== Generation ID ===");
  console.log(latestGen.id);
  
  console.log("\n=== Stats ===");
  console.log(`Input Tokens Gemini: ${latestGen.inputTokensGemini}`);
  console.log(`Output Tokens Gemini: ${latestGen.outputTokensGemini}`);
  console.log(`Input Tokens GPT: ${latestGen.inputTokensGpt}`);
  console.log(`Output Tokens GPT: ${latestGen.outputTokensGpt}`);
  
  console.log("\n=== Extraction Data ===");
  console.log(JSON.stringify(extraction?.dataJson || {}, null, 2));

  console.log("\n=== Matrix Data ===");
  console.log(JSON.stringify(matrix?.dataJson || {}, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

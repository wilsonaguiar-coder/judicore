import { prisma } from "@judicore/db";
import { GenerationPipeline } from "../src/generation-pipeline/generation.pipeline.js";

async function main() {
  console.log("=== INICIANDO VALIDAÇÃO BETA FECHADO (FASE 12.4.0) ===");

  // 1. Localizar ou criar o usuário 'Comum Teste'
  let user = await prisma.user.findFirst({
    where: { name: "Comum Teste" }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "comum.teste@judicore.com",
        name: "Comum Teste",
        passwordHash: "123",
        monthlyPieceLimit: 50,
        piecesUsedCurrentCycle: 0
      }
    });
    console.log("Usuário 'Comum Teste' criado.");
  } else {
    // Reset quota
    await prisma.user.update({
      where: { id: user.id },
      data: { piecesUsedCurrentCycle: 0 }
    });
    console.log("Usuário 'Comum Teste' encontrado. Quota resetada para 0/50.");
  }

  // 2. Executar Geração Real (COMPLETED)
  console.log("\n-> Executando Geração de Peça...");
  
  const mockFile = {
    buffer: Buffer.from("Declaro para os devidos fins que o segurado trabalhou na lavoura."),
    mimeType: "text/plain",
    category: "Documento principal"
  };

  try {
    const { draft, generationId } = await GenerationPipeline.execute({
      userId: user.id,
      pieceType: "Petição Inicial",
      userOrientation: "Aposentadoria Rural",
      files: [mockFile]
    });

    console.log("[SUCESSO] Rascunho gerado com " + draft.length + " caracteres.");
    console.log("Generation ID:", generationId);

    // 3. Checar Telemetria no BD
    const gen = await prisma.pieceGeneration.findUnique({ where: { id: generationId } });
    console.log("\n-> Telemetria registrada:");
    console.log("- timeGeminiMs:", gen?.timeGeminiMs);
    console.log("- timeLanceDbMs:", gen?.timeLanceDbMs);
    console.log("- timeLexMlMs:", gen?.timeLexMlMs);
    console.log("- timeGptMs:", gen?.timeGptMs);
    console.log("- researchResultsCount:", gen?.researchResultsCount);

    // 4. Checar Cota (COMPLETED = +1)
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    console.log(`\n-> Quota Atualizada: ${updatedUser?.piecesUsedCurrentCycle} / ${updatedUser?.monthlyPieceLimit}`);
    
    if (updatedUser?.piecesUsedCurrentCycle !== 1) {
      console.error("[ERRO] Quota não incrementou corretamente!");
    } else {
      console.log("[OK] Quota incrementou corretamente (+1).");
    }

    // 5. Avaliar Peça
    console.log("\n-> Simulando Avaliação (PieceEvaluation)...");
    await prisma.pieceGeneration.update({
      where: { id: generationId },
      data: { viewedAt: new Date(), evaluatedAt: new Date() }
    });
    
    await prisma.pieceEvaluation.create({
      data: {
        generationId,
        userId: user.id,
        rating: 5,
        category: "UX",
        feedback: "Excelente! A peça ficou ótima e muito bem fundamentada."
      }
    });
    console.log("[OK] Avaliação (5 Estrelas) Registrada.");

  } catch (err: any) {
    console.error("\n[FALHA] Geração falhou:", err.message);
  }

  console.log("\n=== FIM DA VALIDAÇÃO ===");
}

main().catch(console.error);

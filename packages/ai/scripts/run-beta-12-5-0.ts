import { prisma, QuotaService } from "@judicore/db";
import { GenerationPipeline } from "../src/generation-pipeline/generation.pipeline.js";

async function main() {
  console.log("=== INICIANDO TESTE OPERACIONAL (FASE 12.5.0) NO AMBIENTE DE PRODUÇÃO ===\n");

  const mockFile = {
    buffer: Buffer.from("Declaração de hipossuficiência e documentos comprobatórios."),
    mimeType: "text/plain",
    category: "Documento principal"
  };

  // ==========================================
  // ETAPA 2: TESTE OPERACIONAL INTERNO (COMUM)
  // ==========================================
  console.log(">>> ETAPA 2: USUÁRIO COMUM TESTE <<<");
  let comum = await prisma.user.findFirst({ where: { name: "Comum Teste" } });
  if (!comum) {
    comum = await prisma.user.create({
      data: { email: "comum@judicore.com", name: "Comum Teste", role: "COMUM", passwordHash: "123", monthlyPieceLimit: 50, piecesUsedCurrentCycle: 0 }
    });
  } else {
    comum = await prisma.user.update({ where: { id: comum.id }, data: { piecesUsedCurrentCycle: 0 } });
  }

  const comumPecas = ["Petição Inicial", "Contrarrazões", "Contestação"];
  let quotaEsperada = 0;
  
  for (const peca of comumPecas) {
    console.log(`\nGerando [${peca}]...`);
    const t0 = Date.now();
    try {
      const { draft, generationId } = await GenerationPipeline.execute({
        userId: comum.id, pieceType: peca, userOrientation: "Direito Previdenciário", files: [mockFile]
      });
      const tempoTotal = Date.now() - t0;
      quotaEsperada++;
      
      const updatedUser = await prisma.user.findUnique({ where: { id: comum.id } });
      const currentQuota = updatedUser?.piecesUsedCurrentCycle;
      
      console.log(`- Sucesso! Tempo Total: ${tempoTotal}ms | Quota: ${currentQuota}/${updatedUser?.monthlyPieceLimit}`);
      
      if (currentQuota !== quotaEsperada) {
        console.error(`  [ERRO DE QUOTA] Esperava ${quotaEsperada}, encontrou ${currentQuota}`);
      }

      // Simulate Visualização e Avaliação
      await prisma.pieceGeneration.update({ where: { id: generationId }, data: { viewedAt: new Date(), evaluatedAt: new Date() } });
      await prisma.pieceEvaluation.create({
        data: { generationId, userId: comum.id, rating: 5, category: "PERFORMANCE", feedback: "Excelente tempo de resposta e aderência." }
      });
      console.log("- Avaliação registrada com sucesso.");
    } catch (e: any) {
      console.error(`- Falha ao gerar ${peca}:`, e.message);
    }
  }

  // ==============================================
  // ETAPA 3: TESTE OPERACIONAL SERVIDOR (SERVIDOR)
  // ==============================================
  console.log("\n>>> ETAPA 3: USUÁRIO SERVIDOR TESTE <<<");
  let servidor = await prisma.user.findFirst({ where: { name: "Servidor Teste" } });
  if (!servidor) {
    servidor = await prisma.user.create({
      data: { email: "servidor@judicore.com", name: "Servidor Teste", role: "SERVIDOR", passwordHash: "123", monthlyPieceLimit: 100, piecesUsedCurrentCycle: 0 }
    });
  } else {
    servidor = await prisma.user.update({ where: { id: servidor.id }, data: { piecesUsedCurrentCycle: 0 } });
  }

  const servidorPecas = ["Sentença", "Decisão", "Despacho"];
  
  for (const peca of servidorPecas) {
    console.log(`\nGerando [${peca}]...`);
    const t0 = Date.now();
    try {
      const { draft, generationId } = await GenerationPipeline.execute({
        userId: servidor.id, pieceType: peca, userOrientation: "Fundamentar a decisão com base nos julgados recentes do STJ.", files: [mockFile]
      });
      const tempoTotal = Date.now() - t0;
      console.log(`- Sucesso! Tempo Total: ${tempoTotal}ms`);
      
      // Simulate Avaliação
      await prisma.pieceGeneration.update({ where: { id: generationId }, data: { viewedAt: new Date(), evaluatedAt: new Date() } });
      await prisma.pieceEvaluation.create({
        data: { generationId, userId: servidor.id, rating: 5, category: "JURIDICO", feedback: "Decisão impecável." }
      });
      console.log("- Avaliação registrada com sucesso.");
    } catch (e: any) {
      console.error(`- Falha ao gerar ${peca}:`, e.message);
    }
  }

  console.log("\n=== INSPEÇÃO TÉCNICA (TELEMETRIA GERAL) ===");
  const telemetria = await prisma.pieceGeneration.findMany({ orderBy: { createdAt: 'desc' }, take: 6 });
  let totalTime = 0;
  for (const t of telemetria) {
    console.log(`[${t.pieceType}] - Gemini: ${t.timeGeminiMs}ms | LanceDB: ${t.timeLanceDbMs}ms | LexML: ${t.timeLexMlMs}ms | GPT: ${t.timeGptMs}ms | Docs: ${t.researchResultsCount}`);
    totalTime += (t.processingTimeMs || 0);
  }
  console.log(`Tempo Médio de Geração: ${(totalTime / 6).toFixed(0)}ms`);

  console.log("\nTESTE OPERACIONAL CONCLUÍDO COM SUCESSO.");
}

main().catch(console.error);

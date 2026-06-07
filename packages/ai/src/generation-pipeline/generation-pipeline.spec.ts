import { strict as assert } from "assert";
import { test, mock } from "node:test";
import { GenerationPipeline } from "./generation.pipeline.js";
import { PieceBriefService } from "./piece-brief.service.js";
import { WriterService } from "./writer.service.js";
import { QuotaService, prisma } from "@judicore/db";

test("GenerationPipeline executa e não consome cota em falha", async (t) => {
  mock.method(prisma.pieceGeneration, "create", async () => ({ id: "gen-1" }));
  mock.method(prisma.pieceGeneration, "update", async () => ({}));
  
  mock.method(PieceBriefService, "generateBrief", async () => {
    throw new Error("Simulação de Falha do Gemini");
  });
  
  let cotaConsumida = false;
  mock.method(QuotaService, "consumePieceQuota", async () => {
    cotaConsumida = true;
  });

  try {
    await GenerationPipeline.execute({
      userId: "user-1",
      pieceType: "Petição Inicial",
      userOrientation: "Focar em danos",
      files: []
    });
    assert.fail("Deveria ter falhado");
  } catch (err: any) {
    assert(err.message === "Simulação de Falha do Gemini");
  }

  assert(cotaConsumida === false, "Cota não deve ser consumida se houver erro");
});

test("GenerationPipeline executa com sucesso e consome cota", async (t) => {
  mock.method(prisma.pieceGeneration, "create", async () => ({ id: "gen-2" }));
  mock.method(prisma.pieceGeneration, "update", async () => ({}));
  
  mock.method(PieceBriefService, "generateBrief", async () => ({
    tipoPeca: "Petição Inicial",
    resumoDocumentos: "Resumo",
    partesIdentificadas: [],
    cronologia: [],
    fatosRelevantes: [],
    pontosIncontroversos: [],
    pontosControvertidos: [],
    pedidosIdentificados: [],
    tesesIdentificadas: [],
    palavrasChave: ["teste"],
    estrategiaSugerida: "Estratégia",
    riscosIdentificados: [],
    lacunasIdentificadas: [],
    documentosRelevantes: [],
    _metadata: { inputTokens: 10, outputTokens: 20, timeMs: 100 }
  }));
  
  mock.method(WriterService, "generatePiece", async () => ({
    draft: "Peça Rascunho",
    inputTokens: 50,
    outputTokens: 150
  }));

  let cotaConsumida = false;
  mock.method(QuotaService, "consumePieceQuota", async () => {
    cotaConsumida = true;
  });

  const res = await GenerationPipeline.execute({
    userId: "user-1",
    pieceType: "Petição Inicial",
    userOrientation: "Focar em danos",
    files: []
  });

  assert(res === "Peça Rascunho");
  assert(cotaConsumida === true, "Cota DEVE ser consumida quando status = COMPLETED");
});

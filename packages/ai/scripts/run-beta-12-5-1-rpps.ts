import { prisma } from "@judicore/db";
import { GenerationPipeline } from "../src/generation-pipeline/generation.pipeline.js";

async function main() {
  console.log("=== INICIANDO TESTE RPPS FASE 12.5.1 ===\n");

  let comum = await prisma.user.findFirst({ where: { name: "Comum Teste" } });
  if (!comum) {
    comum = await prisma.user.create({
      data: { email: "comum_rpps@test.com", name: "Comum Teste", role: "COMUM", passwordHash: "123", monthlyPieceLimit: 50, piecesUsedCurrentCycle: 0 }
    });
  }

  // Simulando documentos com dados de qualificação
  const rgBuffer = Buffer.from("República Federativa do Brasil. RG: 12.345.678-9, CPF: 123.456.789-00. Nome: Maria Aparecida da Silva, brasileira, casada.");
  const endBuffer = Buffer.from("Comprovante de residência. Avenida Paulista 1000, CEP 01310-100, São Paulo SP. Fatura de energia elétrica.");
  
  const files = [
    { buffer: rgBuffer, mimeType: "text/plain", category: "Documento Pessoal" },
    { buffer: endBuffer, mimeType: "text/plain", category: "Comprovante de Endereço" }
  ];

  const pieceType = "Petição Inicial";
  const userOrientation = "peticionar pela procedência de pedido de paridade de pensão de ex-servidora federal falecida após a EC 41/2003. Utilizar documentos para qualificação.";

  console.log(`Gerando [${pieceType}] RPPS...`);
  const t0 = Date.now();
  try {
    const { draft, generationId } = await GenerationPipeline.execute({
      userId: comum.id, pieceType, userOrientation, files
    });
    const tempoTotal = Date.now() - t0;
    
    console.log(`\n--- PEÇA GERADA EM ${tempoTotal}ms ---\n`);
    console.log(draft.substring(0, 2500) + "\n...\n[TRUNCADO PARA LOG]");
    
    console.log("\n--- VERIFICAÇÃO RPPS ---");
    console.log("O GPT extraiu o nome Maria Aparecida da Silva? ", draft.includes("Maria Aparecida da Silva"));
    console.log("O GPT extraiu o CPF 123.456.789-00? ", draft.includes("123.456.789-00"));
    console.log("O GPT deixou placeholder para órgão? ", draft.includes("[ÓRGÃO") || draft.includes("[Nome do Órgão") || draft.includes("Ministério da Fazenda"));
    console.log("A peça argumentou sobre paridade (EC 41/2003)? ", draft.includes("41/2003") || draft.includes("41/03") || draft.includes("paridade"));
    
  } catch (e: any) {
    console.error("Erro na geração RPPS:", e);
  }
}

main().catch(console.error);

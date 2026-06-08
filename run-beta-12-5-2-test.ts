import "dotenv/config";
import { GenerationPipeline, GenerationInput } from "@judicore/ai";
import { prisma } from "@judicore/db";

async function main() {
  console.log("Iniciando Teste da Fase 12.5.2 - Paridade de Pensão EC 41/2003");

  const input: GenerationInput = {
    userId: "user_teste_123",
    pieceType: "Petição Inicial",
    userOrientation: "peticionar pela procedência de pedido de paridade de pensão de ex-servidora federal, falecida após a ec 41/2003. O autor é João da Silva, marido da falecida Maria da Silva. CPF 123.456.789-00, residente na Rua das Flores, 123, Brasília, DF, CEP 70000-000.",
    files: [
      {
        buffer: Buffer.from("Documento de identificação: João da Silva, CPF 123.456.789-00. Endereço: Rua das Flores, 123, Brasília, DF, CEP 70000-000. Fatos: Sua esposa Maria da Silva, servidora pública federal, faleceu em 2005. O Ministério Público negou a paridade da pensão."),
        mimeType: "text/plain",
        category: "Documentos Pessoais"
      }
    ]
  };

  try {
    const result = await GenerationPipeline.execute(input);
    console.log("Geração Concluída!");
    console.log("Generation ID:", result.generationId);
    
    // Verificar Snapshot no DB
    const snapshot = await prisma.pieceGenerationSnapshot.findUnique({
      where: { generationId: result.generationId }
    });

    if (snapshot) {
      console.log("\\n=== SNAPSHOT ENCONTRADO ===");
      console.log("LegalMatrix teses count:", (snapshot.legalMatrixJson as any).teses.length);
      console.log("Stf/Stj Total encontrados na pesquisa:", (snapshot.researchSummaryJson as any).stfStjTotal);
      console.log("Prompt Snapshot info:", snapshot.promptSnapshotJson);
    } else {
      console.error("FALHA: Snapshot não salvo no banco!");
    }

    const gen = await prisma.pieceGeneration.findUnique({
      where: { id: result.generationId }
    });
    
    console.log("\\n=== TOKENS ===");
    console.log("Input GPT:", gen?.inputTokensGpt);
    console.log("Output GPT:", gen?.outputTokensGpt);
    
    console.log("\\n=== PEÇA GERADA (PRIMEIROS 1000 CARACTERES) ===");
    console.log(result.draft.substring(0, 1000));

  } catch (error) {
    console.error("Erro no teste:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

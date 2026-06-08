import { WriterService } from "../../../../packages/ai/src/generation-pipeline/writer.service.js";
import { LegalMatrixBuilderService } from "../../../../packages/ai/src/generation-pipeline/legal-matrix-builder.service.js";
import { LegalResearchService } from "../../../../packages/ai/src/legal-research/legal-research.service.js";
import fs from "fs";

async function runTest() {
  console.log("=== INICIANDO TESTE DO WRITER (FASE 13) ===");
  
  const keywords = ["aposentadoria", "especial", "ruído", "EPI", "PPP"];
  const userOrientation = "Direito Previdenciário. Aposentadoria Especial. Nível de ruído 90dB. EPI ineficaz Tema 555 STF.";
  const brief = {
    fatosRelevantes: [
      "O segurado trabalhou por 25 anos na Metalúrgica XYZ.",
      "Apresentou PPP indicando ruído acima de 90dB.",
      "A empresa forneceu EPI (protetor auricular)."
    ],
    estrategiaSugerida: "Demonstrar que o ruído acima de 90dB garante tempo especial mesmo com EPI, conforme Tema 555 do STF.",
    tesesIdentificadas: [
      "Caracterização da atividade especial por exposição a ruído superior a 85dB (Decreto 3.048/99 e Lei 8.213/91).",
      "Ineficácia do EPI para neutralizar os efeitos nocivos do ruído (Tema 555 / ARE 664.335 STF)."
    ],
    pedidosIdentificados: ["Concessão da Aposentadoria Especial"]
  };

  console.log("1. Buscando Pesquisa Jurídica...");
  const research = await LegalResearchService.executeResearch(keywords, userOrientation, false);
  
  console.log("2. Construindo LegalMatrix...");
  const legalMatrix = await LegalMatrixBuilderService.buildMatrix(brief as any, research);

  console.log("3. Gerando PETIÇÃO INICIAL...");
  const peticaoInicial = await WriterService.generatePiece(
    "PETICAO_INICIAL",
    userOrientation,
    brief as any,
    research,
    { nome: "João da Silva", cpf: "123.456.789-00" },
    legalMatrix
  );
  
  fs.writeFileSync("test_peticao.md", peticaoInicial.draft);
  console.log(`Petição Inicial gerada: ${peticaoInicial.outputTokens} tokens.`);

  console.log("4. Gerando SENTENÇA...");
  const sentenca = await WriterService.generatePiece(
    "SENTENCA",
    "Sentença julgando procedente o pedido de aposentadoria especial. Acolher tese do ruído e afastar eficácia do EPI.",
    brief as any,
    research,
    { nome: "João da Silva", cpf: "123.456.789-00" },
    legalMatrix
  );
  
  fs.writeFileSync("test_sentenca.md", sentenca.draft);
  console.log(`Sentença gerada: ${sentenca.outputTokens} tokens.`);

  console.log("5. Gerando DESPACHO SIMPLES...");
  const despacho = await WriterService.generatePiece(
    "DESPACHO",
    "Intime-se o INSS para apresentar cópia integral do processo administrativo em 15 dias.",
    brief as any,
    research,
    { nome: "João da Silva", cpf: "123.456.789-00" },
    legalMatrix
  );
  
  fs.writeFileSync("test_despacho.md", despacho.draft);
  console.log(`Despacho gerado: ${despacho.outputTokens} tokens.`);

  console.log("=== TESTES CONCLUÍDOS ===");
}

runTest().catch(console.error);

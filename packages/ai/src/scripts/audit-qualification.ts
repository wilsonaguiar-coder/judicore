import * as fs from "fs";
import * as path from "path";
import { DocumentExtractor } from "../document-processing/extractor.js";
import { ContextReducer } from "../document-processing/reducer.js";
import { QualificationExtractor } from "../document-processing/qualification-extractor.js";
import { PieceBriefService } from "../generation-pipeline/piece-brief.service.js";
import { LegalResearchService } from "../legal-research/legal-research.service.js";
import { LegalMatrixBuilderService } from "../generation-pipeline/legal-matrix-builder.service.js";
import { WriterService } from "../generation-pipeline/writer.service.js";
import { buildPremiumDocumentPrompt } from "../prompts.js";

async function main() {
  console.log("Iniciando Auditoria de Qualificação do Pipeline...");

  const testDoc = `
  PROCURAÇÃO AD JUDICIA
  
  OUTORGANTE: Wilson Aguiar Souza, brasileiro, casado, engenheiro, portador do RG 12.345.678-9 SSP/SP e do CPF 123.456.789-00, residente e domiciliado na Avenida Paulista, nº 1000, apto 50, Bela Vista, São Paulo, SP, CEP 01310-100.
  
  Pelo presente instrumento, nomeia e constitui seu bastante procurador o advogado Dr. João da Silva.
  `;

  // 1. Reducer
  const reducer = new ContextReducer();
  const reducedText = reducer.process(testDoc, "Procuração", 80000);
  fs.writeFileSync("context_reducer_snapshot.json", JSON.stringify({ reducedText }, null, 2));

  // 2. Qualificação
  const qualData = QualificationExtractor.extract(reducedText);
  fs.writeFileSync("qualification_snapshot.json", JSON.stringify(qualData, null, 2));
  
  const qualBlock = QualificationExtractor.formatToPrompt(qualData);
  const combinedText = qualBlock + "\n\n" + reducedText;

  // 3. PieceBrief
  const brief = await PieceBriefService.generateBrief(combinedText, "Petição Inicial", "Aposentadoria");
  fs.writeFileSync("piecebrief_snapshot.json", JSON.stringify(brief, null, 2));

  // 4. Matrix
  const mockResearch = {
    teses: [
      {
        tese: "Tese 1",
        legislacao: [],
        jurisprudencia: [],
        descartes: [],
        queries: { lanceDB: "", lexMLQueries: [] }
      }
    ],
    timeLanceDbMs: 0,
    timeLexMlMs: 0,
  };
  const matrix = await LegalMatrixBuilderService.buildMatrix(brief, mockResearch);
  fs.writeFileSync("legalmatrix_snapshot.json", JSON.stringify(matrix, null, 2));

  // 5. Writer Prompts
  const legalMatrixFormatted = LegalMatrixBuilderService.formatToMarkdown(matrix);
  const systemPrompt = buildPremiumDocumentPrompt(
    "PETICAO_INICIAL",
    [], 
    legalMatrixFormatted,
    JSON.stringify(brief),
    "Aposentadoria"
  );
  
  fs.writeFileSync("writer_system_prompt.txt", systemPrompt);
  fs.writeFileSync("writer_user_prompt.txt", "Redija a peça final completa agora. ATENÇÃO MÁXIMA: É ESTRITAMENTE PROIBIDO escrever 'vem à presença', 'vem perante', 'Diante do exposto, requer', 'Ante o exposto, requer' ou 'Termos em que, Pede deferimento'. Vá direto ao ponto, use redação institucional e direta.");

  // Checagem
  const checkList = ["Wilson", "123.456.789-00", "12.345.678-9", "Avenida Paulista", "01310-100", "São Paulo", "SP"];

  const check = (texto: string) => {
      const results: Record<string, boolean> = {};
      for (const t of checkList) {
          results[t] = texto.includes(t);
      }
      return results;
  };

  const c1 = check(JSON.stringify({ reducedText }));
  const c2 = check(JSON.stringify(qualData));
  const c3 = check(JSON.stringify(brief));
  const c4 = check(JSON.stringify(matrix));
  const c5 = check(systemPrompt);

  let relatorio = `=== RELATÓRIO DE AUDITORIA ===\n\n`;

  const printF = (nome: string, map: Record<string, boolean>) => {
      relatorio += `ETAPA: ${nome}\n`;
      for (const [k, v] of Object.entries(map)) {
          relatorio += `  - ${k}: ${v ? "SIM" : "NÃO"}\n`;
      }
      relatorio += "\n";
  };

  printF("1. ContextReducer (context_reducer_snapshot.json)", c1);
  printF("2. QualificationExtractor (qualification_snapshot.json)", c2);
  printF("3. PieceBrief (piecebrief_snapshot.json)", c3);
  printF("4. LegalMatrix (legalmatrix_snapshot.json)", c4);
  printF("5. WriterSystemPrompt (writer_system_prompt.txt)", c5);

  fs.writeFileSync("relatorio_auditoria_qualificacao.txt", relatorio);
  console.log(relatorio);
  console.log("Auditoria finalizada. Arquivos salvos localmente.");
}

main().catch(console.error);

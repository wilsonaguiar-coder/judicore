import { WriterService } from "../generation-pipeline/writer.service.js";
import { PieceBrief } from "../generation-pipeline/piece-brief.service.js";
import { LegalMatrixBuilderService } from "../generation-pipeline/legal-matrix-builder.service.js";
import type { LegalResearchPack } from "../legal-research/legal-research.service.js";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const brief: any = {
    tipoPeca: "Petição Inicial",
    fatosRelevantes: [
      "O autor é viúvo e pensionista de uma ex-servidora pública federal.",
      "O óbito da servidora instituidora da pensão ocorreu após a vigência da Emenda Constitucional nº 41/2003.",
      "O autor busca o direito à paridade, para que sua pensão seja reajustada nos mesmos moldes da ativa."
    ],
    tesesIdentificadas: [
      "A pensão por morte rege-se pela lei vigente na data do óbito do instituidor (tempus regit actum).",
      "A EC 41/2003 extinguiu a regra geral de paridade e integralidade para as aposentadorias e pensões do serviço público.",
      "Tese de exceção (direito adquirido): O direito à pensão com paridade é assegurado se o servidor instituidor, embora falecido após a EC 41/2003, já houvesse preenchido todos os requisitos para se aposentar com direito à paridade antes de seu falecimento. Aplicação do entendimento firmado pelo STF no Tema 396 de Repercussão Geral (RE 603.580)."
    ],
    palavrasChave: [
      "pensão por morte", "servidor público", "paridade", "EC 41/2003",
      "direito adquirido", "Tema 396", "RE 603.580", "EC 47/2005"
    ],
    pedidosIdentificados: ["Concessão da paridade e pagamento dos atrasados"],
    // _metadata: { inputTokens: 100, outputTokens: 100 }
  };

  const userOrientation = "peticionar pela procedência de pedido de paridade de pensão de ex-servidora federal, falecida após a ec 41/2003.";

  // Mock simulando o funcionamento perfeito do motor após a Fase 13.2 (já validado)
  const mockResearch: LegalResearchPack = {
    timeLanceDbMs: 150,
    timeLexMlMs: 250,
    teses: [
      {
        tese: brief.tesesIdentificadas![0],
        queries: { lanceDB: "query", lexMLQueries: [] },
        jurisprudencia: [
          { titulo: "Súmula 340 STJ", tribunal: "STJ", fonte: "LanceDB", score: 0.9, ementa: "A lei aplicável à concessão de pensão previdenciária por morte é aquela vigente na data do óbito do segurado.", conteudo: "A lei aplicável à concessão de pensão previdenciária por morte é aquela vigente na data do óbito do segurado." }
        ],
        legislacao: [],
        descartes: []
      },
      {
        tese: brief.tesesIdentificadas![1],
        queries: { lanceDB: "query", lexMLQueries: [] },
        jurisprudencia: [],
        legislacao: [
          { titulo: "Art. 40 da CF/88", tribunal: "", fonte: "LegisDB", score: 0.9, conteudo: "Aos servidores titulares de cargos efetivos da União..." }
        ],
        descartes: []
      },
      {
        tese: brief.tesesIdentificadas![2],
        queries: { lanceDB: "query", lexMLQueries: [] },
        jurisprudencia: [
          { titulo: "RE 603.580 / Tema 396", tribunal: "STF", fonte: "LanceDB", score: 0.95, ementa: "RECURSO EXTRAORDINÁRIO. PREVIDENCIÁRIO. PENSÃO POR MORTE. PARIDADE. REGRAS DE TRANSIÇÃO. EC 41 E 47. TEMA 396.", conteudo: "RECURSO EXTRAORDINÁRIO. PREVIDENCIÁRIO. PENSÃO POR MORTE. PARIDADE. REGRAS DE TRANSIÇÃO. EC 41 E 47. TEMA 396." }
        ],
        legislacao: [
           { titulo: "Art. 3º da EC 47/2005", tribunal: "", fonte: "LexML", score: 0.85, conteudo: "Ressalvado o direito de opção à aposentadoria pelas normas estabelecidas..." }
        ],
        descartes: []
      }
    ]
  };

  console.log("1. Construindo a LegalMatrix isolada e limpa (Fase 13.2)...");
  const matrix = await LegalMatrixBuilderService.buildMatrix(brief, mockResearch);
  const matrixMarkdown = LegalMatrixBuilderService.formatToMarkdown(matrix);
  
  console.log(`Matrix Gerada com Sucesso (${matrixMarkdown.length} caracteres)`);

  const qualData = {
      autor: { nome: "João Silva", qualificacao: "viúvo, pensionista federal" },
      reu: { nome: "União Federal", qualificacao: "pessoa jurídica de direito público" }
  };

  console.log("2. Invocando GPT Writer (Fase 13.3.1)... Aguardando LLM...");
  try {
      const startTime = Date.now();
      const { draft: finalPiece, styleValidation } = await WriterService.generatePiece(
          "Petição Inicial",
          userOrientation,
          brief,
          mockResearch,
          qualData,
          matrix
      );
      
      const elaps = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`Peça gerada em ${elaps}s! (${finalPiece.length} caracteres)`);

      if (styleValidation) {
          console.log(`\n=== STYLE LINTER REPORT ===`);
          console.log(`STYLE_SCORE: ${styleValidation.score}/100`);
          if (styleValidation.warnings.length > 0) {
              console.log(`STYLE_WARNINGS:`);
              styleValidation.warnings.forEach(w => console.log(`  - ${w}`));
          } else {
              console.log(`  Nenhuma infração de estilo detectada! Estilo perfeitamente institucional.`);
          }
          console.log(`===========================\n`);
      }

      const outPath = path.join(process.cwd(), "peca_final_regression.md");
      fs.writeFileSync(outPath, finalPiece, "utf-8");
      console.log(`Peça final salva em: ${outPath}`);
  } catch (error) {
      console.error("Erro na geração pelo LLM:", error);
  }
}

main().catch(console.error);

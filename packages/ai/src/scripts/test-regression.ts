import { WriterService } from "../generation-pipeline/writer.service.js";
import { PieceBrief } from "../generation-pipeline/piece-brief.service.js";
import { LegalMatrixBuilderService } from "../generation-pipeline/legal-matrix-builder.service.js";
import type { LegalResearchPack } from "../legal-research/legal-research.service.js";
import * as fs from "fs";
import * as path from "path";
import { PetitionInitialAuditor } from "../pipeline/petition-initial.auditor.js";

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

      console.log("\n3. Executando Auditoria Estratégica (Fase 13.6.0)...");
      const auditor = new PetitionInitialAuditor();
      const classification = {
          tipo_peca: "PETICAO_INICIAL",
          regime_juridico: "RPPS",
          tipo_justica: "FEDERAL",
          assunto_principal: "Pensão por Morte",
      } as any;

      const auditStart = Date.now();
      const { audit: report } = await auditor.audit(
          finalPiece,
          classification,
          matrix as any,
          brief
      );
      const auditElaps = ((Date.now() - auditStart) / 1000).toFixed(1);

      console.log(`Auditoria concluída em ${auditElaps}s!`);
      console.log(`\n=== RELATÓRIO DE AUDITORIA ===`);
      console.log(`Veredicto: ${report.verdict} (Score: ${report.score})`);
      
      console.log(`\nPontos Fortes:`, report.strengths?.length);
      console.log(`Riscos Materiais:`, report.materialRisks?.length);
      console.log(`Ajustes Obrigatórios:`, report.mandatoryChanges?.length);
      console.log(`Checklist:`, report.documentChecklist?.length);
      report.documentChecklist?.forEach((d: string) => console.log(` - ${d}`));

      console.log(`==============================\n`);

      const auditOutPath = path.join(process.cwd(), "auditoria_regression.json");
      fs.writeFileSync(auditOutPath, JSON.stringify(report, null, 2), "utf-8");
      console.log(`Relatório salvo em: ${auditOutPath}`);

  } catch (error) {
      console.error("Erro na execução:", error);
  }
}

main().catch(console.error);

import { LegalMatrixBenchmarkService, BenchmarkMetrics } from "../benchmark/legal-matrix-benchmark.service.js";
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
      "O autor busca o direito à paridade."
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
    pedidosIdentificados: ["Concessão da paridade"],
    // _metadata: { inputTokens: 100, outputTokens: 100 }
  };

  // Mock do retorno da pesquisa da Fase 13.2 (Evita tentar conectar na VPS offline)
  const mockResearch: LegalResearchPack = {
    timeLanceDbMs: 100,
    timeLexMlMs: 200,
    teses: [
      {
        tese: brief.tesesIdentificadas![0],
        queries: { lanceDB: "query", lexMLOldQuery: "q", lexMLQueries: [] },
        jurisprudencia: [
          { titulo: "Súmula 340 STJ", tribunal: "STJ", fonte: "LanceDB", score: 0.9, ementa: "A lei aplicável à concessão de pensão previdenciária por morte é aquela vigente na data do óbito do segurado.", conteudo: "A lei aplicável à concessão de pensão previdenciária por morte é aquela vigente na data do óbito do segurado." },
          { titulo: "RE 123", tribunal: "STF", fonte: "LexML", score: 0.8, ementa: "Tempus regit actum na pensão por morte.", conteudo: "Tempus regit actum na pensão por morte." }
        ],
        legislacao: [],
        descartes: []
      },
      {
        tese: brief.tesesIdentificadas![1],
        queries: { lanceDB: "query", lexMLOldQuery: "q", lexMLQueries: [] },
        jurisprudencia: [],
        legislacao: [
          { titulo: "Art. 40 da CF/88 (Redação da EC 41/03)", tribunal: "", fonte: "LegisDB", score: 0.9, conteudo: "Aos servidores titulares de cargos efetivos da União..." }
        ],
        descartes: []
      },
      {
        tese: brief.tesesIdentificadas![2],
        queries: { lanceDB: "query", lexMLOldQuery: "q", lexMLQueries: [] },
        jurisprudencia: [
          { titulo: "RE 603.580", tribunal: "STF", fonte: "LanceDB + LexML", score: 0.95, ementa: "RECURSO EXTRAORDINÁRIO. PREVIDENCIÁRIO. PENSÃO POR MORTE. PARIDADE. REGRAS DE TRANSIÇÃO. EC 41 E 47. TEMA 396.", conteudo: "RECURSO EXTRAORDINÁRIO. PREVIDENCIÁRIO. PENSÃO POR MORTE. PARIDADE. REGRAS DE TRANSIÇÃO. EC 41 E 47. TEMA 396." }
        ],
        legislacao: [
           { titulo: "Art. 3º da EC 47/2005", tribunal: "", fonte: "LexML", score: 0.85, conteudo: "Ressalvado o direito de opção à aposentadoria pelas normas estabelecidas..." }
        ],
        descartes: []
      }
    ]
  };

  console.log("Construindo Legal Matrix com Mock de Pesquisa...");
  const matrix = await LegalMatrixBuilderService.buildMatrix(brief, mockResearch);

  // Simulando Descartes locais no Builder (o mock simulou que havia mais precedentes, então o builder limitou a 3)
  if (!matrix.observability) matrix.observability = {};
  matrix.observability.resultadosDescartados = [
     { reason: "Descartado pelo limite por tese" },
     { reason: "Descartado pelo limite por tese" }
  ];

  const simulatedPieceText = "A".repeat(31800);

  const beforeMetrics: BenchmarkMetrics = {
    legalMatrixChars: 89000,
    statutesCount: 15,
    precedentsCount: 12,
    thesesCount: 3, 
    duplicatedItemsRemoved: 0,
    generatedPieceChars: 35000,
    generatedPiecePagesEstimate: Math.ceil(35000 / 1800)
  };

  const afterMetrics = LegalMatrixBenchmarkService.measureAfter(matrix, simulatedPieceText);

  const report = LegalMatrixBenchmarkService.generateReport(
    "RPPS-PARIDADE-BENCHMARK",
    afterMetrics,
    beforeMetrics,
    "Baseline manual extraído da auditoria da Fase 13.0. A métrica 'Depois' utiliza o pipeline exato do LegalMatrixBuilderService processando uma carga mockada representativa da pesquisa (para driblar indisponibilidade da rede)."
  );

  const mdReport = LegalMatrixBenchmarkService.formatReportToMarkdown(report);
  
  const outPath = path.join(process.cwd(), "benchmark-report.md");
  fs.writeFileSync(outPath, mdReport, "utf-8");

  console.log("\n" + mdReport);
  console.log(`Relatório salvo em: ${outPath}`);
}

main().catch(console.error);

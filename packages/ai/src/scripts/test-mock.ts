import { PieceBrief } from "../generation-pipeline/piece-brief.service.js";

// Monkey patch manual (Mock)
import * as dbObj from "@judicore/db";
import * as searchObj from "@judicore/search";

(dbObj as any).PrismaClient = class {
    legisDevice = { findMany: async () => [] }
};

(searchObj as any).searchLanceDB = async () => [
    { titulo: "RE 870717", tribunal: "STF", ementa: "Pensão por morte. Aplicação da lei vigente na data do óbito do instituidor.", conteudo: "Pensão por morte. Aplicação da lei vigente na data do óbito do instituidor." },
    { titulo: "RE 1376169", tribunal: "STF", ementa: "RECURSO EXTRAORDINÁRIO. PARIDADE. TEMA RG Nº 396.", conteudo: "RECURSO EXTRAORDINÁRIO. PARIDADE. TEMA RG Nº 396." }
];

import { LegalResearchService } from "../legal-research/legal-research.service.js";
import { LegalMatrixBuilderService } from "../generation-pipeline/legal-matrix-builder.service.js";

async function main() {
  const brief: any = {
    tipoPeca: "Petição Inicial",
    fatosRelevantes: ["O óbito ocorreu após a vigência da EC 41/2003."],
    tesesIdentificadas: [
      "A pensão por morte rege-se pela lei vigente (tempus regit actum).",
      "A EC 41/2003 extinguiu a regra geral de paridade.",
      "O direito à pensão com paridade é assegurado se o servidor instituidor, preencheu todos os requisitos. Tema 396 STF (RE 603.580)."
    ],
    palavrasChave: [
      "pensão por morte", "paridade", "EC 41/2003",
      "direito adquirido", "Tema 396", "RE 603.580", "EC 47/2005"
    ],
    pedidosIdentificados: ["Concessão da paridade"],
    // _metadata: { inputTokens: 100, outputTokens: 100 }
  };

  const isTrabalhista = false;
  const userOrientation = "peticionar pela procedência de pedido de paridade de pensão de ex-servidora federal, falecida após a ec 41/2003.";

  console.log("Executando Legal Research Mockado...");
  const research = await LegalResearchService.executeResearch(brief, userOrientation, isTrabalhista, "CIVIL");

  console.log("\n=== QUERIES GERADAS POR TESE ===");
  console.log(JSON.stringify(research.teses.map(t => ({ tese: t.tese, queries: t.queries })), null, 2));

  console.log("\nConstruindo Legal Matrix...");
  const matrix = await LegalMatrixBuilderService.buildMatrix(brief, research);

  console.log("\n=== OBSERVABILITY MATRIX ===");
  console.log(JSON.stringify(matrix.observability, null, 2));
}

main().catch(console.error);

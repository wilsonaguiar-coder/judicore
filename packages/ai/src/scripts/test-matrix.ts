import { PieceBrief } from "../generation-pipeline/piece-brief.service.js";
import { LegalResearchService } from "../legal-research/legal-research.service.js";
import { LegalMatrixBuilderService } from "../generation-pipeline/legal-matrix-builder.service.js";
import { PrismaClient } from "@judicore/db";

const prisma = new PrismaClient();


async function main() {
  const brief: PieceBrief = {
    tipoPeca: "Petição Inicial",
    fatosRelevantes: [
      "O autor é viúvo e pensionista de uma ex-servidora pública federal.",
      "O óbito da servidora instituidora da pensão ocorreu após a vigência da Emenda Constitucional nº 41/2003.",
      "O autor busca o direito à paridade, para que sua pensão seja reajustada nos mesmos moldes e datas da remuneração dos servidores da ativa."
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
    _metadata: { inputTokens: 100, outputTokens: 100 }
  };

  const isTrabalhista = false;
  const userOrientation = "peticionar pela procedência de pedido de paridade de pensão de ex-servidora federal, falecida após a ec 41/2003.";

  console.log("Executando Legal Research...");
  const research = await LegalResearchService.executeResearch(brief.palavrasChave, userOrientation, isTrabalhista);

  console.log("Construindo Legal Matrix...");
  const matrix = await LegalMatrixBuilderService.buildMatrix(brief, research);

  console.log("=== OBSERVABILITY ===");
  console.log(JSON.stringify(matrix.observability, null, 2));
  
  console.log("=== MATRIX MARKDOWN ===");
  console.log(LegalMatrixBuilderService.formatToMarkdown(matrix));

}

main().catch(console.error).finally(() => prisma.$disconnect());

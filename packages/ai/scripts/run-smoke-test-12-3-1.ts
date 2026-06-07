import "dotenv/config";
import { GenerationPipeline } from "../src/generation-pipeline/generation.pipeline.js";
import { prisma, QuotaService } from "@judicore/db";

import { mock } from "node:test";

const userGuid = "cm0testuser" + Date.now();

async function setup() {
  mock.method(prisma.pieceGeneration, "create", async () => ({ id: "mock-id" }));
  mock.method(prisma.pieceGeneration, "update", async () => ({}));
  mock.method(prisma.user, "findUnique", async () => ({
    id: userGuid,
    piecesUsedCurrentCycle: 1,
    monthlyPieceLimit: 50
  }));
  mock.method(QuotaService, "consumePieceQuota", async () => {});
  console.log("Setup concluído com mocks do Prisma.");
}

async function runCase(
  caseName: string,
  pieceType: string,
  userOrientation: string,
  mockExtractedText: string
) {
  console.log(`\n================================`);
  console.log(`EXECUTANDO CASO: ${caseName}`);
  console.log(`================================\n`);

  // Mock extractor and reducer just to pass the text directly
  const input = {
    userId: userGuid,
    pieceType,
    userOrientation,
    files: [{ buffer: Buffer.from(mockExtractedText), mimeType: "text/plain", category: "Documento principal" }]
  };

  try {
    const draft = await GenerationPipeline.execute(input);
    console.log(`[SUCESSO] Peça gerada com ${draft.length} caracteres.\n`);
    console.log(draft.substring(0, 1000) + "\n... (truncado)");
  } catch (err: any) {
    console.error(`[FALHA] Erro na geração: ${err.message}`);
  }

  // Verificação de Cota e BD
  const user = await prisma.user.findUnique({ where: { id: userGuid } });
  console.log(`Cotas usadas: ${user?.piecesUsedCurrentCycle}`);
}

async function main() {
  await setup();

  const case1 = `
NOME: JOAO DA SILVA
CNIS: Vínculos de 1990 a 2020 na empresa METALURGICA S/A.
PPP: Consta exposição a ruído de 90dB no período de 1990 a 2010.
INSS: Benefício de aposentadoria especial indeferido por falta de tempo especial comprovado.
`;

  await runCase(
    "CASO 1: PETIÇÃO INICIAL PREVIDENCIÁRIA",
    "Petição Inicial Previdenciária",
    "Pleitear aposentadoria especial com reconhecimento dos períodos especiais.",
    case1
  );

  const case2 = `
SENTENÇA: O juízo a quo reconheceu o tempo de contribuição de 35 anos do autor, mas negou o direito à aposentadoria por erro material na data do requerimento.
RECURSO INSS: O INSS apelou alegando que o tempo de contribuição não foi provado, ignorando as provas documentais acolhidas na sentença.
`;

  await runCase(
    "CASO 2: CONTRARRAZÕES PREVIDENCIÁRIAS",
    "Contrarrazões",
    "Contrarrazoar destacando que o tempo de contribuição já foi reconhecido na sentença e constitui questão incontroversa.",
    case2
  );

  const case3 = `
PETIÇÃO INICIAL: A parte autora pede restabelecimento de auxílio-doença cessado indevidamente. Alega incapacidade ortopédica.
CONTESTAÇÃO: O INSS alega ausência de incapacidade baseada na perícia administrativa.
PERÍCIA JUDICIAL: O perito constatou incapacidade total e temporária para o trabalho habitual desde a data da cessação.
`;

  await runCase(
    "CASO 3: SENTENÇA PREVIDENCIÁRIA",
    "Sentença",
    "Analisar integralmente os pedidos e produzir minuta de sentença.",
    case3
  );

  console.log("\nExecução concluída.");
}

main().catch(console.error);

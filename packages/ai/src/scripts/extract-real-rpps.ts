import { prisma } from "@judicore/db";
import * as fs from "fs";

async function main() {
  const gen = await prisma.pieceGeneration.findFirst({
    where: {
      generatedText: {
        contains: "FRANCISCO WILSON DE BRITO AGUIAR"
      }
    },
    include: {
      snapshot: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!gen) {
    console.log("EXECUÇÃO NÃO ENCONTRADA NO BANCO DE DADOS.");
    return;
  }

  const snap = gen.snapshot;

  const qualJson = snap?.qualificationJson || {};
  const briefJson = snap?.pieceBriefJson || {};
  const researchJson = snap?.researchSummaryJson || {};
  const matrixJson = snap?.legalMatrixJson || {};
  const promptJson: any = snap?.promptSnapshotJson || {};

  fs.writeFileSync("qualification_extractor_output.json", JSON.stringify(qualJson, null, 2));
  fs.writeFileSync("piecebrief_raw.json", JSON.stringify(briefJson, null, 2));
  fs.writeFileSync("legalresearch_raw.json", JSON.stringify(researchJson, null, 2));
  fs.writeFileSync("legalmatrix_raw.json", JSON.stringify(matrixJson, null, 2));
  fs.writeFileSync("writer_system_prompt.txt", promptJson.systemPromptFull || promptJson.resumoInicial || "N/A");
  fs.writeFileSync("writer_user_prompt.txt", promptJson.userPromptFull || "N/A");
  fs.writeFileSync("writer_final_payload.json", JSON.stringify(promptJson.gptPayloadFull || {}, null, 2));
  fs.writeFileSync("writer_response_raw.txt", gen.generatedText || "N/A");

  const metadata = {
    requestId: gen.id,
    timestamp: gen.createdAt.toISOString(),
    providerPieceBrief: "Gemini 1.5 Pro",
    providerWriter: "GPT-4o",
    inputTokensGemini: gen.inputTokensGemini,
    outputTokensGemini: gen.outputTokensGemini,
    inputTokensGpt: gen.inputTokensGpt,
    outputTokensGpt: gen.outputTokensGpt,
    commitHash: promptJson.commitHash || "N/A",
    promptHash: promptJson.hash || "N/A"
  };
  fs.writeFileSync("metadata_execution.json", JSON.stringify(metadata, null, 2));

  console.log("2. Informações da Execução:");
  console.log(`* requestId: ${gen.id}`);
  console.log(`* timestamp: ${gen.createdAt.toISOString()}`);
  console.log(`* commitHash: ${promptJson.commitHash || "N/A (execução anterior ao v13.5.3)"}`);
  console.log(`* promptHash: ${promptJson.hash || "N/A"}`);
  console.log(`* provider PieceBrief: Gemini 1.5 Pro`);
  console.log(`* provider Writer: GPT-4o`);

  const s1 = JSON.stringify(qualJson);
  const s2 = JSON.stringify(briefJson);
  const s3 = promptJson.systemPromptFull || promptJson.resumoInicial || "";
  const s4 = JSON.stringify(promptJson.gptPayloadFull || {});
  const s5 = gen.generatedText || "";

  const check = (str: string, term: string) => str.includes(term) ? "SIM" : "NÃO";

  const name = "FRANCISCO WILSON DE BRITO AGUIAR";
  console.log("\n4. Validar objetivamente (NOME):");
  console.log(`[${check(s1, name) === 'SIM' ? 'x' : ' '}] qualification_extractor_output.json - ${check(s1, name)}`);
  console.log(`[${check(s2, name) === 'SIM' ? 'x' : ' '}] piecebrief_raw.json - ${check(s2, name)}`);
  console.log(`[${check(s3, name) === 'SIM' ? 'x' : ' '}] writer_system_prompt.txt - ${check(s3, name)}`);
  console.log(`[${check(s4, name) === 'SIM' ? 'x' : ' '}] writer_final_payload.json - ${check(s4, name)}`);
  console.log(`[${check(s5, name) === 'SIM' ? 'x' : ' '}] writer_response_raw.txt - ${check(s5, name)}`);

  const cpf = "810.848.973-34";
  console.log("\n5. Validar objetivamente (CPF):");
  console.log(`[${check(s1, cpf) === 'SIM' ? 'x' : ' '}] qualification_extractor_output.json - ${check(s1, cpf)}`);
  console.log(`[${check(s2, cpf) === 'SIM' ? 'x' : ' '}] piecebrief_raw.json - ${check(s2, cpf)}`);
  console.log(`[${check(s3, cpf) === 'SIM' ? 'x' : ' '}] writer_system_prompt.txt - ${check(s3, cpf)}`);
  console.log(`[${check(s4, cpf) === 'SIM' ? 'x' : ' '}] writer_final_payload.json - ${check(s4, cpf)}`);
  console.log(`[${check(s5, cpf) === 'SIM' ? 'x' : ' '}] writer_response_raw.txt - ${check(s5, cpf)}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

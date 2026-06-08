import { prisma } from "@judicore/db";
import * as fs from "fs";

async function main() {
  // Buscar a geração que contenha o texto do Francisco Wilson
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
  fs.writeFileSync("writer_system_prompt.txt", promptJson.systemPrompt || "N/A");
  fs.writeFileSync("writer_user_prompt.txt", promptJson.userPrompt || "N/A");
  fs.writeFileSync("writer_final_payload.txt", JSON.stringify(promptJson.gptPayload || {}, null, 2));
  fs.writeFileSync("writer_response_raw.txt", gen.generatedText || "N/A");

  console.log("2. Informações da Execução:");
  console.log(`* requestId: ${gen.id}`);
  console.log(`* timestamp: ${gen.createdAt.toISOString()}`);
  console.log(`* provider PieceBrief: Gemini 1.5 Pro (inferido)`);
  console.log(`* provider Writer: GPT-4o (inferido)`);

  const s1 = JSON.stringify(qualJson);
  const s2 = JSON.stringify(briefJson);
  const s3 = promptJson.systemPrompt || "";
  const s4 = JSON.stringify(promptJson.gptPayload || {});
  const s5 = gen.generatedText || "";

  const check = (str: string, term: string) => str.includes(term) ? "SIM" : "NÃO";

  const name = "FRANCISCO WILSON DE BRITO AGUIAR";
  console.log("\n4. Validar objetivamente (NOME):");
  console.log(`[${check(s1, name) === 'SIM' ? 'x' : ' '}] qualification_extractor_output.json - ${check(s1, name)}`);
  console.log(`[${check(s2, name) === 'SIM' ? 'x' : ' '}] piecebrief_raw.json - ${check(s2, name)}`);
  console.log(`[${check(s3, name) === 'SIM' ? 'x' : ' '}] writer_system_prompt.txt - ${check(s3, name)}`);
  console.log(`[${check(s4, name) === 'SIM' ? 'x' : ' '}] writer_final_payload.txt - ${check(s4, name)}`);
  console.log(`[${check(s5, name) === 'SIM' ? 'x' : ' '}] writer_response_raw.txt - ${check(s5, name)}`);

  const cpf = "810.848.973-34";
  console.log("\n5. Validar objetivamente (CPF):");
  console.log(`[${check(s1, cpf) === 'SIM' ? 'x' : ' '}] qualification_extractor_output.json - ${check(s1, cpf)}`);
  console.log(`[${check(s2, cpf) === 'SIM' ? 'x' : ' '}] piecebrief_raw.json - ${check(s2, cpf)}`);
  console.log(`[${check(s3, cpf) === 'SIM' ? 'x' : ' '}] writer_system_prompt.txt - ${check(s3, cpf)}`);
  console.log(`[${check(s4, cpf) === 'SIM' ? 'x' : ' '}] writer_final_payload.txt - ${check(s4, cpf)}`);
  console.log(`[${check(s5, cpf) === 'SIM' ? 'x' : ' '}] writer_response_raw.txt - ${check(s5, cpf)}`);

  console.log("\n6. Identificação dos artefatos anteriores:");
  console.log("* qual requestId eles pertencem: Nova execução gerada localmente via script ('dump-artifacts.ts') gerando novos IDs sintéticos.");
  console.log("* qual caso foi utilizado: Script local usando variáveis de mock (Maria Aparecida da Silva).");
  console.log("* por que foram exportados: O assistente recriou uma execução sintética do pipeline via script em vez de consultar a tabela PieceGeneration e PieceGenerationSnapshot no banco de dados.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

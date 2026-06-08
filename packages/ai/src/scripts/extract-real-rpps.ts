import { prisma } from "@judicore/db";
import * as fs from "fs";

async function main() {
  const gen = await prisma.pieceGeneration.findFirst({
    where: {
      generatedText: {
        contains: "Francisco Wilson de Brito Aguiar",
        mode: "insensitive"
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
  const matrixJson: any = snap?.legalMatrixJson || {};
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
    promptHash: promptJson.hash || "N/A",
    commitHash: promptJson.commitHash || "N/A",
    providerPieceBrief: "Gemini 1.5 Pro",
    providerWriter: "GPT-4o",
    inputTokensGemini: gen.inputTokensGemini,
    outputTokensGemini: gen.outputTokensGemini,
    inputTokensGpt: gen.inputTokensGpt,
    outputTokensGpt: gen.outputTokensGpt,
    processingTimeMs: gen.processingTimeMs,
  };
  fs.writeFileSync("metadata_execution.json", JSON.stringify(metadata, null, 2));

  // ── CONSOLE REPORT ──────────────────────────────────────────
  const s1 = JSON.stringify(qualJson);
  const s2 = JSON.stringify(briefJson);
  const s3 = promptJson.systemPromptFull || promptJson.resumoInicial || "";
  const s4 = JSON.stringify(promptJson.gptPayloadFull || {});
  const s5 = gen.generatedText || "";

  const check = (str: string, term: string) => str.includes(term) ? "SIM" : "NÃO";

  console.log("══════════════════════════════════════════════════════");
  console.log("AUDITORIA ARTEFATOS");
  console.log("══════════════════════════════════════════════════════");
  console.log(`requestId  : ${gen.id}`);
  console.log(`timestamp  : ${gen.createdAt.toISOString()}`);
  console.log(`promptHash : ${promptJson.hash || "N/A"}`);
  console.log(`commitHash : ${promptJson.commitHash || "N/A (anterior ao v13.5.3)"}`);
  console.log(`Gemini     : ${gen.inputTokensGemini} in / ${gen.outputTokensGemini} out`);
  console.log(`GPT        : ${gen.inputTokensGpt} in / ${gen.outputTokensGpt} out`);
  console.log(`Tempo total: ${gen.processingTimeMs}ms`);

  const name = "FRANCISCO WILSON DE BRITO AGUIAR";
  const cpf  = "810.848.973-34";

  console.log("\n── NOME presente nos artefatos:");
  console.log(`[${check(s1, name) === 'SIM' ? 'x' : ' '}] qualification_extractor_output.json`);
  console.log(`[${check(s2, name) === 'SIM' ? 'x' : ' '}] piecebrief_raw.json`);
  console.log(`[${check(s3, name) === 'SIM' ? 'x' : ' '}] writer_system_prompt.txt`);
  console.log(`[${check(s4, name) === 'SIM' ? 'x' : ' '}] writer_final_payload.json`);
  console.log(`[${check(s5, name) === 'SIM' ? 'x' : ' '}] writer_response_raw.txt`);

  console.log("\n── CPF presente nos artefatos:");
  console.log(`[${check(s1, cpf) === 'SIM' ? 'x' : ' '}] qualification_extractor_output.json`);
  console.log(`[${check(s2, cpf) === 'SIM' ? 'x' : ' '}] piecebrief_raw.json`);
  console.log(`[${check(s3, cpf) === 'SIM' ? 'x' : ' '}] writer_system_prompt.txt`);
  console.log(`[${check(s4, cpf) === 'SIM' ? 'x' : ' '}] writer_final_payload.json`);
  console.log(`[${check(s5, cpf) === 'SIM' ? 'x' : ' '}] writer_response_raw.txt`);

  // ── v13.6.0: MÉTRICAS DE PESQUISA ────────────────────────────
  const obs = matrixJson?.observability || {};
  const jurSelecionadas: any[] = matrixJson?.jurisprudenciaSelecionada || [];
  const legisSelecionadas: any[] = matrixJson?.legislacaoSelecionada || [];

  console.log("\n── v13.6.0 — Resultados da pesquisa (LegalMatrix):");
  console.log(`Jurisprudência no pool final : ${jurSelecionadas.length}`);
  console.log(`Legislação no pool final     : ${legisSelecionadas.length}`);
  console.log(`LanceDB aproveitados         : ${obs?.resultadosAproveitados?.lanceDB ?? "N/A"}`);
  console.log(`LexML aproveitados           : ${obs?.resultadosAproveitados?.lexML ?? "N/A"}`);
  console.log(`LegisDB aproveitados         : ${obs?.resultadosAproveitados?.legisDB ?? "N/A"}`);

  if (obs?.pesquisaPorTese) {
    for (const tp of obs.pesquisaPorTese) {
      console.log(`\n  Tese: ${String(tp.tese).slice(0, 80)}...`);
      if (tp.queries?.lexMLQueries) {
        for (const q of tp.queries.lexMLQueries) {
          console.log(`    LexML [${q.returnedCount} resultados] ${q.cql}`);
        }
      }
    }
  }

  // ── ARQUIVO COMBINADO DE AUDITORIA ──────────────────────────
  const hr = "=".repeat(80);
  const sections: string[] = [
    `AUDITORIA ARTEFATOS — ${promptJson.hash || "N/A"}`,
    `Execução: ${gen.id}`,
    `Timestamp: ${gen.createdAt.toISOString()}`,
    `CommitHash: ${promptJson.commitHash || "N/A"}`,
    "",
    hr,
    "SEÇÃO 1 — METADATA",
    hr,
    JSON.stringify(metadata, null, 2),
    "",
    hr,
    "SEÇÃO 2 — QUALIFICATION EXTRACTOR",
    hr,
    JSON.stringify(qualJson, null, 2),
    "",
    hr,
    "SEÇÃO 3 — PIECE BRIEF (GEMINI)",
    hr,
    JSON.stringify(briefJson, null, 2),
    "",
    hr,
    "SEÇÃO 4 — LEGAL RESEARCH SUMMARY",
    hr,
    JSON.stringify(researchJson, null, 2),
    "",
    hr,
    "SEÇÃO 5 — LEGAL MATRIX (com observability)",
    hr,
    JSON.stringify(matrixJson, null, 2),
    "",
    hr,
    "SEÇÃO 6 — WRITER SYSTEM PROMPT",
    hr,
    promptJson.systemPromptFull || promptJson.resumoInicial || "N/A",
    "",
    hr,
    "SEÇÃO 7 — WRITER USER PROMPT",
    hr,
    promptJson.userPromptFull || "N/A",
    "",
    hr,
    "SEÇÃO 8 — GPT PAYLOAD (JSON completo)",
    hr,
    JSON.stringify(promptJson.gptPayloadFull || {}, null, 2),
    "",
    hr,
    "SEÇÃO 9 — PEÇA FINAL (WRITER OUTPUT)",
    hr,
    gen.generatedText || "N/A",
  ];

  fs.writeFileSync("audit_artifacts.txt", sections.join("\n"), "utf-8");
  console.log("\n── Arquivo combinado gravado: audit_artifacts.txt");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

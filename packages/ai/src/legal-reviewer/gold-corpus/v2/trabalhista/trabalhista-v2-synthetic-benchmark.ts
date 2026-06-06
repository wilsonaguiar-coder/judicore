/**
 * FASE 9.0.9 — Trabalhista V2 Synthetic Benchmark
 *
 * Benchmark interno sintético: gera os 15 documentos Trabalhista V2 e verifica
 * invariantes sem chamar nenhuma API externa.
 *
 * Execução:
 *   node --import tsx/esm src/legal-reviewer/gold-corpus/v2/trabalhista/trabalhista-v2-synthetic-benchmark.ts
 */

import { generateAllTrabalhistaDocumentsV2 } from "./trabalhista-generator-v2.js";
import { validateGoodDocument } from "./trabalhista-validators.js";

async function run(): Promise<void> {
  console.log("\nTrabalhista V2 Synthetic Benchmark");
  console.log("=".repeat(60));

  const docs = generateAllTrabalhistaDocumentsV2();
  let allPassed = true;

  const qualityCount: Record<string, number> = {};
  const findingsByCase: Array<{ caseId: string; quality: string; findings: number; textLen: number }> = [];

  for (const doc of docs) {
    qualityCount[doc.quality] = (qualityCount[doc.quality] ?? 0) + 1;
    findingsByCase.push({
      caseId: doc.caseId,
      quality: doc.quality,
      findings: doc.derivedExpectedFindings.length,
      textLen: doc.text.length,
    });
  }

  // ── Distribuição por qualidade ─────────────────────────────────────────────
  console.log("\nDistribuição de qualidade:");
  for (const [q, n] of Object.entries(qualityCount)) {
    console.log(`  ${q.padEnd(20)} ${n} caso(s)`);
  }

  // ── Tabela por caso ────────────────────────────────────────────────────────
  console.log("\nResultados por caso:");
  console.log("  CaseId     Quality              Findings  TextLen  Status");
  console.log("  " + "─".repeat(62));

  let errors = 0;

  for (const row of findingsByCase) {
    const isGood   = row.quality === "GOOD";
    const isNonGood = !isGood;
    const findingOk = (isGood && row.findings === 0) || (isNonGood && row.findings >= 1);

    if (!findingOk) {
      errors++;
      allPassed = false;
    }

    const status = findingOk ? "✓" : "✗ FINDINGS_MISMATCH";
    console.log(
      `  ${row.caseId.padEnd(10)} ${row.quality.padEnd(20)} ${String(row.findings).padEnd(9)} ${String(row.textLen).padEnd(8)} ${status}`,
    );
  }

  // ── Validação dos casos GOOD ───────────────────────────────────────────────
  console.log("\nValidação dos casos GOOD:");
  const goodDocs = docs.filter((d) => d.quality === "GOOD");
  for (const doc of goodDocs) {
    const result = validateGoodDocument(doc.text, doc.caseId);
    const status = result.allPassed ? "✓ OK" : "✗ FAILED";
    console.log(`  ${doc.caseId} — ${status}`);
    if (!result.allPassed) {
      allPassed = false;
      errors++;
      for (const [key, vr] of Object.entries(result.results)) {
        if (!vr.passed) {
          for (const err of vr.errors) {
            console.log(`    [${key}] ${err.message}`);
          }
        }
      }
    }
  }

  // ── Invariantes globais ────────────────────────────────────────────────────
  console.log("\nInvariantes globais:");

  const uniqueTexts = new Set(docs.map((d) => d.text));
  const uniqueOk = uniqueTexts.size === docs.length;
  console.log(`  Textos únicos: ${uniqueTexts.size}/15 — ${uniqueOk ? "✓" : "✗"}`);
  if (!uniqueOk) { allPassed = false; errors++; }

  const placeholderOk = docs.every((d) => !d.text.includes("[DATA]") && !d.text.includes("[VALOR]"));
  console.log(`  Sem placeholders: ${placeholderOk ? "✓" : "✗"}`);
  if (!placeholderOk) { allPassed = false; errors++; }

  const deterministicDoc = docs[0];
  if (deterministicDoc) {
    const repeat = generateAllTrabalhistaDocumentsV2()[0];
    const determinismOk = repeat !== undefined && repeat.text === deterministicDoc.text;
    console.log(`  Determinismo (${deterministicDoc.caseId}): ${determinismOk ? "✓" : "✗"}`);
    if (!determinismOk) { allPassed = false; errors++; }
  }

  // ── Resumo ────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  if (allPassed) {
    console.log("BENCHMARK SINTÉTICO APROVADO — todos os invariantes satisfeitos.");
  } else {
    console.error(`BENCHMARK SINTÉTICO FALHOU — ${errors} erro(s) detectado(s).`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Erro fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});

/**
 * FASE 9.0.9 — Tributário V2 Synthetic Benchmark
 *
 * Execução:
 *   node --import tsx/esm src/legal-reviewer/gold-corpus/v2/tributario/tributario-v2-synthetic-benchmark.ts
 */

import { generateAllTributarioDocumentsV2 } from "./tributario-generator-v2.js";
import { validateGoodDocument } from "./tributario-validators.js";

async function run(): Promise<void> {
  console.log("\nTributário V2 Synthetic Benchmark");
  console.log("=".repeat(60));

  const docs = generateAllTributarioDocumentsV2();
  let allPassed = true;
  let errors = 0;

  const qualityCount: Record<string, number> = {};
  for (const d of docs) qualityCount[d.quality] = (qualityCount[d.quality] ?? 0) + 1;

  console.log("\nDistribuição de qualidade:");
  for (const [q, n] of Object.entries(qualityCount)) console.log(`  ${q.padEnd(20)} ${n} caso(s)`);

  console.log("\nResultados por caso:");
  console.log("  CaseId     Quality              Findings  TextLen  Status");
  console.log("  " + "─".repeat(62));

  for (const doc of docs) {
    const isGood = doc.quality === "GOOD";
    const ok = isGood ? doc.derivedExpectedFindings.length === 0 : doc.derivedExpectedFindings.length >= 1;
    if (!ok) { errors++; allPassed = false; }
    console.log(`  ${doc.caseId.padEnd(10)} ${doc.quality.padEnd(20)} ${String(doc.derivedExpectedFindings.length).padEnd(9)} ${String(doc.text.length).padEnd(8)} ${ok ? "✓" : "✗ FINDINGS_MISMATCH"}`);
  }

  console.log("\nValidação dos casos GOOD:");
  for (const doc of docs.filter((d) => d.quality === "GOOD")) {
    const r = validateGoodDocument(doc.text, doc.caseId);
    console.log(`  ${doc.caseId} — ${r.allPassed ? "✓ OK" : "✗ FAILED"}`);
    if (!r.allPassed) { allPassed = false; errors++; for (const [k, v] of Object.entries(r.results)) if (!v.passed) for (const e of v.errors) console.log(`    [${k}] ${e.message}`); }
  }

  console.log("\nInvariantes globais:");
  const uniqueOk = new Set(docs.map((d) => d.text)).size === docs.length;
  console.log(`  Textos únicos: ${uniqueOk ? "✓" : "✗"}`);
  if (!uniqueOk) { allPassed = false; errors++; }

  const placeholderOk = docs.every((d) => !d.text.includes("[DATA]") && !d.text.includes("[VALOR]"));
  console.log(`  Sem placeholders: ${placeholderOk ? "✓" : "✗"}`);
  if (!placeholderOk) { allPassed = false; errors++; }

  const repeat = generateAllTributarioDocumentsV2()[0];
  const detOk = repeat !== undefined && repeat.text === docs[0]?.text;
  console.log(`  Determinismo: ${detOk ? "✓" : "✗"}`);
  if (!detOk) { allPassed = false; errors++; }

  console.log("\n" + "=".repeat(60));
  if (allPassed) console.log("BENCHMARK SINTÉTICO APROVADO — todos os invariantes satisfeitos.");
  else { console.error(`BENCHMARK SINTÉTICO FALHOU — ${errors} erro(s).`); process.exit(1); }
}

run().catch((e) => { console.error("Erro fatal:", e instanceof Error ? e.message : e); process.exit(1); });

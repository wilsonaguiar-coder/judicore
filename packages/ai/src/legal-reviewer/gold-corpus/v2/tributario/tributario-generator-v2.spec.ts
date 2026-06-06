/**
 * FASE 9.0.9 — Testes do Tributário Generator V2
 *
 * Execução: node --import tsx/esm src/legal-reviewer/gold-corpus/v2/tributario/tributario-generator-v2.spec.ts
 */

import { generateAllTributarioDocumentsV2, generateTributarioDocumentV2 } from "./tributario-generator-v2.js";
import { TRIBUTARIO_CASE_IDS } from "./tributario-scenario-factory.js";
import type { GeneratedTributarioDocumentV2 } from "./tributario-scenario.types.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e: unknown) { console.error(`  ✗ ${name}\n      ${e instanceof Error ? e.message : String(e)}`); failed++; }
}

function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }
function assertContains(text: string, sub: string, label: string): void { if (!text.includes(sub)) throw new Error(`${label}: esperado conter "${sub}"`); }
function assertNotContains(text: string, sub: string, label: string): void { if (text.includes(sub)) throw new Error(`${label}: não esperado conter "${sub}"`); }

const allDocs = generateAllTributarioDocumentsV2();
const byId = new Map<string, GeneratedTributarioDocumentV2>(allDocs.map((d) => [d.caseId, d]));
function doc(id: string): GeneratedTributarioDocumentV2 {
  const d = byId.get(id);
  if (!d) throw new Error(`Não encontrado: ${id}`);
  return d;
}

console.log("\nSuite 1 — Cobertura e unicidade");
test("gera exatamente 15 documentos Tributário", () => assert(allDocs.length === 15, `Esperado 15, gerado ${allDocs.length}`));
test("todos os 15 caseIds são cobertos", () => { const ids = new Set(allDocs.map((d) => d.caseId)); for (const id of TRIBUTARIO_CASE_IDS) assert(ids.has(id), `ausente: ${id}`); });
test("cada caseId gera texto diferente", () => { const t = allDocs.map((d) => d.text); assert(new Set(t).size === t.length, "Textos duplicados"); });
test("domínio é TRIBUTARIO em todos", () => { for (const d of allDocs) assert(d.domain === "TRIBUTARIO", `${d.caseId}: domain="${d.domain}"`); });

console.log("\nSuite 2 — TRIB-001 GOOD (embargos execução fiscal)");
test("TRIB-001 não contém placeholders", () => { for (const ph of ["[DATA]", "[VALOR]", "[NOME]"]) assertNotContains(doc("TRIB-001").text, ph, "TRIB-001"); });
test("TRIB-001 contém CDA, CTN e LEF", () => { const t = doc("TRIB-001").text; assertContains(t, "CDA", "TRIB-001"); assertContains(t, "CTN", "TRIB-001"); assertContains(t, "LEF", "TRIB-001"); });
test("TRIB-001 GOOD → 0 findings", () => { const f = doc("TRIB-001").derivedExpectedFindings; assert(f.length === 0, `esperado 0, obtido ${f.length}`); });

console.log("\nSuite 3 — TRIB-002 MODERATE (compensação)");
test("TRIB-002 texto contém crédito tributário", () => assertContains(doc("TRIB-002").text, "crédito", "TRIB-002"));
test("TRIB-002 omissão do demonstrativo de crédito", () => {
  const t = doc("TRIB-002").text;
  assert(t.includes("demonstrativo") && (t.includes("não apresentado") || t.includes("[demonstrativo")), "TRIB-002: omissão do demonstrativo não aplicada");
});
test("TRIB-002 → 1 finding sobre demonstrativo", () => {
  const f = doc("TRIB-002").derivedExpectedFindings;
  assert(f.some((x) => x.toLowerCase().includes("demonstrativo") || x.toLowerCase().includes("crédito")), `findings: ${JSON.stringify(f)}`);
});

console.log("\nSuite 4 — TRIB-003 SEVERE (exclusão Simples Nacional)");
test("TRIB-003 menciona Simples Nacional e LC 123", () => { const t = doc("TRIB-003").text; assertContains(t, "Simples Nacional", "TRIB-003"); assertContains(t, "LC 123", "TRIB-003"); });
test("TRIB-003 → 2 findings (SEVERE)", () => { const f = doc("TRIB-003").derivedExpectedFindings; assert(f.length >= 2, `esperado ≥2, obtido ${f.length}: ${JSON.stringify(f)}`); });

console.log("\nSuite 5 — TRIB-008 e TRIB-015 (cumprimentos de sentença)");
test("TRIB-008 contém 'CUMPRIMENTO DE SENTENÇA'", () => assertContains(doc("TRIB-008").text, "CUMPRIMENTO DE SENTENÇA", "TRIB-008"));
test("TRIB-008 omissão do cálculo de parcelas", () => {
  const t = doc("TRIB-008").text;
  assert(!t.includes("÷") || t.includes("[cálculo"), "TRIB-008: cálculo detalhado de parcelas deveria estar omitido");
});
test("TRIB-015 GOOD contém SELIC e precatório", () => { const t = doc("TRIB-015").text; assertContains(t, "SELIC", "TRIB-015"); assertContains(t, "precatório", "TRIB-015"); });
test("TRIB-015 GOOD → 0 findings", () => { const f = doc("TRIB-015").derivedExpectedFindings; assert(f.length === 0, `esperado 0, obtido ${f.length}`); });

console.log("\nSuite 6 — Estrutura por documentType");
test("PETICAO_INICIAL (TRIB-001) contém DOS FATOS", () => assertContains(doc("TRIB-001").text, "DOS FATOS", "TRIB-001"));
test("RECURSO (TRIB-003) contém DA DECISÃO RECORRIDA", () => assertContains(doc("TRIB-003").text, "DA DECISÃO RECORRIDA", "TRIB-003"));
test("CUMPRIMENTO_SENTENCA (TRIB-008) contém DO TÍTULO EXECUTIVO", () => assertContains(doc("TRIB-008").text, "DO TÍTULO EXECUTIVO", "TRIB-008"));

console.log("\nSuite 7 — Degradações e findings");
test("GOOD cases → 0 findings", () => {
  for (const d of allDocs.filter((x) => x.quality === "GOOD")) {
    const f = doc(d.caseId).derivedExpectedFindings;
    assert(f.length === 0, `${d.caseId}: esperado 0, obtido ${f.length}`);
  }
});
test("não-GOOD → ≥1 finding", () => {
  for (const d of allDocs.filter((x) => x.quality !== "GOOD")) {
    const f = doc(d.caseId).derivedExpectedFindings;
    assert(f.length > 0, `${d.caseId}: esperado ≥1, obtido 0`);
  }
});

console.log("\nSuite 8 — Invariantes");
test("nenhum documento contém 'defeito planejado'", () => { for (const d of allDocs) assertNotContains(d.text, "defeito planejado", d.caseId); });
test("nenhum documento contém 'expected finding'", () => { for (const d of allDocs) assertNotContains(d.text.toLowerCase(), "expected finding", d.caseId); });

console.log("\nSuite 9 — Determinismo");
test("TRIB-001 é determinístico", () => { assert(generateTributarioDocumentV2("TRIB-001").text === doc("TRIB-001").text, "textos diferem"); });
test("TRIB-008 é determinístico", () => { assert(generateTributarioDocumentV2("TRIB-008").text === doc("TRIB-008").text, "textos diferem"); });

console.log(`\nTotal: ${passed + failed} | ✓ ${passed} | ✗ ${failed}`);
if (failed > 0) { console.error(`\n${failed} testes falharam.`); process.exit(1); }
else console.log("\nTodos os testes passaram.");

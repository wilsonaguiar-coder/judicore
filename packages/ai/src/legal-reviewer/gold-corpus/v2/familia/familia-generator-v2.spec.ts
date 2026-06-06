/**
 * FASE 9.0.9 — Testes do Família Generator V2
 *
 * Execução: node --import tsx/esm src/legal-reviewer/gold-corpus/v2/familia/familia-generator-v2.spec.ts
 */

import { generateAllFamiliaDocumentsV2, generateFamiliaDocumentV2 } from "./familia-generator-v2.js";
import { FAMILIA_CASE_IDS } from "./familia-scenario-factory.js";
import type { GeneratedFamiliaDocumentV2 } from "./familia-scenario.types.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e: unknown) { console.error(`  ✗ ${name}\n      ${e instanceof Error ? e.message : String(e)}`); failed++; }
}

function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }
function assertContains(text: string, sub: string, label: string): void { if (!text.includes(sub)) throw new Error(`${label}: esperado conter "${sub}"`); }
function assertNotContains(text: string, sub: string, label: string): void { if (text.includes(sub)) throw new Error(`${label}: não esperado conter "${sub}"`); }

const allDocs = generateAllFamiliaDocumentsV2();
const byId = new Map<string, GeneratedFamiliaDocumentV2>(allDocs.map((d) => [d.caseId, d]));
function doc(id: string): GeneratedFamiliaDocumentV2 {
  const d = byId.get(id);
  if (!d) throw new Error(`Não encontrado: ${id}`);
  return d;
}

console.log("\nSuite 1 — Cobertura e unicidade");
test("gera exatamente 15 documentos Família", () => assert(allDocs.length === 15, `Esperado 15, gerado ${allDocs.length}`));
test("todos os 15 caseIds são cobertos", () => { const ids = new Set(allDocs.map((d) => d.caseId)); for (const id of FAMILIA_CASE_IDS) assert(ids.has(id), `ausente: ${id}`); });
test("cada caseId gera texto diferente", () => { const t = allDocs.map((d) => d.text); assert(new Set(t).size === t.length, "Textos duplicados"); });
test("domínio é FAMILIA em todos", () => { for (const d of allDocs) assert(d.domain === "FAMILIA", `${d.caseId}: domain="${d.domain}"`); });

console.log("\nSuite 2 — FAM-001 GOOD (divórcio litigioso)");
test("FAM-001 não contém placeholders", () => { for (const ph of ["[DATA]", "[VALOR]", "[NOME]"]) assertNotContains(doc("FAM-001").text, ph, "FAM-001"); });
test("FAM-001 contém DOS FATOS", () => assertContains(doc("FAM-001").text, "DOS FATOS", "FAM-001"));
test("FAM-001 contém divórcio", () => assertContains(doc("FAM-001").text.toLowerCase(), "divórcio", "FAM-001"));
test("FAM-001 GOOD → 0 findings", () => { const f = doc("FAM-001").derivedExpectedFindings; assert(f.length === 0, `esperado 0, obtido ${f.length}`); });

console.log("\nSuite 3 — FAM-002 MODERATE (alimentos filhos)");
test("FAM-002 texto contém alimentos", () => assertContains(doc("FAM-002").text.toLowerCase(), "alimentos", "FAM-002"));
test("FAM-002 omissão do demonstrativo de necessidades", () => {
  const t = doc("FAM-002").text;
  assert(!t.includes("demonstrativo das necessidades detalhado") || t.includes("[demonstrativo"), "FAM-002: demonstrativo deveria estar omitido");
});
test("FAM-002 → 1 finding sobre demonstrativo", () => {
  const f = doc("FAM-002").derivedExpectedFindings;
  assert(f.some((x) => x.toLowerCase().includes("demonstrativo") || x.toLowerCase().includes("necessidade")), `findings: ${JSON.stringify(f)}`);
});

console.log("\nSuite 4 — FAM-003 SEVERE (guarda compartilhada)");
test("FAM-003 menciona guarda compartilhada", () => assertContains(doc("FAM-003").text.toLowerCase(), "guarda", "FAM-003"));
test("FAM-003 é RECURSO com DA DECISÃO RECORRIDA", () => assertContains(doc("FAM-003").text, "DA DECISÃO RECORRIDA", "FAM-003"));
test("FAM-003 → 2 findings (SEVERE)", () => { const f = doc("FAM-003").derivedExpectedFindings; assert(f.length >= 2, `esperado ≥2, obtido ${f.length}: ${JSON.stringify(f)}`); });

console.log("\nSuite 5 — FAM-015 GOOD (cumprimento de sentença de alimentos)");
test("FAM-015 contém DO TÍTULO EXECUTIVO", () => assertContains(doc("FAM-015").text, "DO TÍTULO EXECUTIVO", "FAM-015"));
test("FAM-015 contém alimentos", () => assertContains(doc("FAM-015").text.toLowerCase(), "alimentos", "FAM-015"));
test("FAM-015 GOOD → 0 findings", () => { const f = doc("FAM-015").derivedExpectedFindings; assert(f.length === 0, `esperado 0, obtido ${f.length}`); });

console.log("\nSuite 6 — Estrutura por documentType");
test("PETICAO_INICIAL (FAM-001) contém DOS FATOS", () => assertContains(doc("FAM-001").text, "DOS FATOS", "FAM-001"));
test("RECURSO (FAM-003) contém DA DECISÃO RECORRIDA", () => assertContains(doc("FAM-003").text, "DA DECISÃO RECORRIDA", "FAM-003"));
test("CUMPRIMENTO_SENTENCA (FAM-015) contém DO TÍTULO EXECUTIVO", () => assertContains(doc("FAM-015").text, "DO TÍTULO EXECUTIVO", "FAM-015"));

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
test("FAM-001 é determinístico", () => { assert(generateFamiliaDocumentV2("FAM-001").text === doc("FAM-001").text, "textos diferem"); });
test("FAM-015 é determinístico", () => { assert(generateFamiliaDocumentV2("FAM-015").text === doc("FAM-015").text, "textos diferem"); });

console.log(`\nTotal: ${passed + failed} | ✓ ${passed} | ✗ ${failed}`);
if (failed > 0) { console.error(`\n${failed} testes falharam.`); process.exit(1); }
else console.log("\nTodos os testes passaram.");

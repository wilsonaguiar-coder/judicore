/**
 * FASE 9.0.9 — Testes do Consumidor Generator V2
 *
 * Execução: node --import tsx/esm src/legal-reviewer/gold-corpus/v2/consumidor/consumidor-generator-v2.spec.ts
 */

import { generateAllConsumidorDocumentsV2, generateConsumidorDocumentV2 } from "./consumidor-generator-v2.js";
import { CONSUMIDOR_CASE_IDS } from "./consumidor-scenario-factory.js";
import type { GeneratedConsumidorDocumentV2 } from "./consumidor-scenario.types.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e: unknown) { console.error(`  ✗ ${name}\n      ${e instanceof Error ? e.message : String(e)}`); failed++; }
}

function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }
function assertContains(text: string, sub: string, label: string): void { if (!text.includes(sub)) throw new Error(`${label}: esperado conter "${sub}"`); }
function assertNotContains(text: string, sub: string, label: string): void { if (text.includes(sub)) throw new Error(`${label}: não esperado conter "${sub}"`); }

const allDocs = generateAllConsumidorDocumentsV2();
const byId = new Map<string, GeneratedConsumidorDocumentV2>(allDocs.map((d) => [d.caseId, d]));
function doc(id: string): GeneratedConsumidorDocumentV2 {
  const d = byId.get(id);
  if (!d) throw new Error(`Não encontrado: ${id}`);
  return d;
}

console.log("\nSuite 1 — Cobertura e unicidade");
test("gera exatamente 15 documentos Consumidor", () => assert(allDocs.length === 15, `Esperado 15, gerado ${allDocs.length}`));
test("todos os 15 caseIds são cobertos", () => { const ids = new Set(allDocs.map((d) => d.caseId)); for (const id of CONSUMIDOR_CASE_IDS) assert(ids.has(id), `ausente: ${id}`); });
test("cada caseId gera texto diferente", () => { const t = allDocs.map((d) => d.text); assert(new Set(t).size === t.length, "Textos duplicados"); });
test("domínio é CONSUMIDOR em todos", () => { for (const d of allDocs) assert(d.domain === "CONSUMIDOR", `${d.caseId}: domain="${d.domain}"`); });

console.log("\nSuite 2 — CONS-001 GOOD (dano moral consumidor)");
test("CONS-001 não contém placeholders", () => { for (const ph of ["[DATA]", "[VALOR]", "[NOME]"]) assertNotContains(doc("CONS-001").text, ph, "CONS-001"); });
test("CONS-001 contém DOS FATOS", () => assertContains(doc("CONS-001").text, "DOS FATOS", "CONS-001"));
test("CONS-001 contém CDC", () => assertContains(doc("CONS-001").text, "CDC", "CONS-001"));
test("CONS-001 GOOD → 0 findings", () => { const f = doc("CONS-001").derivedExpectedFindings; assert(f.length === 0, `esperado 0, obtido ${f.length}`); });

console.log("\nSuite 3 — CONS-002 MODERATE (negativação indevida)");
test("CONS-002 menciona SERASA ou SPC", () => assertContains(doc("CONS-002").text, "SERASA", "CONS-002"));
test("CONS-002 omissão da prova de indevididade", () => {
  const t = doc("CONS-002").text;
  assert(t.includes("[prova do pagamento") || !t.includes("comprovante de pagamento do débito"), "CONS-002: prova deveria estar omitida");
});
test("CONS-002 → 1 finding sobre prova", () => {
  const f = doc("CONS-002").derivedExpectedFindings;
  assert(f.some((x) => x.toLowerCase().includes("prova") || x.toLowerCase().includes("negativação")), `findings: ${JSON.stringify(f)}`);
});

console.log("\nSuite 4 — CONS-003 SEVERE (recusa cobertura plano)");
test("CONS-003 é RECURSO com DA DECISÃO RECORRIDA", () => assertContains(doc("CONS-003").text, "DA DECISÃO RECORRIDA", "CONS-003"));
test("CONS-003 menciona CDC art. 51", () => assertContains(doc("CONS-003").text, "CDC art. 51", "CONS-003"));
test("CONS-003 → 2 findings (SEVERE)", () => { const f = doc("CONS-003").derivedExpectedFindings; assert(f.length >= 2, `esperado ≥2, obtido ${f.length}: ${JSON.stringify(f)}`); });

console.log("\nSuite 5 — CONS-015 GOOD (cumprimento de sentença)");
test("CONS-015 contém DO TÍTULO EXECUTIVO", () => assertContains(doc("CONS-015").text, "DO TÍTULO EXECUTIVO", "CONS-015"));
test("CONS-015 contém CPC art. 523", () => assertContains(doc("CONS-015").text, "CPC art. 523", "CONS-015"));
test("CONS-015 GOOD → 0 findings", () => { const f = doc("CONS-015").derivedExpectedFindings; assert(f.length === 0, `esperado 0, obtido ${f.length}`); });

console.log("\nSuite 6 — Estrutura por documentType");
test("PETICAO_INICIAL (CONS-001) contém DOS FATOS", () => assertContains(doc("CONS-001").text, "DOS FATOS", "CONS-001"));
test("RECURSO (CONS-003) contém DA DECISÃO RECORRIDA", () => assertContains(doc("CONS-003").text, "DA DECISÃO RECORRIDA", "CONS-003"));
test("CUMPRIMENTO_SENTENCA (CONS-015) contém DO TÍTULO EXECUTIVO", () => assertContains(doc("CONS-015").text, "DO TÍTULO EXECUTIVO", "CONS-015"));

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
test("CONS-001 é determinístico", () => { assert(generateConsumidorDocumentV2("CONS-001").text === doc("CONS-001").text, "textos diferem"); });
test("CONS-015 é determinístico", () => { assert(generateConsumidorDocumentV2("CONS-015").text === doc("CONS-015").text, "textos diferem"); });

console.log(`\nTotal: ${passed + failed} | ✓ ${passed} | ✗ ${failed}`);
if (failed > 0) { console.error(`\n${failed} testes falharam.`); process.exit(1); }
else console.log("\nTodos os testes passaram.");

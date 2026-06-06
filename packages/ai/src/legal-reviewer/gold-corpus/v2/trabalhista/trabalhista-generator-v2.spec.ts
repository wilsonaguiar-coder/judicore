/**
 * FASE 9.0.9 — Testes do Trabalhista Generator V2
 *
 * 27 testes cobrindo: geração dos 15 documentos, conteúdo GOOD sem placeholders,
 * defeitos MODERATE/SEVERE/LIGHT, estrutura por documentType, expectedFindings
 * derivados, invariantes de texto e determinismo.
 *
 * Execução: node --import tsx/esm src/legal-reviewer/gold-corpus/v2/trabalhista/trabalhista-generator-v2.spec.ts
 */

import { generateAllTrabalhistaDocumentsV2, generateTrabalhistaDocumentV2 } from "./trabalhista-generator-v2.js";
import { TRABALHISTA_CASE_IDS } from "./trabalhista-scenario-factory.js";
import type { GeneratedTrabalhistaDocumentV2 } from "./trabalhista-scenario.types.js";

// ─── Harness ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n      ${msg}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertContains(text: string, substring: string, label: string): void {
  if (!text.includes(substring)) {
    throw new Error(`${label}: esperado conter "${substring}"`);
  }
}

function assertNotContains(text: string, substring: string, label: string): void {
  if (text.includes(substring)) {
    throw new Error(`${label}: não esperado conter "${substring}"`);
  }
}

// ─── Geração única para reutilização ──────────────────────────────────────────

const allDocs = generateAllTrabalhistaDocumentsV2();
const byId = new Map<string, GeneratedTrabalhistaDocumentV2>(allDocs.map((d) => [d.caseId, d]));

function doc(caseId: string): GeneratedTrabalhistaDocumentV2 {
  const d = byId.get(caseId);
  if (d === undefined) throw new Error(`Documento não encontrado: ${caseId}`);
  return d;
}

// ─── Suite 1 — Cobertura e unicidade ─────────────────────────────────────────

console.log("\nSuite 1 — Cobertura e unicidade");

test("gera exatamente 15 documentos Trabalhista", () => {
  assert(allDocs.length === 15, `Esperado 15, gerado ${allDocs.length}`);
});

test("todos os 15 caseIds são cobertos", () => {
  const ids = new Set(allDocs.map((d) => d.caseId));
  for (const id of TRABALHISTA_CASE_IDS) {
    assert(ids.has(id), `caseId ausente: ${id}`);
  }
});

test("cada caseId gera texto diferente dos demais", () => {
  const texts = allDocs.map((d) => d.text);
  const unique = new Set(texts);
  assert(unique.size === texts.length, `Textos duplicados detectados (${texts.length - unique.size} repetições)`);
});

test("domínio é TRABALHISTA em todos os documentos", () => {
  for (const d of allDocs) {
    assert(d.domain === "TRABALHISTA", `${d.caseId}: domínio esperado TRABALHISTA, obtido "${d.domain}"`);
  }
});

// ─── Suite 2 — TRAB-001 GOOD (horas extras) ──────────────────────────────────

console.log("\nSuite 2 — TRAB-001 GOOD (horas extras)");

test("TRAB-001 GOOD não contém placeholders proibidos", () => {
  const text = doc("TRAB-001").text;
  for (const ph of ["[DATA]", "[VALOR]", "[NOME]", "[DOCUMENTO]", "a ser complementado", "quando pertinente"]) {
    assertNotContains(text, ph, "TRAB-001");
  }
});

test("TRAB-001 GOOD contém número de horas extras e valor monetário", () => {
  const text = doc("TRAB-001").text;
  assert(/\d+\s+horas extras/.test(text), "TRAB-001: esperado quantificação de horas extras");
  assert(/R\$\s*[\d.,]+/.test(text), "TRAB-001: esperado valor monetário R$");
});

test("TRAB-001 GOOD contém referência à CLT e fundamento legal", () => {
  const text = doc("TRAB-001").text;
  assert(text.includes("CLT") || text.includes("CF/88"), "TRAB-001: esperado fundamento legal");
  assert(text.includes("art. 59") || text.includes("art. 7.º"), "TRAB-001: esperado art. 59 CLT ou art. 7.º CF");
});

test("TRAB-001 derivedExpectedFindings vazio (GOOD)", () => {
  const findings = doc("TRAB-001").derivedExpectedFindings;
  assert(findings.length === 0, `TRAB-001: esperado 0 findings, obtido ${findings.length}: ${JSON.stringify(findings)}`);
});

// ─── Suite 3 — TRAB-002 MODERATE (adicional de insalubridade) ────────────────

console.log("\nSuite 3 — TRAB-002 MODERATE (insalubridade)");

test("TRAB-002 texto contém referência ao agente nocivo", () => {
  assertContains(doc("TRAB-002").text, "NR-15", "TRAB-002");
});

test("TRAB-002 texto contém omissão do laudo de insalubridade", () => {
  const text = doc("TRAB-002").text;
  assert(
    text.includes("laudo") && (text.includes("ausentes") || text.includes("não mencionado") || text.includes("[laudo")),
    "TRAB-002: esperado indicação de ausência do laudo pericial de insalubridade",
  );
});

test("TRAB-002 derivedExpectedFindings contém ausência de laudo técnico", () => {
  const findings = doc("TRAB-002").derivedExpectedFindings;
  assert(
    findings.some((f) => f.toLowerCase().includes("laudo")),
    `TRAB-002: findings obtidos: ${JSON.stringify(findings)}`,
  );
});

// ─── Suite 4 — TRAB-003 SEVERE (rescisão indireta) ───────────────────────────

console.log("\nSuite 4 — TRAB-003 SEVERE (rescisão indireta)");

test("TRAB-003 menciona mora salarial e art. 483", () => {
  const text = doc("TRAB-003").text;
  assertContains(text, "art. 483", "TRAB-003");
  assert(text.includes("mora") || text.includes("salário"), "TRAB-003: esperado contexto de mora salarial");
});

test("TRAB-003 derivedExpectedFindings tem 2 findings (SEVERE)", () => {
  const findings = doc("TRAB-003").derivedExpectedFindings;
  assert(findings.length >= 2, `TRAB-003: esperado ≥2 findings, obtido ${findings.length}: ${JSON.stringify(findings)}`);
});

test("TRAB-003 finding inclui identificação dos fatos da rescisão indireta", () => {
  const findings = doc("TRAB-003").derivedExpectedFindings;
  assert(
    findings.some((f) => f.toLowerCase().includes("rescisão") || f.toLowerCase().includes("mora")),
    `TRAB-003: findings: ${JSON.stringify(findings)}`,
  );
});

test("TRAB-003 finding inclui ausência de notificação prévia", () => {
  const findings = doc("TRAB-003").derivedExpectedFindings;
  assert(
    findings.some((f) => f.toLowerCase().includes("notificação") || f.toLowerCase().includes("mora")),
    `TRAB-003: findings: ${JSON.stringify(findings)}`,
  );
});

// ─── Suite 5 — TRAB-008 e TRAB-015 (cumprimentos de sentença) ────────────────

console.log("\nSuite 5 — TRAB-008 e TRAB-015 (cumprimentos de sentença)");

test("TRAB-008 texto contém 'CUMPRIMENTO DE SENTENÇA'", () => {
  assertContains(doc("TRAB-008").text, "CUMPRIMENTO DE SENTENÇA", "TRAB-008");
});

test("TRAB-008 não contém memória de cálculo detalhada (OMIT aplicado)", () => {
  const text = doc("TRAB-008").text;
  assertNotContains(text, "fator INPC por competência", "TRAB-008 memória detalhada");
});

test("TRAB-008 derivedExpectedFindings contém ausência de memória de cálculo", () => {
  const findings = doc("TRAB-008").derivedExpectedFindings;
  assert(
    findings.some((f) => f.toLowerCase().includes("memória") || f.toLowerCase().includes("fgts")),
    `TRAB-008: findings: ${JSON.stringify(findings)}`,
  );
});

test("TRAB-015 GOOD contém valor principal e total", () => {
  const text = doc("TRAB-015").text;
  assert(/R\$\s*[\d.,]+/.test(text), "TRAB-015: esperado valor monetário");
  assert(text.includes("principal") || text.includes("Principal"), "TRAB-015: esperado 'principal'");
});

test("TRAB-015 GOOD contém INSS e IR (deduções)", () => {
  const text = doc("TRAB-015").text;
  assertContains(text, "INSS", "TRAB-015 INSS");
  assertContains(text, "IR", "TRAB-015 IR");
});

// ─── Suite 6 — Estrutura por documentType ────────────────────────────────────

console.log("\nSuite 6 — Estrutura por documentType");

test("RECLAMACAO_TRABALHISTA (TRAB-001) contém seção DOS FATOS", () => {
  assertContains(doc("TRAB-001").text, "DOS FATOS", "TRAB-001");
});

test("RECURSO_ORDINARIO (TRAB-003) contém seção DA DECISÃO RECORRIDA", () => {
  assertContains(doc("TRAB-003").text, "DA DECISÃO RECORRIDA", "TRAB-003");
});

test("CUMPRIMENTO_SENTENCA (TRAB-008) contém seção DO TÍTULO EXECUTIVO", () => {
  assertContains(doc("TRAB-008").text, "DO TÍTULO EXECUTIVO", "TRAB-008");
});

// ─── Suite 7 — Degradações e findings ────────────────────────────────────────

console.log("\nSuite 7 — Degradações e findings");

test("GOOD cases não têm derivedExpectedFindings", () => {
  const goodIds = allDocs.filter((d) => d.quality === "GOOD").map((d) => d.caseId);
  for (const id of goodIds) {
    const findings = doc(id).derivedExpectedFindings;
    assert(findings.length === 0, `${id} GOOD: esperado 0 findings, obtido ${findings.length}: ${JSON.stringify(findings)}`);
  }
});

test("MODERATE/LIGHT/SEVERE têm ao menos 1 derivedExpectedFinding", () => {
  const nonGoodIds = allDocs.filter((d) => d.quality !== "GOOD").map((d) => d.caseId);
  for (const id of nonGoodIds) {
    const findings = doc(id).derivedExpectedFindings;
    assert(findings.length > 0, `${id} não-GOOD: esperado ≥1 finding, obtido 0`);
  }
});

// ─── Suite 8 — Invariantes de texto ──────────────────────────────────────────

console.log("\nSuite 8 — Invariantes de texto");

test("nenhum documento contém 'defeito planejado'", () => {
  for (const d of allDocs) {
    assertNotContains(d.text, "defeito planejado", d.caseId);
  }
});

test("nenhum documento contém 'expected finding'", () => {
  for (const d of allDocs) {
    assertNotContains(d.text.toLowerCase(), "expected finding", d.caseId);
  }
});

test("nenhum documento contém 'teste sintético'", () => {
  for (const d of allDocs) {
    assertNotContains(d.text.toLowerCase(), "teste sintético", d.caseId);
  }
});

// ─── Suite 9 — Determinismo ───────────────────────────────────────────────────

console.log("\nSuite 9 — Determinismo");

test("geração é determinística: TRAB-001 gera mesmo texto em duas chamadas", () => {
  const a = generateTrabalhistaDocumentV2("TRAB-001");
  const b = generateTrabalhistaDocumentV2("TRAB-001");
  assert(a.text === b.text, "TRAB-001: textos diferem entre chamadas");
});

test("geração é determinística: TRAB-008 gera mesmo texto em duas chamadas", () => {
  const a = generateTrabalhistaDocumentV2("TRAB-008");
  const b = generateTrabalhistaDocumentV2("TRAB-008");
  assert(a.text === b.text, "TRAB-008: textos diferem entre chamadas");
});

// ─── Resultado final ──────────────────────────────────────────────────────────

console.log(`\nTotal: ${passed + failed} | ✓ ${passed} | ✗ ${failed}`);
if (failed > 0) {
  console.error(`\n${failed} testes falharam.`);
  process.exit(1);
} else {
  console.log("\nTodos os testes passaram.");
}

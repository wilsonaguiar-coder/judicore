/**
 * FASE 9.0.8.10 — Testes do RGPS Generator V2
 *
 * 27 testes cobrindo: geração dos 15 documentos, conteúdo GOOD sem placeholders,
 * defeitos MODERATE/SEVERE/LIGHT, estrutura por documentType, expectedFindings
 * derivados, invariantes de texto e determinismo.
 *
 * Execução: tsx src/legal-reviewer/gold-corpus/v2/rgps/rgps-generator-v2.spec.ts
 */

import { generateAllRgpsDocumentsV2, generateRgpsDocumentV2 } from "./rgps-generator-v2.js";
import { RGPS_CASE_IDS } from "./rgps-scenario-factory.js";
import type { GeneratedRgpsDocumentV2 } from "./rgps-scenario.types.js";

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

const allDocs = generateAllRgpsDocumentsV2();
const byId = new Map<string, GeneratedRgpsDocumentV2>(allDocs.map((d) => [d.caseId, d]));

function doc(caseId: string): GeneratedRgpsDocumentV2 {
  const d = byId.get(caseId);
  if (d === undefined) throw new Error(`Documento não encontrado: ${caseId}`);
  return d;
}

// ─── Suite 1 — Cobertura e unicidade ─────────────────────────────────────────

console.log("\nSuite 1 — Cobertura e unicidade");

test("gera exatamente 15 documentos RGPS", () => {
  assert(allDocs.length === 15, `Esperado 15, gerado ${allDocs.length}`);
});

test("todos os 15 caseIds são cobertos", () => {
  const ids = new Set(allDocs.map((d) => d.caseId));
  for (const id of RGPS_CASE_IDS) {
    assert(ids.has(id), `caseId ausente: ${id}`);
  }
});

test("cada caseId gera texto diferente dos demais", () => {
  const texts = allDocs.map((d) => d.text);
  const unique = new Set(texts);
  assert(unique.size === texts.length, `Textos duplicados detectados (${texts.length - unique.size} repetições)`);
});

test("domínio é RGPS em todos os documentos", () => {
  for (const d of allDocs) {
    assert(d.domain === "RGPS", `${d.caseId}: domínio esperado RGPS, obtido "${d.domain}"`);
  }
});

// ─── Suite 2 — RGPS-001 GOOD (aposentadoria por idade urbana) ─────────────────

console.log("\nSuite 2 — RGPS-001 GOOD");

test("RGPS-001 GOOD não contém placeholders proibidos", () => {
  const text = doc("RGPS-001").text;
  for (const ph of ["[DATA]", "[VALOR]", "[NOME]", "[DOCUMENTO]", "a ser complementado", "quando pertinente"]) {
    assertNotContains(text, ph, "RGPS-001");
  }
});

test("RGPS-001 GOOD contém carência numérica (contribuições + número)", () => {
  const text = doc("RGPS-001").text;
  assertContains(text, "contribuições", "RGPS-001 carência");
  assert(/\d{3,}/.test(text), "RGPS-001: esperado número ≥ 3 dígitos no texto");
});

test("RGPS-001 GOOD contém DER concreta (data DD/MM/AAAA)", () => {
  const text = doc("RGPS-001").text;
  assertContains(text, "DER", "RGPS-001 DER");
  assert(/\d{2}\/\d{2}\/\d{4}/.test(text), "RGPS-001: esperado data no formato DD/MM/AAAA");
});

test("RGPS-001 GOOD contém fundamento legal específico", () => {
  const text = doc("RGPS-001").text;
  assert(
    text.includes("art. 48") || text.includes("Lei n.º 8.213"),
    "RGPS-001: esperado art. 48 ou Lei n.º 8.213",
  );
});

test("RGPS-001 GOOD contém CNIS com vínculos", () => {
  const text = doc("RGPS-001").text;
  assertContains(text, "CNIS", "RGPS-001 CNIS");
});

test("RGPS-001 derivedExpectedFindings vazio (GOOD)", () => {
  const findings = doc("RGPS-001").derivedExpectedFindings;
  assert(findings.length === 0, `RGPS-001: esperado 0 findings, obtido ${findings.length}: ${JSON.stringify(findings)}`);
});

// ─── Suite 3 — RGPS-002 MODERATE (aposentadoria especial) ────────────────────

console.log("\nSuite 3 — RGPS-002 MODERATE");

test("RGPS-002 texto contém referência ao PPP", () => {
  assertContains(doc("RGPS-002").text, "PPP", "RGPS-002");
});

test("RGPS-002 texto contém omissão de agente nocivo ou habitualidade/permanência", () => {
  const text = doc("RGPS-002").text;
  const hasOmissionOfPpp = text.includes("agente nocivo") && (text.includes("não foram desenvolvidos") || text.includes("não analisadas"));
  const hasAbsenceHab = !text.includes("habitual e permanente") || text.includes("não analisadas");
  assert(
    hasOmissionOfPpp || hasAbsenceHab,
    "RGPS-002: esperado omissão de agente nocivo ou habitualidade/permanência",
  );
});

test("RGPS-002 derivedExpectedFindings contém 'ausência de análise concreta do PPP'", () => {
  const findings = doc("RGPS-002").derivedExpectedFindings;
  assert(
    findings.some((f) => f.includes("ausência de análise concreta do PPP")),
    `RGPS-002: findings obtidos: ${JSON.stringify(findings)}`,
  );
});

test("RGPS-002 derivedExpectedFindings contém 'ausência de habitualidade/permanência'", () => {
  const findings = doc("RGPS-002").derivedExpectedFindings;
  assert(
    findings.some((f) => f.includes("habitualidade/permanência")),
    `RGPS-002: findings obtidos: ${JSON.stringify(findings)}`,
  );
});

// ─── Suite 4 — RGPS-003 SEVERE (benefício por incapacidade — recurso) ─────────

console.log("\nSuite 4 — RGPS-003 SEVERE");

test("RGPS-003 menciona laudo pericial desfavorável", () => {
  const text = doc("RGPS-003").text;
  assertContains(text, "laudo pericial", "RGPS-003");
  assert(
    text.includes("ausência de incapacidade") || text.includes("improcedente"),
    "RGPS-003: esperado menção à conclusão desfavorável do laudo",
  );
});

test("RGPS-003 não enfrenta tecnicamente o laudo (omissão presente)", () => {
  const text = doc("RGPS-003").text;
  assert(
    text.includes("não enfrenta") || text.includes("não apresenta contraponto") || text.includes("não foi apresentado"),
    "RGPS-003: esperado indicação de ausência de enfrentamento técnico",
  );
});

test("RGPS-003 derivedExpectedFindings contém 'enfrentamento insuficiente da prova pericial'", () => {
  const findings = doc("RGPS-003").derivedExpectedFindings;
  assert(
    findings.some((f) => f.includes("enfrentamento insuficiente da prova pericial")),
    `RGPS-003: findings obtidos: ${JSON.stringify(findings)}`,
  );
});

test("RGPS-003 derivedExpectedFindings contém 'ausência de contraponto técnico'", () => {
  const findings = doc("RGPS-003").derivedExpectedFindings;
  assert(
    findings.some((f) => f.includes("ausência de contraponto técnico")),
    `RGPS-003: findings obtidos: ${JSON.stringify(findings)}`,
  );
});

// ─── Suite 5 — RGPS-008 e RGPS-015 (cumprimentos de sentença) ────────────────

console.log("\nSuite 5 — RGPS-008 e RGPS-015");

test("RGPS-008 texto contém 'CUMPRIMENTO DE SENTENÇA'", () => {
  assertContains(doc("RGPS-008").text, "CUMPRIMENTO DE SENTENÇA", "RGPS-008");
});

test("RGPS-008 texto contém valor final monetário", () => {
  const text = doc("RGPS-008").text;
  assert(/R\$\s*\d[\d.,]+/.test(text), "RGPS-008: esperado valor monetário R$ no texto");
});

test("RGPS-008 não contém memória de cálculo detalhada por competência", () => {
  const text = doc("RGPS-008").text;
  // Após OMIT, a memória detalhada não aparece — apenas o omittedContent
  assertNotContains(text, "Competência 01/", "RGPS-008 memória detalhada");
  assertNotContains(text, "fator INPC", "RGPS-008 fator por competência");
});

test("RGPS-015 GOOD contém DIB", () => {
  assertContains(doc("RGPS-015").text, "DIB", "RGPS-015 DIB");
});

test("RGPS-015 GOOD contém DIP", () => {
  assertContains(doc("RGPS-015").text, "DIP", "RGPS-015 DIP");
});

test("RGPS-015 GOOD contém RMI", () => {
  assertContains(doc("RGPS-015").text, "RMI", "RGPS-015 RMI");
});

test("RGPS-015 GOOD contém atrasados com valor monetário", () => {
  const text = doc("RGPS-015").text;
  assert(/R\$\s*\d[\d.,]+/.test(text), "RGPS-015: esperado valor de atrasados");
});

// ─── Suite 6 — Estrutura por documentType ────────────────────────────────────

console.log("\nSuite 6 — Estrutura por documentType");

test("PETICAO_INICIAL (RGPS-001) não contém estrutura de RECURSO", () => {
  const text = doc("RGPS-001").text;
  assertNotContains(text, "DA DECISÃO RECORRIDA", "RGPS-001 estrutura RECURSO");
  assertNotContains(text, "DAS RAZÕES RECURSAIS", "RGPS-001 estrutura RECURSO");
});

test("RECURSO (RGPS-003) contém seção de decisão recorrida ou razões recursais", () => {
  const text = doc("RGPS-003").text;
  assert(
    text.includes("DA DECISÃO RECORRIDA") || text.includes("DAS RAZÕES RECURSAIS"),
    "RGPS-003: esperado seção de RECURSO",
  );
});

test("CUMPRIMENTO_SENTENCA (RGPS-008) contém seção de título executivo", () => {
  const text = doc("RGPS-008").text;
  assertContains(text, "DO TÍTULO EXECUTIVO", "RGPS-008");
});

// ─── Suite 7 — Degradações e findings ────────────────────────────────────────

console.log("\nSuite 7 — Degradações e findings");

test("GOOD cases não têm degradações", () => {
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

test("geração é determinística: RGPS-001 gera mesmo texto em duas chamadas", () => {
  const a = generateRgpsDocumentV2("RGPS-001");
  const b = generateRgpsDocumentV2("RGPS-001");
  assert(a.text === b.text, "RGPS-001: textos diferem entre chamadas");
});

test("geração é determinística: RGPS-008 gera mesmo texto em duas chamadas", () => {
  const a = generateRgpsDocumentV2("RGPS-008");
  const b = generateRgpsDocumentV2("RGPS-008");
  assert(a.text === b.text, "RGPS-008: textos diferem entre chamadas");
});

// ─── Resultado final ──────────────────────────────────────────────────────────

console.log(`\nTotal: ${passed + failed} | ✓ ${passed} | ✗ ${failed}`);
if (failed > 0) {
  console.error(`\n${failed} testes falharam.`);
  process.exit(1);
} else {
  console.log("\nTodos os testes passaram.");
}

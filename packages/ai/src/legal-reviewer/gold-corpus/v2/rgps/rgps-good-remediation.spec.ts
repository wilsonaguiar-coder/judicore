/**
 * FASE 9.0.8.14 — RGPS Good Case Remediation Tests
 *
 * Valida que os 5 documentos GOOD não contêm mais as inconsistências
 * temporais, de cálculo e de referências jurídicas identificadas na FASE 9.0.8.13.
 *
 * Execução: tsx src/legal-reviewer/gold-corpus/v2/rgps/rgps-good-remediation.spec.ts
 */

import { generateRgpsDocumentV2 } from "./rgps-generator-v2.js";
import {
  validateTemporalConsistency,
  validateCalculationConsistency,
  validateLegalReferences,
  validateGoodDocument,
} from "./rgps-validators.js";

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
  if (!text.includes(substring)) throw new Error(`${label}: esperado conter "${substring}"`);
}

function assertNotContains(text: string, substring: string, label: string): void {
  if (text.includes(substring)) throw new Error(`${label}: não esperado conter "${substring}"`);
}

// ─── Documentos gerados ───────────────────────────────────────────────────────

const doc001 = generateRgpsDocumentV2("RGPS-001").text;
const doc005 = generateRgpsDocumentV2("RGPS-005").text;
const doc011 = generateRgpsDocumentV2("RGPS-011").text;
const doc013 = generateRgpsDocumentV2("RGPS-013").text;
const doc015 = generateRgpsDocumentV2("RGPS-015").text;

// ─── Suite A — RGPS-001: Aposentadoria por Idade Urbana ──────────────────────

console.log("\nSuite A — RGPS-001 Remediation");

test("RGPS-001: atrasados plausíveis (≥ R$ 5.000,00)", () => {
  const match = /estimadas em R\$\s*([\d.,]+)/.exec(doc001);
  assert(match !== null, "valor de atrasados não encontrado");
  const val = parseFloat((match[1] ?? "").replace(/\./g, "").replace(",", "."));
  assert(val >= 5000, `atrasados R$ ${val.toFixed(2)} — abaixo do mínimo esperado de R$ 5.000,00`);
});

test("RGPS-001: CNIS emitido na mesma data da DER (não em data anterior)", () => {
  // Após fix: CNIS emitido em seed.derDate (não seed.baseDate)
  // Verifica que a frase "emitido em" aparece junto a uma data DD/MM/AAAA
  assert(/emitido em \d{2}\/\d{2}\/\d{4}/.test(doc001), "data de emissão do CNIS não encontrada em formato DD/MM/AAAA");
});

test("RGPS-001: CNIS e DER usam a mesma data de referência", () => {
  // Extrai a data de emissão do CNIS e a DER — devem ser iguais
  const cnisMatch = /emitido em (\d{2}\/\d{2}\/\d{4})/.exec(doc001);
  const derMatch = /DER[^0-9]*(\d{2}\/\d{2}\/\d{4})/.exec(doc001);
  assert(cnisMatch !== null, "data de emissão do CNIS não encontrada");
  assert(derMatch !== null, "DER não encontrada");
  assert(cnisMatch[1] === derMatch[1], `CNIS emitido em ${cnisMatch[1]} mas DER é ${derMatch[1]} — datas divergem`);
});

test("RGPS-001: AJG cita art. 98 do CPC/2015", () => {
  assertContains(doc001, "art. 98", "RGPS-001 AJG");
});

test("RGPS-001: validadores temporais e jurídicos passam", () => {
  const { allPassed, results } = validateGoodDocument(doc001, "RGPS-001");
  const allErrors = [
    ...results.temporal.errors,
    ...results.legal.errors,
  ];
  assert(allPassed || results.calculation.passed, `Erros: ${allErrors.map((e) => e.message).join("; ")}`);
  assert(results.temporal.passed, `Temporal: ${results.temporal.errors.map((e) => e.message).join("; ")}`);
  assert(results.legal.passed, `Legal: ${results.legal.errors.map((e) => e.message).join("; ")}`);
});

// ─── Suite B — RGPS-005: Revisão de Aposentadoria ────────────────────────────

console.log("\nSuite B — RGPS-005 Remediation");

test("RGPS-005: não cita Súmula 111/STJ", () => {
  assertNotContains(doc005, "Súmula 111", "RGPS-005 súmula incorreta");
});

test("RGPS-005: cita REsp 1.348.173/RS como fundamento de prevalência do CNIS", () => {
  assertContains(doc005, "REsp 1.348.173", "RGPS-005 jurisprudência CNIS");
});

test("RGPS-005: cita art. 29-A da Lei 8.213 para obrigação de uso do CNIS", () => {
  assertContains(doc005, "art. 29-A", "RGPS-005 art. 29-A");
});

test("RGPS-005: validador de referências jurídicas passa", () => {
  const result = validateLegalReferences(doc005, "RGPS-005");
  assert(result.passed, result.errors.map((e) => e.message).join("; "));
});

// ─── Suite C — RGPS-011: Aposentadoria por Carência Completa ─────────────────

console.log("\nSuite C — RGPS-011 Remediation");

test("RGPS-011: título especifica 'APOSENTADORIA POR IDADE (URBANA)'", () => {
  assertContains(doc011, "APOSENTADORIA POR IDADE", "RGPS-011 título");
});

test("RGPS-011: CNIS emitido na DER (não em data anterior)", () => {
  const cnisMatch = /CNIS emitido em (\d{2}\/\d{2}\/\d{4})/.exec(doc011);
  const derMatch = /DER[^0-9]*é (\d{2}\/\d{2}\/\d{4})/.exec(doc011);
  assert(cnisMatch !== null, "data de emissão do CNIS não encontrada");
  assert(derMatch !== null, "DER não encontrada no formato esperado");
  assert(cnisMatch[1] === derMatch[1], `CNIS emitido em ${cnisMatch[1]} mas DER é ${derMatch[1]}`);
});

test("RGPS-011: menciona motivo do indeferimento pelo INSS", () => {
  assert(
    doc011.includes("indeferiu") || doc011.includes("indeferimento"),
    "RGPS-011: esperado menção ao indeferimento do INSS",
  );
});

test("RGPS-011: menciona inconsistências do CNIS como fundamento do indeferimento", () => {
  assertContains(doc011, "inconsistências", "RGPS-011 motivo indeferimento");
});

test("RGPS-011: validadores temporais e jurídicos passam", () => {
  const temporal = validateTemporalConsistency(doc011, "RGPS-011");
  const legal = validateLegalReferences(doc011, "RGPS-011");
  assert(temporal.passed, temporal.errors.map((e) => e.message).join("; "));
  assert(legal.passed, legal.errors.map((e) => e.message).join("; "));
});

// ─── Suite D — RGPS-013: Auxílio por Incapacidade ───────────────────────────

console.log("\nSuite D — RGPS-013 Remediation");

test("RGPS-013: última contribuição não é em 2024 ou 2025", () => {
  const match = /[Úú]ltima contribui[çc][ãa]o:\s*\d{2}\/(\d{4})/.exec(doc013);
  assert(match !== null, "data de última contribuição não encontrada");
  const year = parseInt(match[1] ?? "0", 10);
  assert(year < 2024, `última contribuição em ${year} — deve ser anterior a 2024 (data hardcoded removida)`);
});

test("RGPS-013: última contribuição é anterior ou igual ao ano de incapacidade", () => {
  const incapMatch = /incapacitado\(a\) em \d{2}\/\d{2}\/(\d{4})/.exec(doc013);
  const lastContribMatch = /[Úú]ltima contribui[çc][ãa]o:\s*\d{2}\/(\d{4})/.exec(doc013);
  assert(incapMatch !== null, "data de incapacidade não encontrada");
  assert(lastContribMatch !== null, "data de última contribuição não encontrada");
  const incapYear = parseInt(incapMatch[1] ?? "0", 10);
  const lastContribYear = parseInt(lastContribMatch[1] ?? "0", 10);
  assert(
    lastContribYear <= incapYear,
    `última contribuição (${lastContribYear}) é posterior ao ano de incapacidade (${incapYear})`,
  );
});

test("RGPS-013: validador de consistência temporal passa", () => {
  const result = validateTemporalConsistency(doc013, "RGPS-013");
  assert(result.passed, result.errors.map((e) => e.message).join("; "));
});

// ─── Suite E — RGPS-015: Cumprimento de Julgado Completo ────────────────────

console.log("\nSuite E — RGPS-015 Remediation");

test("RGPS-015: ano do DIP é posterior ao ano do DIB", () => {
  const dibMatch = /DIB[^0-9]*\d{2}\/\d{2}\/(\d{4})/.exec(doc015);
  const dipMatch = /DIP[^0-9]*\d{2}\/(\d{4})/.exec(doc015);
  assert(dibMatch !== null, "DIB não encontrado");
  assert(dipMatch !== null, "DIP não encontrado");
  const dibYear = parseInt(dibMatch[1] ?? "0", 10);
  const dipYear = parseInt(dipMatch[1] ?? "0", 10);
  assert(dipYear > dibYear, `DIP (${dipYear}) não é posterior ao DIB (${dibYear})`);
});

test("RGPS-015: competências na memória de cálculo alinham com o ano do DIB", () => {
  const dibMatch = /DIB[^0-9]*\d{2}\/\d{2}\/(\d{4})/.exec(doc015);
  assert(dibMatch !== null, "DIB não encontrado");
  const dibYear = parseInt(dibMatch[1] ?? "0", 10);
  const compMatch = /Competência (\d{2})\/(\d{4})/.exec(doc015);
  assert(compMatch !== null, "competência na memória de cálculo não encontrada");
  const compYear = parseInt(compMatch[2] ?? "0", 10);
  assert(
    compYear === dibYear,
    `competências iniciam em ${compYear} mas DIB é em ${dibYear} — desalinhamento detectado`,
  );
});

test("RGPS-015: RMI × fator na memória de cálculo tem resultado correto (±5%)", () => {
  const result = validateCalculationConsistency(doc015, "RGPS-015");
  assert(result.passed, result.errors.map((e) => e.message).join("; "));
});

test("RGPS-015: RMI é hash-derivado e está na faixa esperada (R$ 1.000,00 – R$ 2.200,00)", () => {
  // Após fix: rmi = 100000 + dn(seed, "rmic", 0, 120000) / 100 → R$ 1.000,00 – R$ 2.200,00
  const rmiMatch = /RMI inicial de R\$\s*([\d.,]+)/.exec(doc015);
  assert(rmiMatch !== null, "RMI inicial não encontrada no texto (esperado: 'RMI inicial de R$ ...')");
  const rmiVal = parseFloat((rmiMatch[1] ?? "").replace(/\./g, "").replace(",", "."));
  assert(rmiVal >= 1000 && rmiVal <= 2200, `RMI R$ ${rmiVal.toFixed(2)} fora da faixa esperada [1000, 2200]`);
});

test("RGPS-015: validador de consistência temporal passa", () => {
  const result = validateTemporalConsistency(doc015, "RGPS-015");
  assert(result.passed, result.errors.map((e) => e.message).join("; "));
});

// ─── Suite F — Determinismo pós-remediation ───────────────────────────────────

console.log("\nSuite F — Determinismo pós-remediation");

test("RGPS-001 ainda é determinístico após remediation", () => {
  const a = generateRgpsDocumentV2("RGPS-001").text;
  const b = generateRgpsDocumentV2("RGPS-001").text;
  assert(a === b, "RGPS-001: textos diferem entre chamadas após remediation");
});

test("RGPS-015 ainda é determinístico após remediation", () => {
  const a = generateRgpsDocumentV2("RGPS-015").text;
  const b = generateRgpsDocumentV2("RGPS-015").text;
  assert(a === b, "RGPS-015: textos diferem entre chamadas após remediation");
});

test("GOOD cases ainda têm derivedExpectedFindings vazio", () => {
  for (const id of ["RGPS-001", "RGPS-005", "RGPS-011", "RGPS-013", "RGPS-015"]) {
    const findings = generateRgpsDocumentV2(id).derivedExpectedFindings;
    assert(findings.length === 0, `${id}: esperado 0 findings, obtido ${findings.length}: ${JSON.stringify(findings)}`);
  }
});

// ─── Resultado final ──────────────────────────────────────────────────────────

console.log(`\nTotal: ${passed + failed} | ✓ ${passed} | ✗ ${failed}`);
if (failed > 0) {
  console.error(`\n${failed} testes falharam.`);
  process.exit(1);
} else {
  console.log("\nTodos os testes de remediation passaram.");
}

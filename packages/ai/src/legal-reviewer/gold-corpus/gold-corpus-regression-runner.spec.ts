/**
 * FASE 9.0.6 — Testes de Validação do Regression Runner
 *
 * 24 testes que verificam o runner, comparadores de score, finding matching,
 * sumários por domínio/qualidade e invariantes sobre documentos/reviewer.
 *
 * O reviewer real NÃO é chamado — todos os testes usam mock.
 */

import { GoldCorpusRegressionRunnerService } from "./gold-corpus-regression-runner.service.js";
import { goldCorpusGeneratedDocuments } from "./gold-corpus-generated-documents.js";
import { goldCorpusV1 } from "./gold-corpus-v1.spec.js";
import { OpportunityLevel } from "../enums/opportunity-level.enum.js";
import { StrengthFindingType } from "../enums/strength-finding-type.enum.js";
import type { AiLegalStrengthFinding } from "../dto/ai-legal-strength-finding.js";
import type { AiLegalStrengthReviewResult } from "../dto/ai-legal-strength-review-result.js";
import type { ReviewerLike } from "./gold-corpus-regression.types.js";
import type { GeneratedGoldCorpusDocument } from "./gold-corpus-document-generator.service.js";

// ─── Harness ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve(fn())
    .then(() => {
      console.log(`  ✓ ${name}`);
      passed++;
    })
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ✗ ${name}\n      ${msg}`);
      failed++;
    });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ─── Helpers de mock ──────────────────────────────────────────────────────────

function makeMockReviewerResult(findings: AiLegalStrengthFinding[]): AiLegalStrengthReviewResult {
  return {
    findings,
    summary: "Mock",
    provider: "MOCK",
    model: "mock-v1",
    generatedAt: new Date("2026-06-06"),
    requiresHumanReview: true,
  };
}

function makeMockReviewer(findings: AiLegalStrengthFinding[] = []): ReviewerLike {
  return { review: async () => makeMockReviewerResult(findings) };
}

function makeFinding(
  title: string,
  rationale = "",
  suggestion = "",
  opportunity: OpportunityLevel = OpportunityLevel.IMPACTFUL,
): AiLegalStrengthFinding {
  return {
    id: "mock-id",
    type: StrengthFindingType.MISSING_DEMONSTRATION,
    opportunity,
    title,
    rationale,
    suggestion,
    evidenceFromText: [],
    confidence: 0.9,
    requiresHumanReview: true,
  };
}

// Documentos de referência do corpus
const docRGPS001 = goldCorpusGeneratedDocuments.find((d) => d.caseId === "RGPS-001")!;
const docRGPS002 = goldCorpusGeneratedDocuments.find((d) => d.caseId === "RGPS-002")!;
const docRGPS003 = goldCorpusGeneratedDocuments.find((d) => d.caseId === "RGPS-003")!;

// Documento sintético leve para testes de score isolados
const docMinimalGood: GeneratedGoldCorpusDocument = {
  caseId: "RGPS-001",   // usa caseId real para lookup de unexpectedFindings
  domain: "RGPS",
  documentType: "PETICAO_INICIAL",
  title: "Petição Inicial — RGPS",
  text: "Texto de teste.",
  plantedIssues: [],
  expectedFindings: [],
  expectedScoreRange: { min: 88, max: 96 },
  metadata: {
    synthetic: true,
    generatedAt: "2026-06-06T00:00:00.000Z",
    generatorVersion: "v1",
    quality: "GOOD",
    difficulty: "EASY",
  },
};

const docMinimalIssue: GeneratedGoldCorpusDocument = {
  caseId: "RGPS-002",
  domain: "RGPS",
  documentType: "PETICAO_INICIAL",
  title: "Petição Inicial com issues",
  text: "Texto de teste.",
  plantedIssues: ["fundamentação insuficiente do tempo especial"],
  expectedFindings: ["ausência de análise concreta do PPP", "ausência de habitualidade"],
  expectedScoreRange: { min: 70, max: 82 },
  metadata: {
    synthetic: true,
    generatedAt: "2026-06-06T00:00:00.000Z",
    generatorVersion: "v1",
    quality: "MODERATE_ISSUES",
    difficulty: "MEDIUM",
  },
};

// ─── Suite 1 — Cobertura do runAll ────────────────────────────────────────────

console.log("\nSuite 1 — Cobertura do runAll");

const allTests: Promise<void>[] = [];

allTests.push(test("runAll executa 100 casos", async () => {
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer());
  const summary = await runner.runAll();
  assert(summary.results.length === 100, `Esperado 100, obtido ${summary.results.length}`);
}));

allTests.push(test("summary.totalCases = 100", async () => {
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer());
  const summary = await runner.runAll();
  assert(summary.totalCases === 100, `totalCases = ${summary.totalCases}`);
}));

allTests.push(test("passedCases + failedCases = 100", async () => {
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer());
  const summary = await runner.runAll();
  assert(
    summary.passedCases + summary.failedCases === 100,
    `passed=${summary.passedCases} + failed=${summary.failedCases} ≠ 100`,
  );
}));

allTests.push(test("passRate está entre 0 e 1", async () => {
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer());
  const summary = await runner.runAll();
  assert(summary.passRate >= 0 && summary.passRate <= 1, `passRate=${summary.passRate}`);
}));

// ─── Suite 2 — Estrutura dos sumários ────────────────────────────────────────

console.log("\nSuite 2 — Estrutura dos sumários");

allTests.push(test("byDomain contém todos os 11 domínios do corpus", async () => {
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer());
  const summary = await runner.runAll();
  const expected = ["RGPS", "RPPS", "TRABALHISTA", "TRIBUTARIO", "FAMILIA", "CONSUMIDOR", "CRIMINAL", "FAZENDA_PUBLICA", "AMBIENTAL", "CIVEL", "JUIZADO_ESPECIAL"];
  for (const dom of expected) {
    assert(dom in summary.byDomain, `Domínio ${dom} ausente em byDomain`);
  }
}));

allTests.push(test("byQuality contém GOOD, LIGHT_ISSUES, MODERATE_ISSUES e SEVERE_ISSUES", async () => {
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer());
  const summary = await runner.runAll();
  const expected = ["GOOD", "LIGHT_ISSUES", "MODERATE_ISSUES", "SEVERE_ISSUES"];
  for (const q of expected) {
    assert(q in summary.byQuality, `Qualidade ${q} ausente em byQuality`);
  }
}));

// ─── Suite 3 — runCase preserva dados ────────────────────────────────────────

console.log("\nSuite 3 — runCase preserva dados");

allTests.push(test("runCase preserva caseId", async () => {
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer());
  const result = await runner.runCase(docRGPS001);
  assert(result.caseId === "RGPS-001", `caseId=${result.caseId}`);
}));

// ─── Suite 4 — scorePass ─────────────────────────────────────────────────────

console.log("\nSuite 4 — scorePass");

allTests.push(test("scorePass true quando score está dentro da faixa", async () => {
  // 0 findings → score = 95, faixa = 88-96 → scorePass = true
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer([]));
  const result = await runner.runCase(docMinimalGood);
  assert(result.scorePass === true, `scorePass=${result.scorePass}, actualScore=${result.actualScore}`);
}));

allTests.push(test("scorePass false quando score está fora da faixa", async () => {
  // 3 IMPACTFUL findings → score = 95 - 60 = 35, faixa = 88-96 → scorePass = false
  const findings = [
    makeFinding("F1", "", "", OpportunityLevel.IMPACTFUL),
    makeFinding("F2", "", "", OpportunityLevel.IMPACTFUL),
    makeFinding("F3", "", "", OpportunityLevel.IMPACTFUL),
  ];
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer(findings));
  const result = await runner.runCase(docMinimalGood);
  assert(result.scorePass === false, `scorePass=${result.scorePass}, actualScore=${result.actualScore}`);
}));

// ─── Suite 5 — Finding matching ───────────────────────────────────────────────

console.log("\nSuite 5 — Finding matching");

allTests.push(test("expectedFindings são normalizados para comparação", async () => {
  // Finding com texto que contém palavras-chave com acentos/maiúsculas
  const findings = [
    makeFinding("Análise do PPP insuficiente", "Ausência de dados técnicos do PPP", "Complementar análise do Perfil Profissiográfico"),
  ];
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer(findings));
  const result = await runner.runCase(docMinimalIssue); // expectedFindings inclui "ausência de análise concreta do PPP"
  assert(
    result.matchedExpectedFindings.length >= 1,
    `Nenhum finding esperado encontrado. matched=${JSON.stringify(result.matchedExpectedFindings)}`,
  );
}));

allTests.push(test("matching não exige texto literal idêntico", async () => {
  // Finding com palavras do expectedFinding em ordem diferente / parciais
  const findings = [
    makeFinding("PPP: análise ausente no documento", "", ""),
  ];
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer(findings));
  const result = await runner.runCase(docMinimalIssue);
  // "ausência de análise concreta do PPP" → palavras relevantes: ausencia, analise, concreta, ppp
  // Actual: "ppp", "analise", "ausente" — "ppp" e "analise" intersectam
  assert(
    result.matchedExpectedFindings.length >= 1,
    `Matching literal exigido incorretamente. matched=${JSON.stringify(result.matchedExpectedFindings)}`,
  );
}));

allTests.push(test("missingExpectedFindings registra findings esperados não encontrados", async () => {
  // Retorna finding que NÃO tem relação com expectedFindings do caso
  const findings = [
    makeFinding("Juntada de contrato ausente", "Relação contratual não demonstrada", "Juntar contrato"),
  ];
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer(findings));
  const result = await runner.runCase(docMinimalIssue);
  // expectedFindings: ["ausência de análise concreta do PPP", "ausência de habitualidade"]
  // O finding sobre "contrato" não corresponde a nenhum dos esperados
  assert(
    result.missingExpectedFindings.length >= 1,
    `missingExpectedFindings deveria ter pelo menos 1 item. missing=${JSON.stringify(result.missingExpectedFindings)}`,
  );
}));

// ─── Suite 6 — Forbidden findings ────────────────────────────────────────────

console.log("\nSuite 6 — Forbidden findings");

allTests.push(test("unexpectedForbiddenFindings detecta findings proibidos", async () => {
  // RGPS-001 tem unexpectedFindings: ["não apontar ausência de PPP", "não apontar ausência de LTCAT"]
  // Finding com "PPP" → deve ser detectado como forbidden
  const findings = [
    makeFinding("Ausência de PPP — documento não juntado", "O PPP não foi apresentado", "Juntar PPP"),
  ];
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer(findings));
  const result = await runner.runCase(docRGPS001);
  assert(
    result.unexpectedForbiddenFindings.length >= 1,
    `Nenhum finding proibido detectado. forbidden=${JSON.stringify(result.unexpectedForbiddenFindings)}`,
  );
}));

allTests.push(test("Caso GOOD falha se vier finding proibido", async () => {
  // RGPS-001 é GOOD — finding sobre PPP é proibido → pass = false
  const findings = [
    makeFinding("Ausência de PPP", "PPP não apresentado", "", OpportunityLevel.COMPLEMENTARY),
  ];
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer(findings));
  const result = await runner.runCase(docRGPS001);
  assert(result.pass === false, `Caso GOOD com finding proibido deveria falhar. pass=${result.pass}`);
}));

allTests.push(test("Caso com issue falha se nenhum expectedFinding for encontrado", async () => {
  // RGPS-002 espera findings sobre PPP/habitualidade — mock retorna finding irrelevante
  const findings = [
    makeFinding("Valor da causa não informado", "Falta valor", "Indicar valor"),
  ];
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer(findings));
  const docRGPS002Fixture: GeneratedGoldCorpusDocument = {
    ...docMinimalIssue,
    expectedScoreRange: { min: 70, max: 82 },
    metadata: { ...docMinimalIssue.metadata, quality: "MODERATE_ISSUES" },
  };
  // score = 95 - 15 (IMPACTFUL default wait — no, "Valor da causa" is IMPACTFUL) = 75 → dentro de 70-82 ✓
  // Mas nenhum expectedFinding foi encontrado → findingPass = false → pass = false
  const resultImpactful = await runner.runCase({
    ...docRGPS002Fixture,
    expectedScoreRange: { min: 70, max: 82 },
  });
  // Com 1 IMPACTFUL: score = 95 - 20 = 75 → scorePass ✓
  assert(
    resultImpactful.pass === false,
    `Caso com issue e sem finding correspondente deveria falhar. pass=${resultImpactful.pass}`,
  );
}));

allTests.push(test("Caso com finding extra não proibido pode passar", async () => {
  // docMinimalIssue espera ["ausência de análise concreta do PPP", "ausência de habitualidade"]
  // Mock retorna um finding que corresponde ao esperado + um finding extra irrelevante não proibido
  // score = 95 - 20 - 15 = 60? Mas faixa é 70-82. Preciso ajustar.
  // Usar 1 IMPACTFUL (PPP) + 1 OPTIONAL (extra) → score = 95 - 20 - 5 = 70 → dentro de 70-82 ✓
  const findings = [
    makeFinding("Análise do PPP ausente no processo", "Ausência de análise concreta PPP e habitualidade", "Completar análise PPP", OpportunityLevel.IMPACTFUL),
    makeFinding("Formatação da peça poderia ser melhorada", "Estilo", "Melhorar formatação", OpportunityLevel.OPTIONAL),
  ];
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer(findings));
  const result = await runner.runCase(docMinimalIssue);
  assert(
    result.matchedExpectedFindings.length >= 1,
    `Nenhum finding esperado foi encontrado: ${JSON.stringify(result.matchedExpectedFindings)}`,
  );
  assert(
    result.unexpectedForbiddenFindings.length === 0,
    `Finding extra incorretamente marcado como proibido: ${JSON.stringify(result.unexpectedForbiddenFindings)}`,
  );
  assert(result.pass === true, `Caso com finding extra não proibido deveria passar. pass=${result.pass}, score=${result.actualScore}`);
}));

allTests.push(test("pass depende de scorePass, findingPass e ausência de forbidden", async () => {
  // Testa a fórmula: pass = scorePass && findingPass && forbidden.length === 0
  // Cenário: score dentro da faixa, finding encontrado, sem forbidden → pass = true
  const findings = [
    makeFinding("Ausência de análise do PPP", "PPP e habitualidade não analisados", "Analisar PPP", OpportunityLevel.IMPACTFUL),
  ];
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer(findings));
  const result = await runner.runCase(docMinimalIssue);
  // score = 95 - 20 = 75 → em [70, 82] → scorePass = true
  // matchedExpected >= 1 → findingPass = true
  // forbidden = 0 → forbidden check = true
  // pass = true
  assert(result.scorePass === true, `scorePass deveria ser true. score=${result.actualScore}`);
  assert(result.matchedExpectedFindings.length >= 1, "findingPass deveria ser true");
  assert(result.unexpectedForbiddenFindings.length === 0, "forbidden deveria ser 0");
  assert(result.pass === true, `pass deveria ser true. pass=${result.pass}`);
}));

// ─── Suite 7 — Totais dos sumários ───────────────────────────────────────────

console.log("\nSuite 7 — Totais dos sumários");

allTests.push(test("summary por domínio calcula totais corretamente", async () => {
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer());
  const summary = await runner.runAll();
  for (const [domain, entry] of Object.entries(summary.byDomain)) {
    assert(
      entry.total === entry.passed + entry.failed,
      `${domain}: total(${entry.total}) ≠ passed(${entry.passed}) + failed(${entry.failed})`,
    );
    assert(
      entry.passRate >= 0 && entry.passRate <= 1,
      `${domain}: passRate=${entry.passRate} fora de [0,1]`,
    );
  }
}));

allTests.push(test("summary por qualidade calcula totais corretamente", async () => {
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer());
  const summary = await runner.runAll();
  for (const [quality, entry] of Object.entries(summary.byQuality)) {
    assert(
      entry.total === entry.passed + entry.failed,
      `${quality}: total(${entry.total}) ≠ passed(${entry.passed}) + failed(${entry.failed})`,
    );
    assert(
      entry.passRate >= 0 && entry.passRate <= 1,
      `${quality}: passRate=${entry.passRate} fora de [0,1]`,
    );
  }
}));

// ─── Suite 8 — Invariantes sobre documentos/reviewer ─────────────────────────

console.log("\nSuite 8 — Invariantes sobre documentos e reviewer");

allTests.push(test("Runner não altera documentos do corpus", async () => {
  const snapshotBefore = JSON.stringify(goldCorpusGeneratedDocuments);
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer());
  await runner.runAll();
  const snapshotAfter = JSON.stringify(goldCorpusGeneratedDocuments);
  assert(snapshotBefore === snapshotAfter, "goldCorpusGeneratedDocuments foi alterado pelo runner");
}));

allTests.push(test("Runner não altera expectedScoreRange dos casos", async () => {
  const ranges = goldCorpusV1.map((c) => ({ id: c.id, min: c.expectedScoreRange.min, max: c.expectedScoreRange.max }));
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer());
  await runner.runAll();
  for (const r of ranges) {
    const original = goldCorpusV1.find((c) => c.id === r.id)!;
    assert(
      original.expectedScoreRange.min === r.min && original.expectedScoreRange.max === r.max,
      `${r.id}: expectedScoreRange foi alterado`,
    );
  }
}));

let reviewCallCount = 0;
const countingMock: ReviewerLike = {
  review: async () => {
    reviewCallCount++;
    return makeMockReviewerResult([]);
  },
};

allTests.push(test("Runner não altera o reviewer (não substitui método review)", async () => {
  const originalReview = countingMock.review;
  const runner = new GoldCorpusRegressionRunnerService(countingMock);
  await runner.runCase(docRGPS001);
  assert(
    countingMock.review === originalReview,
    "O runner substituiu o método review do reviewer",
  );
}));

allTests.push(test("Runner chama reviewer exatamente uma vez por runCase", async () => {
  const callsBefore = reviewCallCount;
  const runner = new GoldCorpusRegressionRunnerService(countingMock);
  await runner.runCase(docRGPS002);
  assert(
    reviewCallCount === callsBefore + 1,
    `Esperado 1 chamada, ocorreram ${reviewCallCount - callsBefore}`,
  );
}));

allTests.push(test("Runner não usa Math.random() — resultado é determinístico com mesmo mock", async () => {
  const runner = new GoldCorpusRegressionRunnerService(makeMockReviewer([]));
  const result1 = await runner.runCase(docRGPS001);
  const result2 = await runner.runCase(docRGPS001);
  assert(
    JSON.stringify(result1) === JSON.stringify(result2),
    "Resultados diferentes para o mesmo caso e mock — possível uso de randomness",
  );
}));

// ─── Resultado final ──────────────────────────────────────────────────────────

await Promise.all(allTests);

console.log(`\nTotal: ${passed + failed} | ✓ ${passed} | ✗ ${failed}`);
if (failed > 0) {
  console.error(`\n${failed} testes falharam.`);
  process.exit(1);
} else {
  console.log("Todos os testes passaram.");
}

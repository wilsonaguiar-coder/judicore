/**
 * FASE 9.0.7 — Testes de Validação das Métricas de Precisão
 *
 * 22 testes que verificam cálculos de precision, recall, F1, scorePassRate,
 * casePassRate, slices por domínio/qualidade e invariantes do serviço.
 */

import { GoldCorpusMetricsService } from "./gold-corpus-metrics.service.js";
import type { GoldCorpusRegressionResult, GoldCorpusRegressionSummary } from "./gold-corpus-regression.types.js";

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

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertClose(actual: number, expected: number, label: string, tol = 1e-9): void {
  assert(
    Math.abs(actual - expected) < tol,
    `${label}: esperado ${expected}, obtido ${actual}`,
  );
}

// ─── Helpers de fixture ───────────────────────────────────────────────────────

function makeResult(overrides: Partial<GoldCorpusRegressionResult> = {}): GoldCorpusRegressionResult {
  return {
    caseId: "TEST-001",
    domain: "RGPS",
    documentType: "PETICAO_INICIAL",
    quality: "MODERATE_ISSUES",
    difficulty: "MEDIUM",
    expectedScoreRange: { min: 60, max: 80 },
    actualScore: 70,
    scorePass: true,
    expectedFindings: [],
    actualFindings: [],
    matchedExpectedFindings: [],
    missingExpectedFindings: [],
    unexpectedFindings: [],
    unexpectedForbiddenFindings: [],
    pass: true,
    ...overrides,
  };
}

function makeSummary(results: GoldCorpusRegressionResult[]): GoldCorpusRegressionSummary {
  const passed = results.filter((r) => r.pass).length;
  return {
    totalCases: results.length,
    passedCases: passed,
    failedCases: results.length - passed,
    passRate: results.length > 0 ? passed / results.length : 0,
    scorePassRate: results.filter((r) => r.scorePass).length / (results.length || 1),
    findingPassRate: 0,
    results,
    byDomain: {},
    byQuality: {},
  };
}

const service = new GoldCorpusMetricsService();

// ─── Suite 1 — Contagem e totais ──────────────────────────────────────────────

console.log("\nSuite 1 — Contagem e totais");

test("calculate retorna totalCases correto", () => {
  const summary = makeSummary([makeResult(), makeResult({ caseId: "TEST-002" }), makeResult({ caseId: "TEST-003" })]);
  const metrics = service.calculate(summary);
  assert(metrics.totalCases === 3, `totalCases=${metrics.totalCases}`);
});

// ─── Suite 2 — Precision e Recall ────────────────────────────────────────────

console.log("\nSuite 2 — Precision e Recall");

test("Precision perfeita quando todos expectedFindings encontrados e sem FP", () => {
  const r = makeResult({
    expectedFindings: ["finding A"],
    matchedExpectedFindings: ["finding A"],
    missingExpectedFindings: [],
    unexpectedForbiddenFindings: [],
    actualFindings: ["finding A encontrado"],
  });
  const metrics = service.calculate(makeSummary([r]));
  assertClose(metrics.findingPrecision, 1, "precision");
});

test("Recall menor que 1 quando há missingExpectedFindings", () => {
  // TP=1, FN=1 → recall = 0.5
  const r = makeResult({
    expectedFindings: ["A", "B"],
    matchedExpectedFindings: ["A"],
    missingExpectedFindings: ["B"],
    unexpectedForbiddenFindings: [],
    actualFindings: ["A encontrado"],
  });
  const metrics = service.calculate(makeSummary([r]));
  assert(metrics.findingRecall < 1, `recall=${metrics.findingRecall} deveria ser < 1`);
  assertClose(metrics.findingRecall, 0.5, "recall");
});

test("Precision menor que 1 quando há unexpectedForbiddenFindings", () => {
  // TP=1, FP=1 (forbidden) → precision = 0.5
  const r = makeResult({
    quality: "MODERATE_ISSUES",
    expectedFindings: ["A"],
    matchedExpectedFindings: ["A"],
    missingExpectedFindings: [],
    unexpectedForbiddenFindings: ["finding proibido"],
    actualFindings: ["A encontrado", "finding proibido"],
  });
  const metrics = service.calculate(makeSummary([r]));
  assert(metrics.findingPrecision < 1, `precision=${metrics.findingPrecision} deveria ser < 1`);
  assertClose(metrics.findingPrecision, 0.5, "precision");
});

// ─── Suite 3 — Casos GOOD e FP ───────────────────────────────────────────────

console.log("\nSuite 3 — Casos GOOD e falsos positivos");

test("Casos GOOD com actualFindings contam como falso positivo", () => {
  const r = makeResult({
    quality: "GOOD",
    expectedFindings: [],
    matchedExpectedFindings: [],
    missingExpectedFindings: [],
    unexpectedForbiddenFindings: [],
    actualFindings: ["finding gerado A", "finding gerado B"],
  });
  const metrics = service.calculate(makeSummary([r]));
  assert(metrics.falsePositiveCount === 2, `FP=${metrics.falsePositiveCount}, esperado 2`);
});

test("Casos GOOD sem actualFindings não contam FP", () => {
  const r = makeResult({
    quality: "GOOD",
    expectedFindings: [],
    matchedExpectedFindings: [],
    missingExpectedFindings: [],
    unexpectedForbiddenFindings: [],
    actualFindings: [],
  });
  const metrics = service.calculate(makeSummary([r]));
  assert(metrics.falsePositiveCount === 0, `FP=${metrics.falsePositiveCount}, esperado 0`);
});

// ─── Suite 4 — F1 ────────────────────────────────────────────────────────────

console.log("\nSuite 4 — F1");

test("F1 calculado corretamente (P=0.5, R=1 → F1=0.667)", () => {
  // TP=2, FP=2, FN=0 → P=0.5, R=1, F1 = 2*0.5*1/(0.5+1) = 1/1.5 ≈ 0.6667
  const r = makeResult({
    quality: "MODERATE_ISSUES",
    expectedFindings: ["A", "B"],
    matchedExpectedFindings: ["A", "B"],
    missingExpectedFindings: [],
    unexpectedForbiddenFindings: ["X", "Y"],
    actualFindings: ["A", "B", "X", "Y"],
  });
  const metrics = service.calculate(makeSummary([r]));
  assertClose(metrics.findingF1, 2 / 3, "F1", 1e-6);
});

test("F1 = 1 quando precision=1 e recall=1", () => {
  const r = makeResult({
    quality: "MODERATE_ISSUES",
    expectedFindings: ["A"],
    matchedExpectedFindings: ["A"],
    missingExpectedFindings: [],
    unexpectedForbiddenFindings: [],
    actualFindings: ["A"],
  });
  const metrics = service.calculate(makeSummary([r]));
  assertClose(metrics.findingF1, 1, "F1");
});

// ─── Suite 5 — Divisão por zero ───────────────────────────────────────────────

console.log("\nSuite 5 — Divisão por zero");

test("Divisão por zero nunca retorna NaN", () => {
  // Caso extremo: zero findings esperados e zero gerados
  const r = makeResult({
    quality: "GOOD",
    expectedFindings: [],
    matchedExpectedFindings: [],
    missingExpectedFindings: [],
    unexpectedForbiddenFindings: [],
    actualFindings: [],
  });
  const metrics = service.calculate(makeSummary([r]));
  const values = [metrics.findingPrecision, metrics.findingRecall, metrics.findingF1, metrics.scorePassRate, metrics.casePassRate];
  for (const v of values) {
    assert(!isNaN(v), `Métrica retornou NaN: ${values}`);
  }
});

test("Divisão por zero nunca retorna Infinity", () => {
  // Caso: FN > 0, TP=0, FP=0 (nada foi gerado, mas havia esperados)
  const r = makeResult({
    quality: "MODERATE_ISSUES",
    expectedFindings: ["A"],
    matchedExpectedFindings: [],
    missingExpectedFindings: ["A"],
    unexpectedForbiddenFindings: [],
    actualFindings: [],
  });
  const metrics = service.calculate(makeSummary([r]));
  const values = [metrics.findingPrecision, metrics.findingRecall, metrics.findingF1];
  for (const v of values) {
    assert(isFinite(v), `Métrica retornou Infinity: ${values}`);
  }
});

test("Sem findings esperados e sem findings reais gera precision/recall/F1 = 1", () => {
  // TP=0, FP=0, FN=0 → precision=1, recall=1, F1=1
  const r = makeResult({
    quality: "GOOD",
    expectedFindings: [],
    matchedExpectedFindings: [],
    missingExpectedFindings: [],
    unexpectedForbiddenFindings: [],
    actualFindings: [],
  });
  const metrics = service.calculate(makeSummary([r]));
  assertClose(metrics.findingPrecision, 1, "precision");
  assertClose(metrics.findingRecall, 1, "recall");
  assertClose(metrics.findingF1, 1, "F1");
});

// ─── Suite 6 — Taxas de pass ─────────────────────────────────────────────────

console.log("\nSuite 6 — Taxas de pass");

test("scorePassRate calculado corretamente", () => {
  const results = [
    makeResult({ scorePass: true }),
    makeResult({ caseId: "T2", scorePass: true }),
    makeResult({ caseId: "T3", scorePass: false }),
  ];
  const metrics = service.calculate(makeSummary(results));
  assertClose(metrics.scorePassRate, 2 / 3, "scorePassRate", 1e-6);
});

test("casePassRate calculado corretamente", () => {
  const results = [
    makeResult({ pass: true }),
    makeResult({ caseId: "T2", pass: false }),
    makeResult({ caseId: "T3", pass: false }),
  ];
  const metrics = service.calculate(makeSummary(results));
  assertClose(metrics.casePassRate, 1 / 3, "casePassRate", 1e-6);
});

// ─── Suite 7 — Slices por domínio e qualidade ────────────────────────────────

console.log("\nSuite 7 — Slices por domínio e qualidade");

test("byDomain contém todos os domínios presentes no summary", () => {
  const results = [
    makeResult({ domain: "RGPS" }),
    makeResult({ caseId: "T2", domain: "TRIBUTARIO" }),
    makeResult({ caseId: "T3", domain: "FAMILIA" }),
  ];
  const metrics = service.calculate(makeSummary(results));
  assert("RGPS" in metrics.byDomain, "RGPS ausente");
  assert("TRIBUTARIO" in metrics.byDomain, "TRIBUTARIO ausente");
  assert("FAMILIA" in metrics.byDomain, "FAMILIA ausente");
});

test("byQuality contém todas as qualidades presentes no summary", () => {
  const results = [
    makeResult({ quality: "GOOD" }),
    makeResult({ caseId: "T2", quality: "LIGHT_ISSUES" }),
    makeResult({ caseId: "T3", quality: "MODERATE_ISSUES" }),
    makeResult({ caseId: "T4", quality: "SEVERE_ISSUES" }),
  ];
  const metrics = service.calculate(makeSummary(results));
  assert("GOOD" in metrics.byQuality, "GOOD ausente");
  assert("LIGHT_ISSUES" in metrics.byQuality, "LIGHT_ISSUES ausente");
  assert("MODERATE_ISSUES" in metrics.byQuality, "MODERATE_ISSUES ausente");
  assert("SEVERE_ISSUES" in metrics.byQuality, "SEVERE_ISSUES ausente");
});

test("Slices por domínio calculam TP/FP/FN corretamente", () => {
  // RGPS: TP=2, FP=0, FN=1 | TRIBUTARIO: TP=0, FP=1, FN=0
  const results = [
    makeResult({
      domain: "RGPS",
      quality: "MODERATE_ISSUES",
      expectedFindings: ["A", "B", "C"],
      matchedExpectedFindings: ["A", "B"],
      missingExpectedFindings: ["C"],
      unexpectedForbiddenFindings: [],
      actualFindings: ["A", "B"],
    }),
    makeResult({
      caseId: "T2",
      domain: "TRIBUTARIO",
      quality: "MODERATE_ISSUES",
      expectedFindings: [],
      matchedExpectedFindings: [],
      missingExpectedFindings: [],
      unexpectedForbiddenFindings: ["proibido"],
      actualFindings: ["proibido"],
    }),
  ];
  const metrics = service.calculate(makeSummary(results));
  assert(metrics.byDomain["RGPS"].truePositiveCount === 2, `RGPS TP=${metrics.byDomain["RGPS"].truePositiveCount}`);
  assert(metrics.byDomain["RGPS"].falseNegativeCount === 1, `RGPS FN=${metrics.byDomain["RGPS"].falseNegativeCount}`);
  assert(metrics.byDomain["RGPS"].falsePositiveCount === 0, `RGPS FP=${metrics.byDomain["RGPS"].falsePositiveCount}`);
  assert(metrics.byDomain["TRIBUTARIO"].falsePositiveCount === 1, `TRIBUTARIO FP=${metrics.byDomain["TRIBUTARIO"].falsePositiveCount}`);
});

test("Slices por qualidade calculam TP/FP/FN corretamente", () => {
  // GOOD com 2 actual findings → FP=2
  // MODERATE com TP=1, FN=1
  const results = [
    makeResult({
      quality: "GOOD",
      expectedFindings: [],
      matchedExpectedFindings: [],
      missingExpectedFindings: [],
      unexpectedForbiddenFindings: [],
      actualFindings: ["X", "Y"],
    }),
    makeResult({
      caseId: "T2",
      quality: "MODERATE_ISSUES",
      expectedFindings: ["A", "B"],
      matchedExpectedFindings: ["A"],
      missingExpectedFindings: ["B"],
      unexpectedForbiddenFindings: [],
      actualFindings: ["A"],
    }),
  ];
  const metrics = service.calculate(makeSummary(results));
  assert(metrics.byQuality["GOOD"].falsePositiveCount === 2, `GOOD FP=${metrics.byQuality["GOOD"].falsePositiveCount}`);
  assert(metrics.byQuality["MODERATE_ISSUES"].truePositiveCount === 1, `MODERATE TP=${metrics.byQuality["MODERATE_ISSUES"].truePositiveCount}`);
  assert(metrics.byQuality["MODERATE_ISSUES"].falseNegativeCount === 1, `MODERATE FN=${metrics.byQuality["MODERATE_ISSUES"].falseNegativeCount}`);
});

test("totalCases dos slices por domínio soma o total geral", () => {
  const results = [
    makeResult({ domain: "RGPS" }),
    makeResult({ caseId: "T2", domain: "RGPS" }),
    makeResult({ caseId: "T3", domain: "TRIBUTARIO" }),
  ];
  const metrics = service.calculate(makeSummary(results));
  const domainTotal = Object.values(metrics.byDomain).reduce((s, d) => s + d.totalCases, 0);
  assert(domainTotal === metrics.totalCases, `domainTotal(${domainTotal}) ≠ totalCases(${metrics.totalCases})`);
});

test("totalCases dos slices por qualidade soma o total geral", () => {
  const results = [
    makeResult({ quality: "GOOD" }),
    makeResult({ caseId: "T2", quality: "GOOD" }),
    makeResult({ caseId: "T3", quality: "MODERATE_ISSUES" }),
  ];
  const metrics = service.calculate(makeSummary(results));
  const qualityTotal = Object.values(metrics.byQuality).reduce((s, d) => s + d.totalCases, 0);
  assert(qualityTotal === metrics.totalCases, `qualityTotal(${qualityTotal}) ≠ totalCases(${metrics.totalCases})`);
});

// ─── Suite 8 — Invariantes ────────────────────────────────────────────────────

console.log("\nSuite 8 — Invariantes");

test("Métricas sempre ficam entre 0 e 1", () => {
  const results = [
    makeResult({ quality: "GOOD", actualFindings: ["X", "Y"], unexpectedForbiddenFindings: [] }),
    makeResult({ caseId: "T2", quality: "MODERATE_ISSUES", matchedExpectedFindings: ["A"], missingExpectedFindings: ["B"], expectedFindings: ["A", "B"] }),
    makeResult({ caseId: "T3", quality: "SEVERE_ISSUES", matchedExpectedFindings: [], missingExpectedFindings: ["A"], expectedFindings: ["A"], actualFindings: [] }),
  ];
  const metrics = service.calculate(makeSummary(results));
  const ratios = [metrics.findingPrecision, metrics.findingRecall, metrics.findingF1, metrics.scorePassRate, metrics.casePassRate];
  for (const v of ratios) {
    assert(v >= 0 && v <= 1, `Métrica fora de [0,1]: ${v}`);
  }
  for (const slice of [...Object.values(metrics.byDomain), ...Object.values(metrics.byQuality)]) {
    const sliceRatios = [slice.findingPrecision, slice.findingRecall, slice.findingF1, slice.scorePassRate, slice.casePassRate];
    for (const v of sliceRatios) {
      assert(v >= 0 && v <= 1, `Slice métrica fora de [0,1]: ${v}`);
    }
  }
});

test("Serviço não altera o summary recebido", () => {
  const summary = makeSummary([makeResult(), makeResult({ caseId: "T2" })]);
  const snapshotBefore = JSON.stringify(summary);
  service.calculate(summary);
  const snapshotAfter = JSON.stringify(summary);
  assert(snapshotBefore === snapshotAfter, "summary foi alterado pelo serviço");
});

test("Funciona com summary vazio retornando métricas neutras sem erros", () => {
  const summary = makeSummary([]);
  let metrics: ReturnType<typeof service.calculate> | undefined;
  try {
    metrics = service.calculate(summary);
  } catch (e) {
    throw new Error(`calculate() lançou exceção com summary vazio: ${e}`);
  }
  assert(metrics.totalCases === 0, "totalCases deveria ser 0");
  assert(!isNaN(metrics.findingPrecision), "precision NaN em summary vazio");
  assert(!isNaN(metrics.findingRecall), "recall NaN em summary vazio");
  assert(!isNaN(metrics.findingF1), "F1 NaN em summary vazio");
  assert(isFinite(metrics.findingPrecision), "precision Infinity em summary vazio");
  assert(isFinite(metrics.findingRecall), "recall Infinity em summary vazio");
  assert(isFinite(metrics.findingF1), "F1 Infinity em summary vazio");
});

// ─── Resultado final ──────────────────────────────────────────────────────────

console.log(`\nTotal: ${passed + failed} | ✓ ${passed} | ✗ ${failed}`);
if (failed > 0) {
  console.error(`\n${failed} testes falharam.`);
  process.exit(1);
} else {
  console.log("Todos os testes passaram.");
}

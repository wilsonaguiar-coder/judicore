/**
 * FASE 9.0.8.3 — Testes da camada de Revisão Humana
 *
 * 10 testes cobrindo: summary, HVQS, byProvider, byDomain,
 * BenchmarkValidityReport, amostrador quantidade, amostrador distribuição,
 * ausência de NaN, ausência de Infinity.
 */

import { HumanReviewService } from "./human-review.service.js";
import { HumanReviewReportService } from "./human-review-report.service.js";
import type {
  HumanReviewCaseEvaluation,
  AutomatedBenchmarkResult,
  SampleableResult,
} from "./human-review.types.js";

// ─── Infraestrutura de teste ──────────────────────────────────────────────────

const allTests: Promise<void>[] = [];
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): void {
  const p = Promise.resolve().then(fn).then(
    () => { passed++; },
    (err: unknown) => {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL: ${name}\n    ${msg}`);
    },
  );
  allTests.push(p);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertClose(actual: number, expected: number, tol = 1e-9, label = ""): void {
  assert(
    Math.abs(actual - expected) < tol,
    `${label}: esperava ${expected}, obteve ${actual}`,
  );
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEval(
  caseId: string,
  providerId: string,
  overallScore: 1 | 2 | 3 | 4 | 5,
  findings: { correct: boolean; relevant: boolean; actionable: boolean; score: 1|2|3|4|5 }[],
): HumanReviewCaseEvaluation {
  return {
    caseId,
    providerId,
    reviewerId: "reviewer-1",
    overallScore,
    evaluations: findings.map((f, i) => ({
      findingId: `f-${i}`,
      isLegallyCorrect: f.correct,
      isRelevant: f.relevant,
      isActionable: f.actionable,
      score: f.score,
    })),
  };
}

// Dois cases para openai, um para gemini
// RGPS-001 → domain RGPS; TRIB-001 → domain TRIBUTARIO
const baseEvals: HumanReviewCaseEvaluation[] = [
  makeEval("RGPS-001", "openai", 5, [
    { correct: true,  relevant: true,  actionable: true,  score: 5 },
    { correct: true,  relevant: true,  actionable: false, score: 4 },
  ]),
  makeEval("RGPS-002", "openai", 3, [
    { correct: false, relevant: true,  actionable: false, score: 2 },
  ]),
  makeEval("TRIB-001", "gemini", 4, [
    { correct: true,  relevant: true,  actionable: true,  score: 4 },
    { correct: true,  relevant: false, actionable: true,  score: 3 },
  ]),
];

const svc = new HumanReviewService();
const reportSvc = new HumanReviewReportService();

// ─── Teste 1: HumanReviewSummary calculado corretamente ──────────────────────

test("HumanReviewSummary calculado corretamente", () => {
  const summary = svc.calculateSummary(baseEvals);

  // 5 findings total (2 + 1 + 2)
  assert(summary.totalFindingsReviewed === 5, `totalFindings esperado 5, obteve ${summary.totalFindingsReviewed}`);
  assert(summary.totalCasesReviewed === 3, `totalCases esperado 3, obteve ${summary.totalCasesReviewed}`);

  // correct: 4/5 = 0.8
  assertClose(summary.legallyCorrectRate, 4/5, 1e-9, "legallyCorrectRate");

  // relevant: 4/5 = 0.8
  assertClose(summary.relevanceRate, 4/5, 1e-9, "relevanceRate");

  // actionable: 3/5 = 0.6
  assertClose(summary.actionabilityRate, 3/5, 1e-9, "actionabilityRate");

  // averageScore: (5+4+2+4+3)/5 = 18/5 = 3.6
  assertClose(summary.averageScore, 18/5, 1e-9, "averageScore");
});

// ─── Teste 2: HumanValidatedQualityScore calculado corretamente ──────────────

test("HumanValidatedQualityScore calculado corretamente", () => {
  const summary = svc.calculateSummary(baseEvals);

  const lc = 4/5;
  const rv = 4/5;
  const ac = 3/5;
  const avg = 18/5;
  const ns = (avg - 1) / 4;  // normalizedScore
  const expected = lc * 0.40 + rv * 0.30 + ac * 0.20 + ns * 0.10;

  assertClose(summary.humanValidatedQualityScore, expected, 1e-9, "HVQS");
  assert(summary.humanValidatedQualityScore >= 0 && summary.humanValidatedQualityScore <= 1,
    `HVQS fora do intervalo [0,1]: ${summary.humanValidatedQualityScore}`);
});

// ─── Teste 3: Relatórios por provider ────────────────────────────────────────

test("Relatórios por provider são calculados corretamente", () => {
  const summary = svc.calculateSummary(baseEvals);

  assert("openai" in summary.byProvider, "openai ausente em byProvider");
  assert("gemini" in summary.byProvider, "gemini ausente em byProvider");

  const openaiSlice = summary.byProvider["openai"]!;
  // openai: 3 findings (2 + 1)
  assert(openaiSlice.totalFindingsReviewed === 3, `openai findings: esperava 3, obteve ${openaiSlice.totalFindingsReviewed}`);
  assert(openaiSlice.totalCasesReviewed === 2, `openai cases: esperava 2, obteve ${openaiSlice.totalCasesReviewed}`);

  const geminiSlice = summary.byProvider["gemini"]!;
  // gemini: 2 findings
  assert(geminiSlice.totalFindingsReviewed === 2, `gemini findings: esperava 2, obteve ${geminiSlice.totalFindingsReviewed}`);
  assert(geminiSlice.totalCasesReviewed === 1, `gemini cases: esperava 1, obteve ${geminiSlice.totalCasesReviewed}`);
});

// ─── Teste 4: Relatórios por domínio ─────────────────────────────────────────

test("Relatórios por domínio são inferidos do caseId", () => {
  const summary = svc.calculateSummary(baseEvals);

  assert("RGPS" in summary.byDomain, "RGPS ausente em byDomain");
  assert("TRIBUTARIO" in summary.byDomain, "TRIBUTARIO ausente em byDomain");

  const rgps = summary.byDomain["RGPS"]!;
  // RGPS-001 e RGPS-002 → 3 findings
  assert(rgps.totalFindingsReviewed === 3, `RGPS findings: esperava 3, obteve ${rgps.totalFindingsReviewed}`);
  assert(rgps.totalCasesReviewed === 2, `RGPS cases: esperava 2, obteve ${rgps.totalCasesReviewed}`);

  const trib = summary.byDomain["TRIBUTARIO"]!;
  assert(trib.totalFindingsReviewed === 2, `TRIBUTARIO findings: esperava 2, obteve ${trib.totalFindingsReviewed}`);
});

// ─── Teste 5: Relatório de validade (BenchmarkValidityReport) ────────────────

test("BenchmarkValidityReport calculado corretamente", () => {
  const humanEvals: HumanReviewCaseEvaluation[] = [
    makeEval("RGPS-001", "openai", 5, [{ correct: true, relevant: true, actionable: true, score: 5 }]),
    makeEval("RGPS-002", "openai", 2, [{ correct: false, relevant: false, actionable: false, score: 2 }]),
    makeEval("TRIB-001", "gemini", 4, [{ correct: true, relevant: true, actionable: true, score: 4 }]),
  ];

  const autoResults: AutomatedBenchmarkResult[] = [
    { caseId: "RGPS-001", providerId: "openai", pass: true  },  // concordância (pass + score 5)
    { caseId: "RGPS-002", providerId: "openai", pass: true  },  // FP (pass + score 2)
    { caseId: "TRIB-001", providerId: "gemini", pass: false },  // FN (fail + score 4)
  ];

  const report = reportSvc.generateValidityReport(humanEvals, autoResults);

  assert(report.totalCompared === 3, `totalCompared: esperava 3, obteve ${report.totalCompared}`);
  // 1 acordo, 1 FP, 1 FN → agreementRate = 1/3
  assertClose(report.agreementRate, 1/3, 1e-9, "agreementRate");
  assertClose(report.benchmarkFalsePositiveRate, 1/3, 1e-9, "fpRate");
  assertClose(report.benchmarkFalseNegativeRate, 1/3, 1e-9, "fnRate");
  assert(report.entries.length === 3, `entries: esperava 3, obteve ${report.entries.length}`);

  const fp = report.entries.find((e) => e.caseId === "RGPS-002")!;
  assert(fp.isBenchmarkFalsePositive, "RGPS-002 deveria ser FP");
  assert(!fp.isBenchmarkFalseNegative, "RGPS-002 não deveria ser FN");

  const fn_ = report.entries.find((e) => e.caseId === "TRIB-001")!;
  assert(fn_.isBenchmarkFalseNegative, "TRIB-001 deveria ser FN");
  assert(!fn_.isBenchmarkFalsePositive, "TRIB-001 não deveria ser FP");
});

// ─── Teste 6: Amostrador retorna quantidade correta ──────────────────────────

test("Amostrador retorna quantidade correta por provider", () => {
  const results: SampleableResult[] = [
    { caseId: "RGPS-001", providerId: "openai", quality: "GOOD" },
    { caseId: "RGPS-002", providerId: "openai", quality: "PARTIAL" },
    { caseId: "RGPS-003", providerId: "openai", quality: "GOOD" },
    { caseId: "RGPS-004", providerId: "openai", quality: "POOR" },
    { caseId: "TRIB-001", providerId: "gemini", quality: "GOOD" },
    { caseId: "TRIB-002", providerId: "gemini", quality: "POOR" },
    { caseId: "TRIB-003", providerId: "gemini", quality: "GOOD" },
  ];

  const sampled = svc.sampleForReview(results, {
    casesPerProvider: 2,
    requireAtLeastOneGood: true,
    requireAtLeastOneProblematic: true,
  });

  const openaiCount = sampled.filter((s) => s.providerId === "openai").length;
  const geminiCount = sampled.filter((s) => s.providerId === "gemini").length;

  assert(openaiCount === 2, `openai: esperava 2, obteve ${openaiCount}`);
  assert(geminiCount === 2, `gemini: esperava 2, obteve ${geminiCount}`);
  assert(sampled.length === 4, `total: esperava 4, obteve ${sampled.length}`);
});

// ─── Teste 7: Amostrador respeita distribuição GOOD vs PROBLEMÁTICOS ─────────

test("Amostrador inclui GOOD e problemáticos quando disponíveis", () => {
  const results: SampleableResult[] = [
    { caseId: "RGPS-001", providerId: "openai", quality: "GOOD" },
    { caseId: "RGPS-002", providerId: "openai", quality: "PARTIAL" },
    { caseId: "RGPS-003", providerId: "openai", quality: "POOR" },
  ];

  const sampled = svc.sampleForReview(results, {
    casesPerProvider: 3,
    requireAtLeastOneGood: true,
    requireAtLeastOneProblematic: true,
  });

  const reasons = sampled.map((s) => s.selectionReason);
  assert(reasons.includes("good_representative"), "deve incluir good_representative");
  assert(reasons.includes("problematic_representative"), "deve incluir problematic_representative");

  const goodEntry = sampled.find((s) => s.selectionReason === "good_representative")!;
  assert(goodEntry.quality === "GOOD", `good_representative deve ter quality=GOOD, obteve ${goodEntry.quality}`);

  const probEntry = sampled.find((s) => s.selectionReason === "problematic_representative")!;
  assert(probEntry.quality !== "GOOD", `problematic_representative não deve ter quality=GOOD`);
});

// ─── Teste 8: Sem NaN ─────────────────────────────────────────────────────────

test("Nenhum campo numérico contém NaN", () => {
  // Edge case: sem findings
  const evalsEmpty: HumanReviewCaseEvaluation[] = [
    { caseId: "RGPS-001", providerId: "openai", reviewerId: "r1", overallScore: 3, evaluations: [] },
  ];
  const summary = svc.calculateSummary(evalsEmpty);

  const numFields: (keyof typeof summary)[] = [
    "totalFindingsReviewed", "totalCasesReviewed",
    "legallyCorrectRate", "relevanceRate", "actionabilityRate",
    "averageScore", "humanValidatedQualityScore",
  ];
  for (const field of numFields) {
    const v = summary[field] as number;
    assert(!isNaN(v), `${field} é NaN`);
  }

  // Edge case: relatório vazio
  const report = reportSvc.generateValidityReport([], []);
  assert(!isNaN(report.agreementRate), "agreementRate é NaN");
  assert(!isNaN(report.pearsonCorrelation), "pearsonCorrelation é NaN");

  // Edge case: todos pass (variância zero no Pearson)
  const humanOnlyPass: HumanReviewCaseEvaluation[] = [
    makeEval("RGPS-001", "openai", 5, []),
    makeEval("RGPS-002", "openai", 5, []),
  ];
  const autoAllPass: AutomatedBenchmarkResult[] = [
    { caseId: "RGPS-001", providerId: "openai", pass: true },
    { caseId: "RGPS-002", providerId: "openai", pass: true },
  ];
  const r2 = reportSvc.generateValidityReport(humanOnlyPass, autoAllPass);
  assert(!isNaN(r2.pearsonCorrelation), "pearsonCorrelation é NaN com variância zero");
});

// ─── Teste 9: Sem Infinity ────────────────────────────────────────────────────

test("Nenhum campo numérico contém Infinity", () => {
  const summary = svc.calculateSummary(baseEvals);

  const numFields: (keyof typeof summary)[] = [
    "totalFindingsReviewed", "totalCasesReviewed",
    "legallyCorrectRate", "relevanceRate", "actionabilityRate",
    "averageScore", "humanValidatedQualityScore",
  ];
  for (const field of numFields) {
    const v = summary[field] as number;
    assert(isFinite(v), `${field} é Infinity ou NaN: ${v}`);
  }

  const report = reportSvc.generateValidityReport([], []);
  assert(isFinite(report.agreementRate), "agreementRate não é finito");
  assert(isFinite(report.pearsonCorrelation), "pearsonCorrelation não é finito");
  assert(isFinite(report.benchmarkFalsePositiveRate), "fpRate não é finito");
  assert(isFinite(report.benchmarkFalseNegativeRate), "fnRate não é finito");
});

// ─── Teste 10: Relatório sem pares correspondentes ───────────────────────────

test("Relatório com pares sem correspondência retorna totalCompared=0", () => {
  const humanEvals: HumanReviewCaseEvaluation[] = [
    makeEval("RGPS-001", "openai", 5, []),
  ];
  const autoResults: AutomatedBenchmarkResult[] = [
    { caseId: "RGPS-001", providerId: "gemini", pass: true }, // provider diferente
  ];

  const report = reportSvc.generateValidityReport(humanEvals, autoResults);
  assert(report.totalCompared === 0, `totalCompared: esperava 0, obteve ${report.totalCompared}`);
  assert(report.agreementRate === 0, `agreementRate: esperava 0, obteve ${report.agreementRate}`);
  assert(report.entries.length === 0, `entries: esperava 0, obteve ${report.entries.length}`);
});

// ─── Runner ───────────────────────────────────────────────────────────────────

Promise.all(allTests).then(() => {
  const total = passed + failed;
  console.log(`\nHuman Review — ${passed}/${total} testes passaram`);
  if (failed > 0) process.exit(1);
});

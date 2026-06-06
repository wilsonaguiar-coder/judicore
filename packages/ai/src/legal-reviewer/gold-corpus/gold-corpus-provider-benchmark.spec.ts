/**
 * FASE 9.0.8 — Testes de Validação do Provider Benchmark
 *
 * 24 testes que verificam execução, ranking, composite score, tratamento de erros
 * e invariantes do serviço de benchmark.
 *
 * Nenhuma API real é chamada — todos os testes usam mock runner factory e
 * mock providers (Perfect, Average, Weak, Failure).
 */

import { GoldCorpusProviderBenchmarkService } from "./gold-corpus-provider-benchmark.service.js";
import { GoldCorpusMetricsService } from "./gold-corpus-metrics.service.js";
import type { GoldCorpusRegressionResult, GoldCorpusRegressionSummary } from "./gold-corpus-regression.types.js";
import type { BenchmarkProvider, RunnerFactory } from "./gold-corpus-provider-benchmark.types.js";
import type { ReviewerLike } from "./gold-corpus-regression.types.js";

// ─── Harness ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const allTests: Promise<void>[] = [];

function test(name: string, fn: () => void | Promise<void>): void {
  allTests.push(
    Promise.resolve(fn())
      .then(() => { console.log(`  ✓ ${name}`); passed++; })
      .catch((e: unknown) => {
        console.error(`  ✗ ${name}\n      ${e instanceof Error ? e.message : String(e)}`);
        failed++;
      }),
  );
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertClose(actual: number, expected: number, label: string, tol = 1e-6): void {
  assert(Math.abs(actual - expected) < tol, `${label}: esperado ${expected.toFixed(8)}, obtido ${actual.toFixed(8)}`);
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
    expectedFindings: ["A"],
    actualFindings: ["A encontrado"],
    matchedExpectedFindings: ["A"],
    missingExpectedFindings: [],
    unexpectedFindings: [],
    unexpectedForbiddenFindings: [],
    pass: true,
    ...overrides,
  };
}

function makeSummary(results: GoldCorpusRegressionResult[]): GoldCorpusRegressionSummary {
  const p = results.filter((r) => r.pass).length;
  return {
    totalCases: results.length,
    passedCases: p,
    failedCases: results.length - p,
    passRate: results.length > 0 ? p / results.length : 0,
    scorePassRate: results.length > 0 ? results.filter((r) => r.scorePass).length / results.length : 0,
    findingPassRate: 0,
    results,
    byDomain: {},
    byQuality: {},
  };
}

function makeNoopReviewer(): ReviewerLike {
  return {
    review: async () => ({
      findings: [],
      summary: "mock",
      provider: "MOCK",
      model: "mock-v1",
      generatedAt: new Date("2026-06-06"),
      requiresHumanReview: true,
    }),
  };
}

// Mock runner factory: returns a fixed summary regardless of reviewer
function fixedRunnerFactory(summary: GoldCorpusRegressionSummary): RunnerFactory {
  return () => ({ runAll: async () => summary });
}

// Mock runner factory: maps reviewer identity to summary
function mappedRunnerFactory(
  entries: [ReviewerLike, GoldCorpusRegressionSummary][],
  fallback: GoldCorpusRegressionSummary,
): RunnerFactory {
  const map = new Map(entries);
  return (reviewer) => ({
    runAll: async () => map.get(reviewer) ?? fallback,
  });
}

// Runner factory that throws for a specific reviewer
function throwingRunnerFactory(badReviewer: ReviewerLike, goodSummary: GoldCorpusRegressionSummary): RunnerFactory {
  return (reviewer) => ({
    runAll: async () => {
      if (reviewer === badReviewer) throw new Error("Simulated provider error");
      return goodSummary;
    },
  });
}

// ─── Calibrated summaries for ordering tests ──────────────────────────────────
// Perfect:  TP=8, FP=1, FN=1  → P=0.889 R=0.889 F1=0.889  casePass=0.7  scorePass=1.0
//           compositeScore ≈ 0.889*0.4 + 0.889*0.25 + 0.889*0.2 + 0.7*0.1 + 1.0*0.05 ≈ 0.876

const perfectSummaryResults: GoldCorpusRegressionResult[] = [
  // 7 MODERATE, matched=1, missing=0, pass=true, scorePass=true → TP=7, FP=0, FN=0
  ...Array.from({ length: 7 }, (_, i) =>
    makeResult({ caseId: `P-OK-${i}`, pass: true, scorePass: true }),
  ),
  // 1 MODERATE, matched=1, missing=1, pass=false, scorePass=true → TP=1, FP=0, FN=1
  makeResult({
    caseId: "P-MISS",
    matchedExpectedFindings: ["A"],
    missingExpectedFindings: ["B"],
    expectedFindings: ["A", "B"],
    actualFindings: ["A encontrado"],
    pass: false,
    scorePass: true,
  }),
  // 1 GOOD, actual=["X"], FP=1 for GOOD, pass=false, scorePass=true
  makeResult({
    caseId: "P-GOOD-FP",
    quality: "GOOD",
    expectedFindings: [],
    matchedExpectedFindings: [],
    missingExpectedFindings: [],
    actualFindings: ["X"],
    unexpectedForbiddenFindings: [],
    pass: false,
    scorePass: true,
  }),
  // 1 GOOD, actual=[], FP=0, pass=true, scorePass=true
  makeResult({
    caseId: "P-GOOD-OK",
    quality: "GOOD",
    expectedFindings: [],
    matchedExpectedFindings: [],
    missingExpectedFindings: [],
    actualFindings: [],
    unexpectedForbiddenFindings: [],
    pass: true,
    scorePass: true,
  }),
];
// Total: TP=8, FP=1, FN=1, passes=8/10=0.8, wait 7+1=8 pass, scorePass=10/10=1

const perfectSummary = makeSummary(perfectSummaryResults);

// Average: TP=4, FP=5, FN=3 → P=0.444 R=0.571 F1≈0.5  casePass=5/10=0.5  scorePass=7/10=0.7
//          compositeScore ≈ 0.5*0.4 + 0.444*0.25 + 0.571*0.2 + 0.5*0.1 + 0.7*0.05 ≈ 0.51

const averageSummaryResults: GoldCorpusRegressionResult[] = [
  // 4 MODERATE matched=1, pass=true, scorePass=true → TP=4, FP=0, FN=0
  ...Array.from({ length: 4 }, (_, i) =>
    makeResult({ caseId: `A-OK-${i}`, pass: true, scorePass: true }),
  ),
  // 3 MODERATE: matched=0, missing=1, forbidden=1, pass=false, scorePass=false → FP=3 (forbidden), FN=3
  ...Array.from({ length: 3 }, (_, i) =>
    makeResult({
      caseId: `A-FAIL-${i}`,
      matchedExpectedFindings: [],
      missingExpectedFindings: ["A"],
      actualFindings: ["forbidden-X"],
      unexpectedForbiddenFindings: ["forbidden-X"],
      pass: false,
      scorePass: false,
    }),
  ),
  // 2 GOOD: actual=["X"] → FP=2, pass=false, scorePass=true
  ...Array.from({ length: 2 }, (_, i) =>
    makeResult({
      caseId: `A-GOOD-${i}`,
      quality: "GOOD",
      expectedFindings: [],
      matchedExpectedFindings: [],
      missingExpectedFindings: [],
      actualFindings: ["X"],
      unexpectedForbiddenFindings: [],
      pass: false,
      scorePass: true,
    }),
  ),
  // 1 GOOD: actual=[], pass=true, scorePass=true
  makeResult({
    caseId: "A-GOOD-OK",
    quality: "GOOD",
    expectedFindings: [],
    matchedExpectedFindings: [],
    missingExpectedFindings: [],
    actualFindings: [],
    unexpectedForbiddenFindings: [],
    pass: true,
    scorePass: true,
  }),
];
// Total: TP=4, FP=3+2=5, FN=3, passes=4+1=5, scorePass=4+2+1=7

const averageSummary = makeSummary(averageSummaryResults);

// Weak: TP=1, FP=9, FN=7 → P=0.1 R=0.125 F1≈0.111  casePass=0  scorePass=0
//       compositeScore ≈ 0.111*0.4 + 0.1*0.25 + 0.125*0.2 + 0 + 0 ≈ 0.094

const weakSummaryResults: GoldCorpusRegressionResult[] = [
  // 1 MODERATE: matched=1, missing=2, forbidden=1, pass=false, scorePass=false → TP=1, FP=1, FN=2
  makeResult({
    caseId: "W-PART",
    matchedExpectedFindings: ["A"],
    missingExpectedFindings: ["B", "C"],
    expectedFindings: ["A", "B", "C"],
    actualFindings: ["A", "forbidden-Y"],
    unexpectedForbiddenFindings: ["forbidden-Y"],
    pass: false,
    scorePass: false,
  }),
  // 5 MODERATE: matched=0, missing=1, pass=false, scorePass=false → TP=0, FP=0, FN=5
  ...Array.from({ length: 5 }, (_, i) =>
    makeResult({
      caseId: `W-FAIL-${i}`,
      matchedExpectedFindings: [],
      missingExpectedFindings: ["A"],
      actualFindings: [],
      unexpectedForbiddenFindings: [],
      pass: false,
      scorePass: false,
    }),
  ),
  // 4 GOOD: actual=["X","Y"] → FP=8 (2 per case * 4), pass=false, scorePass=false
  ...Array.from({ length: 4 }, (_, i) =>
    makeResult({
      caseId: `W-GOOD-${i}`,
      quality: "GOOD",
      expectedFindings: [],
      matchedExpectedFindings: [],
      missingExpectedFindings: [],
      actualFindings: ["X", "Y"],
      unexpectedForbiddenFindings: [],
      pass: false,
      scorePass: false,
    }),
  ),
];
// Total: TP=1, FP=1+8=9, FN=2+5=7, passes=0, scorePass=0

const weakSummary = makeSummary(weakSummaryResults);

const metricsService = new GoldCorpusMetricsService();

const perfectReviewer = makeNoopReviewer();
const averageReviewer = makeNoopReviewer();
const weakReviewer = makeNoopReviewer();
const failureReviewer = makeNoopReviewer();

const MockProviderPerfect: BenchmarkProvider = { id: "PERFECT", label: "Mock Perfect", reviewer: perfectReviewer };
const MockProviderAverage: BenchmarkProvider = { id: "AVERAGE", label: "Mock Average", reviewer: averageReviewer };
const MockProviderWeak: BenchmarkProvider = { id: "WEAK", label: "Mock Weak", reviewer: weakReviewer };
const MockProviderFailure: BenchmarkProvider = { id: "FAILURE", label: "Mock Failure", reviewer: failureReviewer };

// ─── Simple fixtures for most tests ──────────────────────────────────────────

const goodSummary = makeSummary([makeResult({ pass: true, scorePass: true }), makeResult({ caseId: "T2", pass: true, scorePass: true })]);
const emptyS = makeSummary([]);
const fixedFactory = fixedRunnerFactory(goodSummary);

// ─── Suite 1 — Execução e cobertura ──────────────────────────────────────────

console.log("\nSuite 1 — Execução e cobertura");

test("run() executa todos os providers", async () => {
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, fixedFactory);
  const s = await svc.run([MockProviderPerfect, MockProviderAverage]);
  assert(s.results.length === 2, `results.length=${s.results.length}`);
});

test("totalProviders correto", async () => {
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, fixedFactory);
  const s = await svc.run([MockProviderPerfect, MockProviderAverage, MockProviderWeak]);
  assert(s.totalProviders === 3, `totalProviders=${s.totalProviders}`);
});

test("successfulProviders correto", async () => {
  const factory = throwingRunnerFactory(failureReviewer, goodSummary);
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, factory);
  const s = await svc.run([MockProviderPerfect, MockProviderFailure]);
  assert(s.successfulProviders === 1, `successfulProviders=${s.successfulProviders}`);
});

test("failedProviders correto", async () => {
  const factory = throwingRunnerFactory(failureReviewer, goodSummary);
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, factory);
  const s = await svc.run([MockProviderPerfect, MockProviderFailure]);
  assert(s.failedProviders === 1, `failedProviders=${s.failedProviders}`);
});

// ─── Suite 2 — Tratamento de erros ───────────────────────────────────────────

console.log("\nSuite 2 — Tratamento de erros");

test("Provider com erro não interrompe benchmark", async () => {
  const factory = throwingRunnerFactory(failureReviewer, goodSummary);
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, factory);
  let s: Awaited<ReturnType<typeof svc.run>> | undefined;
  try {
    s = await svc.run([MockProviderPerfect, MockProviderFailure, MockProviderAverage]);
  } catch {
    throw new Error("run() lançou exceção ao invés de registrar erro por provider");
  }
  assert(s !== undefined && s.results.length === 3, `Esperado 3 resultados, obtido ${s?.results.length}`);
});

test("Provider com erro aparece em results", async () => {
  const factory = throwingRunnerFactory(failureReviewer, goodSummary);
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, factory);
  const s = await svc.run([MockProviderFailure]);
  assert(s.results.length === 1, "Resultado ausente para provider com erro");
  assert(s.results[0].error !== undefined, "Campo error ausente no resultado do provider com falha");
});

test("Provider com erro não aparece no ranking", async () => {
  const factory = throwingRunnerFactory(failureReviewer, goodSummary);
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, factory);
  const s = await svc.run([MockProviderPerfect, MockProviderFailure]);
  const inRanking = s.ranking.some((r) => r.providerId === "FAILURE");
  assert(!inRanking, "MockProviderFailure não deveria estar no ranking");
});

// ─── Suite 3 — Ranking ────────────────────────────────────────────────────────

console.log("\nSuite 3 — Ranking");

test("Ranking ordenado por compositeScore decrescente", async () => {
  const factory = mappedRunnerFactory(
    [[perfectReviewer, perfectSummary], [averageReviewer, averageSummary], [weakReviewer, weakSummary]],
    emptyS,
  );
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, factory);
  const s = await svc.run([MockProviderWeak, MockProviderAverage, MockProviderPerfect]);
  for (let i = 0; i < s.ranking.length - 1; i++) {
    assert(
      s.ranking[i].compositeScore >= s.ranking[i + 1].compositeScore,
      `ranking[${i}].compositeScore(${s.ranking[i].compositeScore.toFixed(4)}) < ranking[${i + 1}].compositeScore(${s.ranking[i + 1].compositeScore.toFixed(4)})`,
    );
  }
});

test("bestProvider é o primeiro colocado", async () => {
  const factory = mappedRunnerFactory(
    [[perfectReviewer, perfectSummary], [weakReviewer, weakSummary]],
    emptyS,
  );
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, factory);
  const s = await svc.run([MockProviderWeak, MockProviderPerfect]);
  assert(s.bestProvider !== undefined, "bestProvider é undefined");
  assert(s.bestProvider!.providerId === s.ranking[0].providerId, `bestProvider.id=${s.bestProvider!.providerId} ≠ ranking[0].id=${s.ranking[0].providerId}`);
});

test("compositeScore utiliza exatamente os pesos definidos", async () => {
  // TP=8, FP=2, FN=0 → P=0.8, R=1.0, F1=0.889; scorePass=9/10, casePass=8/10
  const results: GoldCorpusRegressionResult[] = [
    // 8 MODERATE matched=1, pass=true, scorePass=true → TP=8, FP=0, FN=0
    ...Array.from({ length: 8 }, (_, i) => makeResult({ caseId: `CS-OK-${i}`, pass: true, scorePass: true })),
    // 1 GOOD actual=["X"], pass=false, scorePass=true → FP=1
    makeResult({ caseId: "CS-GOOD-FP", quality: "GOOD", expectedFindings: [], matchedExpectedFindings: [], missingExpectedFindings: [], actualFindings: ["X"], unexpectedForbiddenFindings: [], pass: false, scorePass: true }),
    // 1 MODERATE forbidden=["Y"], pass=false, scorePass=false → FP=1
    makeResult({ caseId: "CS-FORB", matchedExpectedFindings: [], missingExpectedFindings: [], actualFindings: ["Y"], unexpectedForbiddenFindings: ["Y"], pass: false, scorePass: false }),
  ];
  // TP=8, FP=2, FN=0 → P=8/10=0.8, R=8/8=1.0
  // F1 = 2*0.8*1.0/(0.8+1.0) = 1.6/1.8 = 0.88889
  // scorePass=8+1=9 → scorePassRate=0.9, casePass=8 → casePassRate=0.8
  const expectedF1 = 2 * 0.8 * 1.0 / (0.8 + 1.0);
  const expectedComposite = expectedF1 * 0.40 + 0.8 * 0.25 + 1.0 * 0.20 + 0.8 * 0.10 + 0.9 * 0.05;

  const summary = makeSummary(results);
  const factory = fixedRunnerFactory(summary);
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, factory);
  const s = await svc.run([{ id: "X", label: "X", reviewer: makeNoopReviewer() }]);
  assertClose(s.ranking[0].compositeScore, expectedComposite, "compositeScore");
});

test("durationMs é registrado (>= 0)", async () => {
  const delayFactory: RunnerFactory = () => ({
    runAll: async () => {
      await new Promise<void>((r) => setTimeout(r, 2));
      return goodSummary;
    },
  });
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, delayFactory);
  const s = await svc.run([MockProviderPerfect]);
  assert(s.results[0].durationMs >= 0, `durationMs=${s.results[0].durationMs}`);
});

// ─── Suite 4 — Preservação de dados ──────────────────────────────────────────

console.log("\nSuite 4 — Preservação de dados");

test("regressionSummary é preservado no resultado", async () => {
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, fixedFactory);
  const s = await svc.run([MockProviderPerfect]);
  assert(s.results[0].regressionSummary.totalCases === goodSummary.totalCases, "regressionSummary.totalCases diverge");
});

test("metrics são incluídas no resultado", async () => {
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, fixedFactory);
  const s = await svc.run([MockProviderPerfect]);
  const m = s.results[0].metrics;
  assert(typeof m.findingF1 === "number", "metrics.findingF1 ausente");
  assert(typeof m.findingPrecision === "number", "metrics.findingPrecision ausente");
  assert(typeof m.findingRecall === "number", "metrics.findingRecall ausente");
});

test("providerId é preservado", async () => {
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, fixedFactory);
  const s = await svc.run([MockProviderPerfect]);
  assert(s.results[0].providerId === "PERFECT", `providerId=${s.results[0].providerId}`);
});

test("providerLabel é preservado", async () => {
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, fixedFactory);
  const s = await svc.run([MockProviderPerfect]);
  assert(s.results[0].providerLabel === "Mock Perfect", `providerLabel=${s.results[0].providerLabel}`);
});

// ─── Suite 5 — Edge cases ─────────────────────────────────────────────────────

console.log("\nSuite 5 — Edge cases");

test("benchmark funciona com lista vazia", async () => {
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, fixedFactory);
  const s = await svc.run([]);
  assert(s.totalProviders === 0, `totalProviders=${s.totalProviders}`);
  assert(s.ranking.length === 0, `ranking.length=${s.ranking.length}`);
  assert(s.bestProvider === undefined, "bestProvider deveria ser undefined");
});

test("benchmark funciona quando todos os providers falham", async () => {
  const allFailFactory: RunnerFactory = () => ({
    runAll: async () => { throw new Error("all fail"); },
  });
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, allFailFactory);
  const s = await svc.run([MockProviderPerfect, MockProviderAverage]);
  assert(s.failedProviders === 2, `failedProviders=${s.failedProviders}`);
});

test("ranking vazio quando todos os providers falham", async () => {
  const allFailFactory: RunnerFactory = () => ({
    runAll: async () => { throw new Error("all fail"); },
  });
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, allFailFactory);
  const s = await svc.run([MockProviderPerfect, MockProviderAverage]);
  assert(s.ranking.length === 0, `ranking.length=${s.ranking.length}`);
});

test("bestProvider undefined quando ranking vazio", async () => {
  const allFailFactory: RunnerFactory = () => ({
    runAll: async () => { throw new Error("all fail"); },
  });
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, allFailFactory);
  const s = await svc.run([MockProviderPerfect]);
  assert(s.bestProvider === undefined, "bestProvider deveria ser undefined quando ranking vazio");
});

test("benchmark não altera providers recebidos", async () => {
  const providers: BenchmarkProvider[] = [
    { id: "A", label: "Provider A", reviewer: makeNoopReviewer() },
    { id: "B", label: "Provider B", reviewer: makeNoopReviewer() },
  ];
  const snapshot = JSON.stringify(providers.map((p) => ({ id: p.id, label: p.label })));
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, fixedFactory);
  await svc.run(providers);
  const after = JSON.stringify(providers.map((p) => ({ id: p.id, label: p.label })));
  assert(snapshot === after, "providers foram alterados pelo benchmark");
});

test("ranking contém apenas providers bem-sucedidos", async () => {
  const factory = throwingRunnerFactory(failureReviewer, goodSummary);
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, factory);
  const s = await svc.run([MockProviderPerfect, MockProviderFailure, MockProviderAverage]);
  const hasFailure = s.ranking.some((r) => r.providerId === "FAILURE");
  assert(!hasFailure, "Provider com erro está no ranking");
  assert(s.ranking.length === 2, `ranking.length=${s.ranking.length}, esperado 2`);
});

// ─── Suite 6 — Mock provider ordering ────────────────────────────────────────

console.log("\nSuite 6 — Mock provider ordering");

test("MockProviderPerfect deve vencer MockProviderAverage", async () => {
  const factory = mappedRunnerFactory(
    [[perfectReviewer, perfectSummary], [averageReviewer, averageSummary]],
    emptyS,
  );
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, factory);
  const s = await svc.run([MockProviderAverage, MockProviderPerfect]);
  const perfectEntry = s.ranking.find((r) => r.providerId === "PERFECT")!;
  const averageEntry = s.ranking.find((r) => r.providerId === "AVERAGE")!;
  assert(perfectEntry !== undefined, "PERFECT ausente no ranking");
  assert(averageEntry !== undefined, "AVERAGE ausente no ranking");
  assert(
    perfectEntry.compositeScore > averageEntry.compositeScore,
    `PERFECT(${perfectEntry.compositeScore.toFixed(4)}) não venceu AVERAGE(${averageEntry.compositeScore.toFixed(4)})`,
  );
});

test("MockProviderAverage deve vencer MockProviderWeak", async () => {
  const factory = mappedRunnerFactory(
    [[averageReviewer, averageSummary], [weakReviewer, weakSummary]],
    emptyS,
  );
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, factory);
  const s = await svc.run([MockProviderWeak, MockProviderAverage]);
  const averageEntry = s.ranking.find((r) => r.providerId === "AVERAGE")!;
  const weakEntry = s.ranking.find((r) => r.providerId === "WEAK")!;
  assert(averageEntry !== undefined, "AVERAGE ausente no ranking");
  assert(weakEntry !== undefined, "WEAK ausente no ranking");
  assert(
    averageEntry.compositeScore > weakEntry.compositeScore,
    `AVERAGE(${averageEntry.compositeScore.toFixed(4)}) não venceu WEAK(${weakEntry.compositeScore.toFixed(4)})`,
  );
});

test("MockProviderFailure deve ficar fora do ranking", async () => {
  const throwFactory = throwingRunnerFactory(failureReviewer, perfectSummary);
  const svc = new GoldCorpusProviderBenchmarkService(metricsService, throwFactory);
  const s = await svc.run([MockProviderPerfect, MockProviderFailure]);
  const failureInRanking = s.ranking.some((r) => r.providerId === "FAILURE");
  assert(!failureInRanking, "MockProviderFailure está no ranking — deveria estar ausente");
  assert(s.ranking.length === 1, `ranking.length=${s.ranking.length}, esperado 1`);
});

// ─── Resultado final ──────────────────────────────────────────────────────────

await Promise.all(allTests);

console.log(`\nTotal: ${passed + failed} | ✓ ${passed} | ✗ ${failed}`);
if (failed > 0) {
  console.error(`\n${failed} testes falharam.`);
  process.exit(1);
} else {
  console.log("Todos os testes passaram.");
}

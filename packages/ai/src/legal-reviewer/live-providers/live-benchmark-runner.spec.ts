/**
 * FASE 9.0.8.1 — Testes do LiveBenchmarkRunnerService
 *
 * 18 testes cobrindo: dry-run, resume, filtros, limites, isolamento de erro,
 * persistência e comportamento de cost guard.
 * Não chama nenhuma API externa.
 */

import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { LiveBenchmarkRunnerService } from "./live-benchmark-runner.service.js";
import { LiveBenchmarkCostGuardService } from "./live-benchmark-cost-guard.service.js";
import { LiveBenchmarkStorageService } from "./live-benchmark-storage.service.js";
import type { LiveBenchmarkConfig, LiveProviderId } from "./live-provider.types.js";
import type { ReviewerLike } from "../gold-corpus/gold-corpus-regression.types.js";
import type { AiLegalStrengthReviewRequest } from "../dto/ai-legal-strength-review-request.js";
import type { AiLegalStrengthReviewResult } from "../dto/ai-legal-strength-review-result.js";

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Diretório temporário por suite — criado antes dos testes, removido depois. */
const TEST_BASE_DIR = path.join(os.tmpdir(), `live-benchmark-runner-spec-${Date.now()}`);
fs.mkdirSync(TEST_BASE_DIR, { recursive: true });

function makeTempDir(label: string): string {
  const dir = path.join(TEST_BASE_DIR, label.replace(/\s+/g, "-").replace(/[^\w-]/g, ""));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeConfig(overrides: Partial<LiveBenchmarkConfig> = {}): LiveBenchmarkConfig {
  return {
    enabled: false,
    dryRun: true,
    providers: ["openai"] as LiveProviderId[],
    maxDocumentsPerProvider: 2,
    costLimits: {
      openai: { maxUsd: 10.00 },
      gemini: { maxUsd: 10.00 },
      deepseek: { maxUsd: 10.00 },
    },
    modelByProvider: {
      openai: "gpt-4o",
      gemini: "gemini-2.5-pro",
      deepseek: "deepseek-reasoner",
    },
    maxInputTokensPerDocument: 0,
    maxOutputTokensPerDocument: 500,
    persistRawResponses: false,
    resume: false,
    ...overrides,
  };
}

function makeMockReviewer(
  onReview?: (req: AiLegalStrengthReviewRequest) => Promise<AiLegalStrengthReviewResult>,
): ReviewerLike & { callCount: number } {
  const reviewer = {
    callCount: 0,
    async review(req: AiLegalStrengthReviewRequest): Promise<AiLegalStrengthReviewResult> {
      reviewer.callCount++;
      if (onReview) return onReview(req);
      return {
        findings: [],
        summary: "mock",
        provider: "MOCK",
        model: "mock",
        generatedAt: new Date(),
        requiresHumanReview: true,
      };
    },
  };
  return reviewer;
}

function makeRunner(
  reviewers: Partial<Record<LiveProviderId, ReviewerLike>>,
  storageDir?: string,
): LiveBenchmarkRunnerService {
  const costGuard = new LiveBenchmarkCostGuardService();
  const storage = new LiveBenchmarkStorageService(storageDir ?? makeTempDir("default"));
  return new LiveBenchmarkRunnerService(costGuard, storage, reviewers);
}

// ─── Dry-run ──────────────────────────────────────────────────────────────────

test("dryRun não chama o reviewer", async () => {
  const reviewer = makeMockReviewer();
  const runner = makeRunner({ openai: reviewer });
  await runner.run(makeConfig({ dryRun: true, maxDocumentsPerProvider: 2 }));
  assert(reviewer.callCount === 0, `esperava callCount=0, obteve ${reviewer.callCount}`);
});

test("dryRun gera resultados com caseId e domain preenchidos", async () => {
  const runner = makeRunner({ openai: makeMockReviewer() });
  const state = await runner.run(makeConfig({ dryRun: true, maxDocumentsPerProvider: 2 }));
  assert(state.results.length === 2, `esperava 2 resultados, obteve ${state.results.length}`);
  assert(state.results[0] !== undefined && state.results[0].caseId.length > 0, "caseId vazio");
  assert(state.results[0] !== undefined && state.results[0].domain.length > 0, "domain vazio");
});

test("dryRun usage.estimatedCostUsd é sempre zero", async () => {
  const runner = makeRunner({ openai: makeMockReviewer() });
  const state = await runner.run(makeConfig({ dryRun: true, maxDocumentsPerProvider: 3 }));
  const anyNonZeroCost = state.results.some((r) => r.usage.estimatedCostUsd !== 0);
  assert(!anyNonZeroCost, "esperava estimatedCostUsd=0 em todos os resultados de dry-run");
});

test("dryRun define completedAt no estado final", async () => {
  const runner = makeRunner({ openai: makeMockReviewer() });
  const state = await runner.run(makeConfig({ dryRun: true, maxDocumentsPerProvider: 1 }));
  assert(typeof state.completedAt === "string" && state.completedAt.length > 0, "completedAt ausente");
});

test("dryRun totalsByProvider contabiliza documentsCompleted", async () => {
  const runner = makeRunner({ openai: makeMockReviewer() });
  const state = await runner.run(makeConfig({ dryRun: true, maxDocumentsPerProvider: 3 }));
  const totals = state.totalsByProvider["openai"];
  assert(totals !== undefined, "totals openai ausente");
  assert(
    totals.documentsCompleted === 3,
    `esperava 3 documentosCompleted, obteve ${totals.documentsCompleted}`,
  );
});

// ─── Filtros ──────────────────────────────────────────────────────────────────

test("includeDomains filtra apenas documentos do domínio especificado", async () => {
  const runner = makeRunner({ openai: makeMockReviewer() });
  const state = await runner.run(
    makeConfig({ dryRun: true, maxDocumentsPerProvider: 100, includeDomains: ["RGPS"] }),
  );
  const allRgps = state.results.every((r) => r.domain === "RGPS");
  assert(allRgps, "resultado contém documento de domínio diferente de RGPS");
  assert(state.results.length > 0, "nenhum resultado para domínio RGPS");
});

test("includeCaseIds filtra exatamente os caseIds especificados", async () => {
  const runner = makeRunner({ openai: makeMockReviewer() });
  const targetIds = ["RGPS-001", "RGPS-002"];
  const state = await runner.run(
    makeConfig({ dryRun: true, maxDocumentsPerProvider: 10, includeCaseIds: targetIds }),
  );
  const ids = state.results.map((r) => r.caseId);
  assert(ids.length <= 2, `esperava ≤2 resultados, obteve ${ids.length}`);
  assert(ids.every((id) => targetIds.includes(id)), "resultado contém caseId não solicitado");
});

test("maxDocumentsPerProvider limita resultados por provider", async () => {
  const runner = makeRunner({ openai: makeMockReviewer() });
  const state = await runner.run(makeConfig({ dryRun: true, maxDocumentsPerProvider: 1 }));
  const openaiResults = state.results.filter((r) => r.providerId === "openai");
  assert(openaiResults.length === 1, `esperava 1 resultado, obteve ${openaiResults.length}`);
});

// ─── Multi-provider ───────────────────────────────────────────────────────────

test("múltiplos providers geram resultados independentes em dryRun", async () => {
  const runner = makeRunner({
    openai: makeMockReviewer(),
    gemini: makeMockReviewer(),
  });
  const state = await runner.run(
    makeConfig({ dryRun: true, providers: ["openai", "gemini"], maxDocumentsPerProvider: 2 }),
  );
  const openaiCount = state.results.filter((r) => r.providerId === "openai").length;
  const geminiCount = state.results.filter((r) => r.providerId === "gemini").length;
  assert(openaiCount === 2, `esperava 2 openai, obteve ${openaiCount}`);
  assert(geminiCount === 2, `esperava 2 gemini, obteve ${geminiCount}`);
});

test("provider sem reviewer configurado é ignorado", async () => {
  const runner = makeRunner({ openai: makeMockReviewer() }); // gemini não configurado
  const state = await runner.run(
    makeConfig({ dryRun: true, providers: ["openai", "gemini"], maxDocumentsPerProvider: 2 }),
  );
  const geminiResults = state.results.filter((r) => r.providerId === "gemini");
  assert(geminiResults.length === 0, "esperava 0 resultados para provider sem reviewer");
});

// ─── Resume ───────────────────────────────────────────────────────────────────

test("resume pula documentos já processados", async () => {
  const dir = makeTempDir("resume");
  const reviewer = makeMockReviewer();
  const runner = makeRunner({ openai: reviewer }, dir);
  const config = makeConfig({ dryRun: true, maxDocumentsPerProvider: 2, resume: true });

  // Primeira execução
  const runId = "resume-test-run";
  const state1 = await runner.run(config, runId);
  assert(state1.results.length === 2, `esperava 2 no 1o run, obteve ${state1.results.length}`);

  // Segunda execução com mesmo runId — deve pular os 2 já processados
  const state2 = await runner.run(
    makeConfig({ dryRun: true, maxDocumentsPerProvider: 4, resume: true }),
    runId,
  );
  // 4 - 2 já processados = 2 novos
  assert(state2.results.length === 4, `esperava 4 no 2o run, obteve ${state2.results.length}`);
});

// ─── Isolamento de erro ───────────────────────────────────────────────────────

test("erro no reviewer é isolado — run continua para os demais documentos", async () => {
  const prev = process.env["LIVE_BENCHMARK_ENABLED"];
  process.env["LIVE_BENCHMARK_ENABLED"] = "true";
  try {
    let call = 0;
    const reviewer = makeMockReviewer(async () => {
      call++;
      if (call === 1) throw new Error("Falha simulada no primeiro documento");
      return { findings: [], summary: "ok", provider: "MOCK", model: "m", generatedAt: new Date(), requiresHumanReview: true };
    });
    const runner = makeRunner({ openai: reviewer });
    const state = await runner.run(
      makeConfig({ enabled: true, dryRun: false, maxDocumentsPerProvider: 2 }),
    );
    assert(state.results.length === 2, `esperava 2 resultados, obteve ${state.results.length}`);
  } finally {
    if (prev !== undefined) process.env["LIVE_BENCHMARK_ENABLED"] = prev;
    else delete process.env["LIVE_BENCHMARK_ENABLED"];
  }
});

test("erro no reviewer é registrado em result.error", async () => {
  const prev = process.env["LIVE_BENCHMARK_ENABLED"];
  process.env["LIVE_BENCHMARK_ENABLED"] = "true";
  try {
    const reviewer = makeMockReviewer(async () => {
      throw new Error("erro de rede simulado");
    });
    const runner = makeRunner({ openai: reviewer });
    const state = await runner.run(
      makeConfig({ enabled: true, dryRun: false, maxDocumentsPerProvider: 1 }),
    );
    assert(state.results.length === 1, `esperava 1 resultado, obteve ${state.results.length}`);
    const result = state.results[0];
    assert(result !== undefined && typeof result.error === "string", "esperava result.error preenchido");
    assert(result !== undefined && result.error !== undefined && result.error.includes("rede"), `error deve conter mensagem, obteve: ${result?.error}`);
  } finally {
    if (prev !== undefined) process.env["LIVE_BENCHMARK_ENABLED"] = prev;
    else delete process.env["LIVE_BENCHMARK_ENABLED"];
  }
});

// ─── Persistência ─────────────────────────────────────────────────────────────

test("estado é persistido em disco após execução", async () => {
  const dir = makeTempDir("persist");
  const storage = new LiveBenchmarkStorageService(dir);
  const runner = new LiveBenchmarkRunnerService(
    new LiveBenchmarkCostGuardService(),
    storage,
    { openai: makeMockReviewer() },
  );
  const config = makeConfig({ dryRun: true, maxDocumentsPerProvider: 1 });
  const runId = "persist-test";
  await runner.run(config, runId);

  const loaded = await storage.loadState(runId);
  assert(loaded !== null, "estado não foi persistido em disco");
  assert(loaded !== null && loaded.results.length === 1, `esperava 1 resultado persistido, obteve ${loaded?.results.length}`);
});

test("arquivo de estado tem completedAt após run completo", async () => {
  const dir = makeTempDir("completed-at");
  const storage = new LiveBenchmarkStorageService(dir);
  const runner = new LiveBenchmarkRunnerService(
    new LiveBenchmarkCostGuardService(),
    storage,
    { openai: makeMockReviewer() },
  );
  const runId = "completed-test";
  await runner.run(makeConfig({ dryRun: true, maxDocumentsPerProvider: 1 }), runId);

  const loaded = await storage.loadState(runId);
  assert(loaded !== null && typeof loaded.completedAt === "string", "completedAt ausente no arquivo persistido");
});

// ─── Bloqueio de live mode ────────────────────────────────────────────────────

test("run lança erro quando dryRun=false e config.enabled=false", async () => {
  const runner = makeRunner({ openai: makeMockReviewer() });
  let threw = false;
  try {
    await runner.run(makeConfig({ dryRun: false, enabled: false }));
  } catch {
    threw = true;
  }
  assert(threw, "esperava exceção para live run com enabled=false");
});

test("run lança erro quando dryRun=false e LIVE_BENCHMARK_ENABLED ausente", async () => {
  const prev = process.env["LIVE_BENCHMARK_ENABLED"];
  delete process.env["LIVE_BENCHMARK_ENABLED"];
  const runner = makeRunner({ openai: makeMockReviewer() });
  let threw = false;
  try {
    await runner.run(makeConfig({ dryRun: false, enabled: true }));
  } catch {
    threw = true;
  } finally {
    if (prev !== undefined) process.env["LIVE_BENCHMARK_ENABLED"] = prev;
  }
  assert(threw, "esperava exceção para live run sem LIVE_BENCHMARK_ENABLED");
});

test("dryRun=true não lança mesmo sem LIVE_BENCHMARK_ENABLED", async () => {
  const prev = process.env["LIVE_BENCHMARK_ENABLED"];
  delete process.env["LIVE_BENCHMARK_ENABLED"];
  const runner = makeRunner({ openai: makeMockReviewer() });
  let threw = false;
  try {
    await runner.run(makeConfig({ dryRun: true, enabled: false, maxDocumentsPerProvider: 1 }));
  } catch {
    threw = true;
  } finally {
    if (prev !== undefined) process.env["LIVE_BENCHMARK_ENABLED"] = prev;
  }
  assert(!threw, "dryRun não deve lançar mesmo sem LIVE_BENCHMARK_ENABLED");
});

// ─── Limpeza e runner ─────────────────────────────────────────────────────────

Promise.all(allTests).then(() => {
  // Limpeza do diretório temporário
  try { fs.rmSync(TEST_BASE_DIR, { recursive: true, force: true }); } catch { /* ignora */ }

  const total = passed + failed;
  console.log(`\nRunner — ${passed}/${total} testes passaram`);
  if (failed > 0) process.exit(1);
});

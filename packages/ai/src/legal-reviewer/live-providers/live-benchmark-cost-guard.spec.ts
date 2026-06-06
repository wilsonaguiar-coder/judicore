/**
 * FASE 9.0.8.1 — Testes do LiveBenchmarkCostGuardService
 *
 * 6 testes cobrindo: estimativas, cálculo de custo e guards de execução.
 * Não chama nenhuma API externa.
 */

import { LiveBenchmarkCostGuardService } from "./live-benchmark-cost-guard.service.js";
import type { LiveBenchmarkConfig, LiveBenchmarkRunState } from "./live-provider.types.js";

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

const guard = new LiveBenchmarkCostGuardService();

function makeConfig(overrides: Partial<LiveBenchmarkConfig> = {}): LiveBenchmarkConfig {
  return {
    enabled: true,
    dryRun: false,
    providers: ["openai"],
    maxDocumentsPerProvider: 5,
    costLimits: {
      openai: { maxUsd: 1.00 },
      gemini: { maxUsd: 1.00 },
      deepseek: { maxUsd: 1.00 },
    },
    modelByProvider: {
      openai: "gpt-4o",
      gemini: "gemini-2.5-pro",
      deepseek: "deepseek-reasoner",
    },
    maxInputTokensPerDocument: 0,
    maxOutputTokensPerDocument: 0,
    persistRawResponses: false,
    resume: false,
    ...overrides,
  };
}

function makeState(accumulatedCost = 0): LiveBenchmarkRunState {
  return {
    runId: "test-run",
    startedAt: "2026-06-06T00:00:00.000Z",
    config: makeConfig(),
    results: [],
    totalsByProvider: {
      openai: { documentsCompleted: 0, documentsFailed: 0, estimatedCostUsd: accumulatedCost, inputTokens: 0, outputTokens: 0 },
      gemini: { documentsCompleted: 0, documentsFailed: 0, estimatedCostUsd: 0, inputTokens: 0, outputTokens: 0 },
      deepseek: { documentsCompleted: 0, documentsFailed: 0, estimatedCostUsd: 0, inputTokens: 0, outputTokens: 0 },
    },
  };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

test("estimateInputTokens retorna valor positivo para texto não-vazio", () => {
  const tokens = guard.estimateInputTokens("Este é um texto jurídico de teste com várias palavras.");
  assert(tokens > 0, `esperava tokens > 0, obteve ${tokens}`);
  // ~52 chars / 3.5 ≈ 15 tokens
  assert(tokens >= 10, `esperava ao menos 10 tokens para texto curto, obteve ${tokens}`);
});

test("estimateCost calcula custo proporcional aos tokens para openai", () => {
  const cost = guard.estimateCost("openai", "gpt-4o", 1000, 1000);
  // 1000 input * 0.010/1000 + 1000 output * 0.030/1000 = 0.010 + 0.030 = 0.040
  assert(Math.abs(cost - 0.04) < 0.001, `esperava ~$0.04, obteve $${cost.toFixed(6)}`);
});

test("estimateCost retorna 0 para tokens zerados", () => {
  const cost = guard.estimateCost("openai", "gpt-4o", 0, 0);
  assert(cost === 0, `esperava 0 para tokens zerados, obteve ${cost}`);
});

test("canRunProviderDocument retorna false quando LIVE_BENCHMARK_ENABLED ausente", () => {
  const prev = process.env["LIVE_BENCHMARK_ENABLED"];
  delete process.env["LIVE_BENCHMARK_ENABLED"];
  try {
    const result = guard.canRunProviderDocument("openai", 0.001, makeState(), makeConfig());
    assert(!result, "esperava false quando LIVE_BENCHMARK_ENABLED não definido");
  } finally {
    if (prev !== undefined) process.env["LIVE_BENCHMARK_ENABLED"] = prev;
  }
});

test("canRunProviderDocument retorna false quando custo acumulado excede limite", () => {
  const prev = process.env["LIVE_BENCHMARK_ENABLED"];
  process.env["LIVE_BENCHMARK_ENABLED"] = "true";
  try {
    // Acumulado $0.95 + próximo $0.10 = $1.05 > limite $1.00
    const state = makeState(0.95);
    const result = guard.canRunProviderDocument("openai", 0.10, state, makeConfig());
    assert(!result, "esperava false quando custo acumulado + próximo excede limite");
  } finally {
    if (prev !== undefined) process.env["LIVE_BENCHMARK_ENABLED"] = prev;
    else delete process.env["LIVE_BENCHMARK_ENABLED"];
  }
});

test("assertCanRunProviderDocument lança erro quando LIVE_BENCHMARK_ENABLED ausente", () => {
  const prev = process.env["LIVE_BENCHMARK_ENABLED"];
  delete process.env["LIVE_BENCHMARK_ENABLED"];
  let threw = false;
  try {
    guard.assertCanRunProviderDocument("openai", 0.001, makeState(), makeConfig());
  } catch {
    threw = true;
  } finally {
    if (prev !== undefined) process.env["LIVE_BENCHMARK_ENABLED"] = prev;
  }
  assert(threw, "esperava exceção quando LIVE_BENCHMARK_ENABLED não definido");
});

// ─── Runner ───────────────────────────────────────────────────────────────────

Promise.all(allTests).then(() => {
  const total = passed + failed;
  console.log(`\nCostGuard — ${passed}/${total} testes passaram`);
  if (failed > 0) process.exit(1);
});

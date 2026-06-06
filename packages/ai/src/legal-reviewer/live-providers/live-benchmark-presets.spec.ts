/**
 * FASE 9.0.8.2 — Testes do preset Pilot 20
 *
 * 14 testes cobrindo: contagem de IDs, unicidade, existência no corpus,
 * providers, limits, env override de modelos, e configurações de execução.
 * Nenhuma execução live é feita.
 */

import {
  LIVE_BENCHMARK_PILOT_20_CASE_IDS,
  LIVE_BENCHMARK_PILOT_20_CONFIG,
  buildModelByProvider,
} from "./live-benchmark-presets.js";
import { goldCorpusV1 } from "../gold-corpus/gold-corpus-v1.spec.js";
import { LiveBenchmarkRunnerService } from "./live-benchmark-runner.service.js";
import { LiveBenchmarkCostGuardService } from "./live-benchmark-cost-guard.service.js";
import { LiveBenchmarkStorageService } from "./live-benchmark-storage.service.js";
import { createOpenAIReviewer } from "./openai-reviewer.provider.js";
import type { LiveBenchmarkConfig, LiveProviderId } from "./live-provider.types.js";
import type { ReviewerLike } from "../gold-corpus/gold-corpus-regression.types.js";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const corpusIds = new Set(goldCorpusV1.map((c) => c.id));

function makeTempDir(label: string): string {
  const dir = path.join(os.tmpdir(), `presets-spec-${label}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeFullConfig(overrides: Partial<LiveBenchmarkConfig> = {}): LiveBenchmarkConfig {
  return {
    enabled: false,
    dryRun: true,
    providers: ["openai", "gemini", "deepseek"],
    maxDocumentsPerProvider: 20,
    costLimits: { openai: { maxUsd: 3 }, gemini: { maxUsd: 3 }, deepseek: { maxUsd: 2 } },
    modelByProvider: { openai: "gpt-5.4", gemini: "gemini-2.5-pro", deepseek: "deepseek-reasoner" },
    maxInputTokensPerDocument: 18_000,
    maxOutputTokensPerDocument: 4_000,
    persistRawResponses: true,
    resume: true,
    includeCaseIds: LIVE_BENCHMARK_PILOT_20_CASE_IDS as string[],
    ...overrides,
  };
}

function makeNoopReviewer(): ReviewerLike {
  return {
    async review(): Promise<never> {
      throw new Error("noop reviewer não deve ser chamado em dry-run");
    },
  };
}

// ─── Testes do preset ─────────────────────────────────────────────────────────

test("Preset contém exatamente 20 caseIds", () => {
  assert(
    LIVE_BENCHMARK_PILOT_20_CASE_IDS.length === 20,
    `esperava 20 IDs, obteve ${LIVE_BENCHMARK_PILOT_20_CASE_IDS.length}`,
  );
});

test("Preset não contém caseIds duplicados", () => {
  const unique = new Set(LIVE_BENCHMARK_PILOT_20_CASE_IDS);
  assert(
    unique.size === LIVE_BENCHMARK_PILOT_20_CASE_IDS.length,
    `há IDs duplicados: ${LIVE_BENCHMARK_PILOT_20_CASE_IDS.length - unique.size} duplicata(s)`,
  );
});

test("Todos os 20 caseIds existem no Gold Corpus V1", () => {
  const missing = LIVE_BENCHMARK_PILOT_20_CASE_IDS.filter((id) => !corpusIds.has(id));
  assert(
    missing.length === 0,
    `IDs não encontrados no corpus: ${missing.join(", ")}`,
  );
});

test("Config contém os 3 providers: openai, gemini, deepseek", () => {
  const providers = LIVE_BENCHMARK_PILOT_20_CONFIG.providers ?? [];
  assert(providers.includes("openai"), "openai ausente em providers");
  assert(providers.includes("gemini"), "gemini ausente em providers");
  assert(providers.includes("deepseek"), "deepseek ausente em providers");
  assert(providers.length === 3, `esperava 3 providers, obteve ${providers.length}`);
});

test("maxDocumentsPerProvider é 20", () => {
  assert(
    LIVE_BENCHMARK_PILOT_20_CONFIG.maxDocumentsPerProvider === 20,
    `esperava 20, obteve ${LIVE_BENCHMARK_PILOT_20_CONFIG.maxDocumentsPerProvider}`,
  );
});

test("Cost limits são positivos para todos os providers", () => {
  const limits = LIVE_BENCHMARK_PILOT_20_CONFIG.costLimits;
  assert(limits !== undefined, "costLimits ausente");
  for (const pid of ["openai", "gemini", "deepseek"] as LiveProviderId[]) {
    const maxUsd = limits?.[pid]?.maxUsd ?? 0;
    assert(maxUsd > 0, `costLimits.${pid}.maxUsd deve ser > 0, obteve ${maxUsd}`);
  }
});

test("buildModelByProvider usa OPENAI_BENCHMARK_MODEL quando definido", () => {
  const models = buildModelByProvider({ OPENAI_BENCHMARK_MODEL: "gpt-custom-test" });
  assert(models.openai === "gpt-custom-test", `esperava gpt-custom-test, obteve ${models.openai}`);
});

test("buildModelByProvider usa GEMINI_BENCHMARK_MODEL quando definido", () => {
  const models = buildModelByProvider({ GEMINI_BENCHMARK_MODEL: "gemini-custom-test" });
  assert(models.gemini === "gemini-custom-test", `esperava gemini-custom-test, obteve ${models.gemini}`);
});

test("buildModelByProvider usa DEEPSEEK_BENCHMARK_MODEL quando definido", () => {
  const models = buildModelByProvider({ DEEPSEEK_BENCHMARK_MODEL: "deepseek-custom-test" });
  assert(models.deepseek === "deepseek-custom-test", `esperava deepseek-custom-test, obteve ${models.deepseek}`);
});

test("buildModelByProvider usa defaults quando env não definido", () => {
  const models = buildModelByProvider({});
  assert(models.openai === "gpt-5.4", `default openai esperado 'gpt-5.4', obteve '${models.openai}'`);
  assert(models.gemini === "gemini-2.5-pro", `default gemini esperado 'gemini-2.5-pro', obteve '${models.gemini}'`);
  assert(models.deepseek === "deepseek-reasoner", `default deepseek esperado 'deepseek-reasoner', obteve '${models.deepseek}'`);
});

test("Preset tem enabled=true e dryRun=false para modo live", () => {
  assert(LIVE_BENCHMARK_PILOT_20_CONFIG.enabled === true, "enabled deve ser true");
  assert(LIVE_BENCHMARK_PILOT_20_CONFIG.dryRun === false, "dryRun deve ser false");
});

test("Preset tem resume=true e persistRawResponses=true", () => {
  assert(LIVE_BENCHMARK_PILOT_20_CONFIG.resume === true, "resume deve ser true");
  assert(LIVE_BENCHMARK_PILOT_20_CONFIG.persistRawResponses === true, "persistRawResponses deve ser true");
});

test("includeCaseIds no preset é idêntico a LIVE_BENCHMARK_PILOT_20_CASE_IDS", () => {
  const configIds = LIVE_BENCHMARK_PILOT_20_CONFIG.includeCaseIds ?? [];
  assert(
    configIds.length === LIVE_BENCHMARK_PILOT_20_CASE_IDS.length,
    `tamanho difere: config=${configIds.length}, preset=${LIVE_BENCHMARK_PILOT_20_CASE_IDS.length}`,
  );
  for (const id of LIVE_BENCHMARK_PILOT_20_CASE_IDS) {
    assert(configIds.includes(id as string), `ID ${id} ausente em includeCaseIds`);
  }
});

test("dryRun=true com config piloto processa exatamente os 20 casos selecionados", async () => {
  const dir = makeTempDir("pilot20");
  const runner = new LiveBenchmarkRunnerService(
    new LiveBenchmarkCostGuardService(),
    new LiveBenchmarkStorageService(dir),
    { openai: makeNoopReviewer(), gemini: makeNoopReviewer(), deepseek: makeNoopReviewer() },
  );

  const config = makeFullConfig({ dryRun: true, enabled: false });
  const state = await runner.run(config);

  const caseIds = new Set(state.results.map((r) => r.caseId));
  const expectedIds = new Set(LIVE_BENCHMARK_PILOT_20_CASE_IDS);

  assert(
    caseIds.size === expectedIds.size,
    `esperava ${expectedIds.size} caseIds únicos, obteve ${caseIds.size}`,
  );
  for (const id of expectedIds) {
    assert(caseIds.has(id), `caseId ${id} ausente nos resultados`);
  }

  // Limpeza
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignora */ }
});

test("createOpenAIReviewer lança sem OPENAI_API_KEY sem expor valor da chave", () => {
  const prev = process.env["OPENAI_API_KEY"];
  delete process.env["OPENAI_API_KEY"];
  let errorMsg = "";
  try {
    createOpenAIReviewer();
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  } finally {
    if (prev !== undefined) process.env["OPENAI_API_KEY"] = prev;
  }
  assert(errorMsg.length > 0, "esperava exceção ao criar reviewer sem API key");
  assert(!errorMsg.includes("Bearer"), "mensagem de erro não deve incluir conteúdo de chave");
});

// ─── Runner ───────────────────────────────────────────────────────────────────

Promise.all(allTests).then(() => {
  const total = passed + failed;
  console.log(`\nPresets Pilot 20 — ${passed}/${total} testes passaram`);
  if (failed > 0) process.exit(1);
});

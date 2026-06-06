/**
 * FASE 9.0.8.2A — Script de Execução Pilot 50
 *
 * Executa 50 peças do Gold Corpus V1 contra GPT, Gemini e DeepSeek.
 * Gera três arquivos de saída em .benchmark-runs/:
 *   - pilot50-results-{runId}.json    — run state completo (um resultado por caso × provider)
 *   - pilot50-summary-{runId}.json    — métricas por provider (Precision, Recall, F1, etc.)
 *   - pilot50-ranking-{runId}.json    — ranking final com score composto
 *
 * Uso:
 *   tsx scripts/run-pilot-50.ts --dry-run
 *   LIVE_BENCHMARK_ENABLED=true tsx scripts/run-pilot-50.ts
 *
 * Segurança:
 *   - Nenhuma chave de API é impressa no console.
 *   - Respostas brutas não são impressas (apenas métricas resumidas).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { LiveBenchmarkRunnerService } from "../src/legal-reviewer/live-providers/live-benchmark-runner.service.js";
import { LiveBenchmarkCostGuardService } from "../src/legal-reviewer/live-providers/live-benchmark-cost-guard.service.js";
import { LiveBenchmarkStorageService } from "../src/legal-reviewer/live-providers/live-benchmark-storage.service.js";
import { GoldCorpusRegressionRunnerService } from "../src/legal-reviewer/gold-corpus/gold-corpus-regression-runner.service.js";
import { GoldCorpusMetricsService } from "../src/legal-reviewer/gold-corpus/gold-corpus-metrics.service.js";
import { goldCorpusGeneratedDocuments } from "../src/legal-reviewer/gold-corpus/gold-corpus-generated-documents.js";
import {
  LIVE_BENCHMARK_PILOT_50_CASE_IDS,
  LIVE_BENCHMARK_PILOT_50_CONFIG,
} from "../src/legal-reviewer/live-providers/live-benchmark-pilot-50-preset.js";
import { createOpenAIReviewer } from "../src/legal-reviewer/live-providers/openai-reviewer.provider.js";
import { createGeminiReviewer } from "../src/legal-reviewer/live-providers/gemini-reviewer.provider.js";
import { createDeepSeekReviewer } from "../src/legal-reviewer/live-providers/deepseek-reviewer.provider.js";
import type {
  LiveBenchmarkConfig,
  LiveBenchmarkRunState,
  LiveProviderId,
  LiveProviderReviewResult,
} from "../src/legal-reviewer/live-providers/live-provider.types.js";
import type { ReviewerLike } from "../src/legal-reviewer/gold-corpus/gold-corpus-regression.types.js";
import type { GoldCorpusRegressionResult, GoldCorpusRegressionSummary } from "../src/legal-reviewer/gold-corpus/gold-corpus-regression.types.js";
import type { GoldCorpusMetricSlice } from "../src/legal-reviewer/gold-corpus/gold-corpus-metrics.types.js";
import type { AiLegalStrengthReviewResult } from "../src/legal-reviewer/dto/ai-legal-strength-review-result.js";
import type { GeneratedGoldCorpusDocument } from "../src/legal-reviewer/gold-corpus/gold-corpus-document-generator.service.js";

// ─── .env loader ──────────────────────────────────────────────────────────────

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env"));

// ─── Flags ────────────────────────────────────────────────────────────────────

const isDryRun = process.argv.includes("--dry-run");
const OUTPUT_DIR = ".benchmark-runs";

// ─── Validação de ambiente ────────────────────────────────────────────────────

function validateLiveEnvironment(): void {
  if (process.env["LIVE_BENCHMARK_ENABLED"] !== "true") {
    console.error("ERRO: LIVE_BENCHMARK_ENABLED deve ser 'true' para execução real.");
    console.error("      Use --dry-run para simular sem custo.");
    process.exit(1);
  }
  const missing: string[] = [];
  if (!process.env["OPENAI_API_KEY"])   missing.push("OPENAI_API_KEY");
  if (!process.env["GEMINI_API_KEY"])   missing.push("GEMINI_API_KEY");
  if (!process.env["DEEPSEEK_API_KEY"]) missing.push("DEEPSEEK_API_KEY");
  if (missing.length > 0) {
    console.error(`ERRO: Variáveis ausentes: ${missing.join(", ")}`);
    process.exit(1);
  }
}

// ─── Dry-run reviewer (nunca chamado — apenas satisfaz tipos) ─────────────────

function createDryRunReviewer(): ReviewerLike {
  return {
    async review(): Promise<never> {
      throw new Error("[BUG] Reviewer chamado em dry-run.");
    },
  };
}

// ─── Replay reviewer ──────────────────────────────────────────────────────────
//
// Cria um ReviewerLike que retorna os resultados cacheados da execução live,
// evitando novas chamadas de API durante a fase de cálculo de métricas.
// Para casos sem resultado (erro ou dry-run), retorna findings vazios.

function makeReplayReviewer(
  liveResults: LiveProviderReviewResult[],
  providerId: LiveProviderId,
): ReviewerLike {
  const cache = new Map<string, AiLegalStrengthReviewResult>();
  for (const r of liveResults) {
    if (r.providerId === providerId && !r.error && r.review != null) {
      cache.set(r.caseId, r.review as AiLegalStrengthReviewResult);
    }
  }
  return {
    async review(request) {
      const caseId = (request.audit as { pieceId: string }).pieceId;
      return cache.get(caseId) ?? {
        findings: [],
        summary: "",
        provider: providerId,
        model: "",
        generatedAt: new Date(),
        requiresHumanReview: true,
      };
    },
  };
}

// ─── Construção manual do RegressionSummary (replica lógica privada do runner) ─

function buildRegressionSummary(results: GoldCorpusRegressionResult[]): GoldCorpusRegressionSummary {
  const passedCases = results.filter((r) => r.pass).length;
  const failedCases = results.length - passedCases;
  const scorePassCount = results.filter((r) => r.scorePass).length;
  const findingPassCount = results.filter(
    (r) => r.expectedFindings.length === 0 || r.matchedExpectedFindings.length >= 1,
  ).length;

  const byDomain: GoldCorpusRegressionSummary["byDomain"] = {};
  const byQuality: GoldCorpusRegressionSummary["byQuality"] = {};

  for (const r of results) {
    if (!byDomain[r.domain]) byDomain[r.domain] = { total: 0, passed: 0, failed: 0, passRate: 0 };
    byDomain[r.domain].total++;
    if (r.pass) byDomain[r.domain].passed++; else byDomain[r.domain].failed++;
    byDomain[r.domain].passRate = byDomain[r.domain].passed / byDomain[r.domain].total;

    if (!byQuality[r.quality]) byQuality[r.quality] = { total: 0, passed: 0, failed: 0, passRate: 0 };
    byQuality[r.quality].total++;
    if (r.pass) byQuality[r.quality].passed++; else byQuality[r.quality].failed++;
    byQuality[r.quality].passRate = byQuality[r.quality].passed / byQuality[r.quality].total;
  }

  return {
    totalCases: results.length,
    passedCases,
    failedCases,
    passRate: results.length > 0 ? passedCases / results.length : 0,
    scorePassRate: results.length > 0 ? scorePassCount / results.length : 0,
    findingPassRate: results.length > 0 ? findingPassCount / results.length : 0,
    results,
    byDomain,
    byQuality,
  };
}

// ─── Tipos de saída ───────────────────────────────────────────────────────────

interface ProviderMetrics extends GoldCorpusMetricSlice {
  byDomain: Record<string, GoldCorpusMetricSlice>;
  byQuality: Record<string, GoldCorpusMetricSlice>;
}

interface ProviderSummaryEntry {
  providerId: string;
  model: string;
  casesAttempted: number;
  casesWithError: number;
  // Finding-level metrics
  precision: number;
  recall: number;
  f1: number;
  // Case-level metrics
  passRate: number;
  scorePassRate: number;
  falsePositives: number;
  falseNegatives: number;
  truePositives: number;
  // Cost & latency
  estimatedCostUsd: number;
  costPerCaseUsd: number;
  totalDurationMs: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  // Token usage
  totalInputTokens: number;
  totalOutputTokens: number;
  // Breakdown
  metrics: ProviderMetrics;
}

interface RankingEntry {
  rank: number;
  providerId: string;
  model: string;
  compositeScore: number;
  f1: number;
  passRate: number;
  scorePassRate: number;
  precision: number;
  recall: number;
  estimatedCostUsd: number;
  avgLatencyMs: number;
}

interface Pilot50Summary {
  runId: string;
  generatedAt: string;
  mode: "live" | "dry-run";
  totalCasesPerProvider: number;
  providers: Record<string, ProviderSummaryEntry>;
}

interface Pilot50Ranking {
  runId: string;
  generatedAt: string;
  compositeFormula: string;
  ranking: RankingEntry[];
}

// ─── Cálculo de métricas por provider ────────────────────────────────────────

async function computeProviderMetrics(
  state: LiveBenchmarkRunState,
  pilot50Docs: GeneratedGoldCorpusDocument[],
  providerId: LiveProviderId,
  config: LiveBenchmarkConfig,
): Promise<ProviderSummaryEntry> {
  const providerResults = state.results.filter((r) => r.providerId === providerId);

  const replayReviewer = makeReplayReviewer(state.results, providerId);
  const regressionRunner = new GoldCorpusRegressionRunnerService(replayReviewer);
  const metricsSvc = new GoldCorpusMetricsService();

  const regressionResults = await Promise.all(
    pilot50Docs.map((doc) => regressionRunner.runCase(doc)),
  );

  const regressionSummary = buildRegressionSummary(regressionResults);
  const metrics = metricsSvc.calculate(regressionSummary);

  const durations = providerResults.map((r) => r.durationMs).filter((d) => d > 0);
  const totalDurationMs = durations.reduce((s, d) => s + d, 0);
  const avgLatencyMs = durations.length > 0 ? totalDurationMs / durations.length : 0;
  const minLatencyMs = durations.length > 0 ? Math.min(...durations) : 0;
  const maxLatencyMs = durations.length > 0 ? Math.max(...durations) : 0;
  const totalCostUsd = providerResults.reduce((s, r) => s + r.usage.estimatedCostUsd, 0);
  const casesWithError = providerResults.filter((r) => r.error).length;

  const totals = state.totalsByProvider[providerId];
  const totalInputTokens  = totals?.inputTokens ?? 0;
  const totalOutputTokens = totals?.outputTokens ?? 0;

  return {
    providerId,
    model: config.modelByProvider[providerId] ?? providerId,
    casesAttempted: providerResults.length,
    casesWithError,
    precision: metrics.findingPrecision,
    recall: metrics.findingRecall,
    f1: metrics.findingF1,
    passRate: metrics.casePassRate,
    scorePassRate: metrics.scorePassRate,
    falsePositives: metrics.falsePositiveCount,
    falseNegatives: metrics.falseNegativeCount,
    truePositives: metrics.truePositiveCount,
    estimatedCostUsd: totalCostUsd,
    costPerCaseUsd: providerResults.length > 0 ? totalCostUsd / providerResults.length : 0,
    totalDurationMs,
    avgLatencyMs,
    minLatencyMs,
    maxLatencyMs,
    totalInputTokens,
    totalOutputTokens,
    metrics: { ...metrics },
  };
}

// ─── Ranking ──────────────────────────────────────────────────────────────────
//
// Score composto:
//   F1           × 0.40  (qualidade de detecção de findings)
//   PassRate     × 0.25  (casos completos aprovados)
//   ScorePassRate× 0.20  (score dentro da faixa esperada)
//   CostEff      × 0.10  (custo normalizado inverso — menor custo = melhor)
//   LatencyEff   × 0.05  (latência normalizada inversa)

function buildRanking(
  providers: Record<string, ProviderSummaryEntry>,
): RankingEntry[] {
  const entries = Object.values(providers);

  const maxCost    = Math.max(...entries.map((e) => e.estimatedCostUsd), 0.0001);
  const maxLatency = Math.max(...entries.map((e) => e.avgLatencyMs), 1);

  const scored = entries.map((e) => {
    const costEff    = 1 - e.estimatedCostUsd / maxCost;
    const latencyEff = 1 - e.avgLatencyMs / maxLatency;
    const composite  =
      e.f1           * 0.40 +
      e.passRate     * 0.25 +
      e.scorePassRate* 0.20 +
      costEff        * 0.10 +
      latencyEff     * 0.05;
    return { ...e, compositeScore: Math.round(composite * 10000) / 10000 };
  });

  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  return scored.map((e, i) => ({
    rank: i + 1,
    providerId: e.providerId,
    model: e.model,
    compositeScore: e.compositeScore,
    f1: e.f1,
    passRate: e.passRate,
    scorePassRate: e.scorePassRate,
    precision: e.precision,
    recall: e.recall,
    estimatedCostUsd: e.estimatedCostUsd,
    avgLatencyMs: e.avgLatencyMs,
  }));
}

// ─── Persistência dos arquivos de saída ───────────────────────────────────────

function saveJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`  Salvo: ${filePath}`);
}

// ─── Impressão de resumo ──────────────────────────────────────────────────────

function printSummary(
  summary: Pilot50Summary,
  ranking: Pilot50Ranking,
): void {
  const sep = "══════════════════════════════════════════════════════";
  console.log(`\n${sep}`);
  console.log(isDryRun ? "RESUMO — DRY-RUN PILOT 50" : "RESUMO — LIVE BENCHMARK PILOT 50");
  console.log(sep);
  console.log(`Run ID:  ${summary.runId}`);
  console.log(`Gerado:  ${summary.generatedAt}`);
  console.log(`Modo:    ${isDryRun ? "DRY-RUN (sem custo real, métricas indisponíveis)" : "LIVE"}`);

  console.log("\nMétricas por provider:");
  for (const [pid, p] of Object.entries(summary.providers)) {
    console.log(`\n  ${pid.toUpperCase()} — ${p.model}`);
    console.log(`    Casos:         ${p.casesAttempted} (${p.casesWithError} erros)`);
    if (!isDryRun) {
      console.log(`    Precision:     ${(p.precision * 100).toFixed(1)}%`);
      console.log(`    Recall:        ${(p.recall * 100).toFixed(1)}%`);
      console.log(`    F1:            ${(p.f1 * 100).toFixed(1)}%`);
      console.log(`    PassRate:      ${(p.passRate * 100).toFixed(1)}%`);
      console.log(`    ScorePassRate: ${(p.scorePassRate * 100).toFixed(1)}%`);
      console.log(`    FP / FN:       ${p.falsePositives} / ${p.falseNegatives}`);
      console.log(`    Custo est.:    $${p.estimatedCostUsd.toFixed(4)}`);
      console.log(`    Lat. média:    ${p.avgLatencyMs.toFixed(0)}ms`);
    }
  }

  if (!isDryRun && ranking.ranking.length > 0) {
    console.log("\nRanking final:");
    for (const r of ranking.ranking) {
      console.log(
        `  ${r.rank}. ${r.providerId.padEnd(10)} score=${(r.compositeScore * 100).toFixed(1)}%` +
        `  F1=${(r.f1 * 100).toFixed(1)}%  $${r.estimatedCostUsd.toFixed(2)}`,
      );
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const mode = isDryRun ? "DRY-RUN" : "LIVE";
  console.log("══════════════════════════════════════════════════════");
  console.log(`LIVE BENCHMARK PILOT 50 — ${mode}`);
  console.log("══════════════════════════════════════════════════════");

  if (!isDryRun) validateLiveEnvironment();

  const config: LiveBenchmarkConfig = {
    ...LIVE_BENCHMARK_PILOT_50_CONFIG,
    ...(isDryRun ? { dryRun: true, enabled: false } : {}),
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23);
  const runId = `pilot50-${timestamp}`;
  console.log(`\nRun ID: ${runId}`);

  const geminiModel = config.modelByProvider["gemini"] ?? "gemini-2.5-pro";
  const reviewers: Partial<Record<LiveProviderId, ReviewerLike>> = isDryRun
    ? { openai: createDryRunReviewer(), gemini: createDryRunReviewer(), deepseek: createDryRunReviewer() }
    : { openai: createOpenAIReviewer(), gemini: createGeminiReviewer(undefined, geminiModel), deepseek: createDeepSeekReviewer() };

  // ── Executar benchmark live ────────────────────────────────────────────────

  const runner = new LiveBenchmarkRunnerService(
    new LiveBenchmarkCostGuardService(),
    new LiveBenchmarkStorageService(),
    reviewers,
  );

  console.log(
    `\nIniciando ${isDryRun ? "simulação" : "execução real"}: ` +
    `${config.includeCaseIds?.length ?? 0} casos × ${config.providers.length} providers`,
  );
  if (!isDryRun) {
    const limits = config.providers
      .map((p) => `${p}: $${config.costLimits[p as LiveProviderId]?.maxUsd.toFixed(2)}`)
      .join(", ");
    console.log(`Limites de custo: ${limits}`);
  }
  console.log("");

  const state: LiveBenchmarkRunState = await runner.run(config, runId);

  // ── Computar métricas por provider ────────────────────────────────────────

  const pilot50Set = new Set(LIVE_BENCHMARK_PILOT_50_CASE_IDS);
  const pilot50Docs = goldCorpusGeneratedDocuments.filter((d) => pilot50Set.has(d.caseId));

  const providerEntries: Record<string, ProviderSummaryEntry> = {};

  if (!isDryRun) {
    console.log("\nComputando métricas...");
    for (const pid of config.providers) {
      const providerId = pid as LiveProviderId;
      process.stdout.write(`  ${providerId}... `);
      providerEntries[providerId] = await computeProviderMetrics(
        state, pilot50Docs, providerId, config,
      );
      console.log("ok");
    }
  } else {
    // Dry-run: preencher com zeros (sem API real, sem findings reais)
    for (const pid of config.providers) {
      const providerId = pid as LiveProviderId;
      const providerResults = state.results.filter((r) => r.providerId === providerId);
      providerEntries[providerId] = {
        providerId,
        model: config.modelByProvider[providerId as LiveProviderId] ?? providerId,
        casesAttempted: providerResults.length,
        casesWithError: 0,
        precision: 0, recall: 0, f1: 0,
        passRate: 0, scorePassRate: 0,
        falsePositives: 0, falseNegatives: 0, truePositives: 0,
        estimatedCostUsd: 0, costPerCaseUsd: 0,
        totalDurationMs: 0, avgLatencyMs: 0, minLatencyMs: 0, maxLatencyMs: 0,
        totalInputTokens: 0, totalOutputTokens: 0,
        metrics: {
          totalCases: 0, findingPrecision: 0, findingRecall: 0, findingF1: 0,
          scorePassRate: 0, casePassRate: 0, falsePositiveCount: 0,
          falseNegativeCount: 0, truePositiveCount: 0,
          byDomain: {}, byQuality: {},
        },
      };
    }
  }

  const generatedAt = new Date().toISOString();

  const summary: Pilot50Summary = {
    runId,
    generatedAt,
    mode: isDryRun ? "dry-run" : "live",
    totalCasesPerProvider: LIVE_BENCHMARK_PILOT_50_CASE_IDS.length,
    providers: providerEntries,
  };

  const ranking: Pilot50Ranking = {
    runId,
    generatedAt,
    compositeFormula: "f1×0.40 + passRate×0.25 + scorePassRate×0.20 + costEfficiency×0.10 + latencyEfficiency×0.05",
    ranking: isDryRun ? [] : buildRanking(providerEntries),
  };

  // ── Salvar arquivos ────────────────────────────────────────────────────────

  console.log("\nSalvando arquivos de saída...");
  saveJson(path.join(OUTPUT_DIR, `pilot50-results-${runId}.json`),  state);
  saveJson(path.join(OUTPUT_DIR, `pilot50-summary-${runId}.json`),  summary);
  saveJson(path.join(OUTPUT_DIR, `pilot50-ranking-${runId}.json`),  ranking);

  // Aliases estáticos para facilitar referência
  saveJson(path.join(OUTPUT_DIR, "pilot50-results.json"),  state);
  saveJson(path.join(OUTPUT_DIR, "pilot50-summary.json"),  summary);
  saveJson(path.join(OUTPUT_DIR, "pilot50-ranking.json"),  ranking);

  printSummary(summary, ranking);

  if (state.results.some((r) => r.error)) {
    const n = state.results.filter((r) => r.error).length;
    console.log(`\nATENÇÃO: ${n} documento(s) com erro — verifique pilot50-results.json.`);
  }

  console.log("\nPilot 50 concluído.");
}

main().catch((err) => {
  console.error("Erro fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});

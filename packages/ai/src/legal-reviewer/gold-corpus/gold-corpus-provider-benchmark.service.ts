/**
 * FASE 9.0.8 — Gold Corpus Provider Benchmark Service
 *
 * Compara múltiplos providers/modelos usando o mesmo Gold Corpus V1,
 * os mesmos documentos sintéticos, o Regression Runner e o Metrics Service.
 *
 * Regras de design:
 * - Provider com erro NÃO derruba benchmark inteiro.
 * - Providers com erro ficam em results mas NÃO entram no ranking.
 * - ranking ordenado por compositeScore decrescente.
 * - bestProvider = primeiro colocado (undefined se ranking vazio).
 * - RunnerFactory injetável: default usa GoldCorpusRegressionRunnerService;
 *   testes injetam mock que evita chamadas de API reais.
 * - Nenhuma dependência específica de GPT, Gemini ou DeepSeek nesta fase.
 */

import { GoldCorpusRegressionRunnerService } from "./gold-corpus-regression-runner.service.js";
import { GoldCorpusMetricsService } from "./gold-corpus-metrics.service.js";
import type { GoldCorpusRegressionSummary } from "./gold-corpus-regression.types.js";
import type { GoldCorpusMetrics } from "./gold-corpus-metrics.types.js";
import type {
  BenchmarkProvider,
  ProviderBenchmarkResult,
  ProviderBenchmarkRankingEntry,
  ProviderBenchmarkSummary,
  RunnerFactory,
} from "./gold-corpus-provider-benchmark.types.js";

// ─── Pesos do composite score ─────────────────────────────────────────────────

const WEIGHTS = {
  f1: 0.40,
  precision: 0.25,
  recall: 0.20,
  casePassRate: 0.10,
  scorePassRate: 0.05,
} as const;

function computeCompositeScore(m: GoldCorpusMetrics): number {
  return (
    m.findingF1 * WEIGHTS.f1 +
    m.findingPrecision * WEIGHTS.precision +
    m.findingRecall * WEIGHTS.recall +
    m.casePassRate * WEIGHTS.casePassRate +
    m.scorePassRate * WEIGHTS.scorePassRate
  );
}

// ─── Fallbacks para casos de erro ─────────────────────────────────────────────

function emptyRegressionSummary(): GoldCorpusRegressionSummary {
  return {
    totalCases: 0,
    passedCases: 0,
    failedCases: 0,
    passRate: 0,
    scorePassRate: 0,
    findingPassRate: 0,
    results: [],
    byDomain: {},
    byQuality: {},
  };
}

// ─── Runner factory padrão ────────────────────────────────────────────────────

const defaultRunnerFactory: RunnerFactory = (reviewer) =>
  new GoldCorpusRegressionRunnerService(reviewer);

// ─── Serviço público ──────────────────────────────────────────────────────────

export class GoldCorpusProviderBenchmarkService {
  private readonly runnerFactory: RunnerFactory;

  constructor(
    private readonly metricsService: GoldCorpusMetricsService,
    runnerFactory?: RunnerFactory,
  ) {
    this.runnerFactory = runnerFactory ?? defaultRunnerFactory;
  }

  async run(providers: BenchmarkProvider[]): Promise<ProviderBenchmarkSummary> {
    const results: ProviderBenchmarkResult[] = [];

    for (const provider of providers) {
      const startMs = Date.now();
      let regressionSummary: GoldCorpusRegressionSummary;
      let metrics: GoldCorpusMetrics;
      let errorMessage: string | undefined;

      try {
        const runner = this.runnerFactory(provider.reviewer);
        regressionSummary = await runner.runAll();
        metrics = this.metricsService.calculate(regressionSummary);
      } catch (e: unknown) {
        errorMessage = e instanceof Error ? e.message : String(e);
        regressionSummary = emptyRegressionSummary();
        metrics = this.metricsService.calculate(regressionSummary);
      }

      const durationMs = Math.max(0, Date.now() - startMs);

      const result: ProviderBenchmarkResult = {
        providerId: provider.id,
        providerLabel: provider.label,
        regressionSummary,
        metrics,
        durationMs,
      };
      if (errorMessage !== undefined) result.error = errorMessage;
      results.push(result);
    }

    const ranking = buildRanking(results);

    return {
      totalProviders: providers.length,
      successfulProviders: results.filter((r) => r.error === undefined).length,
      failedProviders: results.filter((r) => r.error !== undefined).length,
      results,
      ranking,
      bestProvider: ranking[0],
    };
  }
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

function buildRanking(results: ProviderBenchmarkResult[]): ProviderBenchmarkRankingEntry[] {
  const entries: ProviderBenchmarkRankingEntry[] = results
    .filter((r) => r.error === undefined)
    .map((r) => ({
      providerId: r.providerId,
      providerLabel: r.providerLabel,
      findingF1: r.metrics.findingF1,
      findingPrecision: r.metrics.findingPrecision,
      findingRecall: r.metrics.findingRecall,
      casePassRate: r.metrics.casePassRate,
      scorePassRate: r.metrics.scorePassRate,
      falsePositiveCount: r.metrics.falsePositiveCount,
      falseNegativeCount: r.metrics.falseNegativeCount,
      compositeScore: computeCompositeScore(r.metrics),
    }));

  return entries.sort((a, b) => b.compositeScore - a.compositeScore);
}

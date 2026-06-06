/**
 * FASE 9.0.8 — Tipos do Provider Benchmark
 *
 * Regras de design:
 * - Sem lógica executável — apenas tipos.
 * - ReviewerLike é re-exportado para evitar import circular nos testes.
 * - RunnerFactory permite injeção de mock runner nos testes unitários,
 *   desacoplando o benchmark de chamadas de API reais.
 */

import type { ReviewerLike, GoldCorpusRegressionSummary } from "./gold-corpus-regression.types.js";
import type { GoldCorpusMetrics } from "./gold-corpus-metrics.types.js";

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface BenchmarkProvider {
  id: string;
  label: string;
  reviewer: ReviewerLike;
}

// ─── Runner factory (injetável para testes) ───────────────────────────────────

export type RunnerFactory = (reviewer: ReviewerLike) => {
  runAll(): Promise<GoldCorpusRegressionSummary>;
};

// ─── Resultado por provider ───────────────────────────────────────────────────

export interface ProviderBenchmarkResult {
  providerId: string;
  providerLabel: string;
  regressionSummary: GoldCorpusRegressionSummary;
  metrics: GoldCorpusMetrics;
  durationMs: number;
  error?: string;
}

// ─── Entrada do ranking ───────────────────────────────────────────────────────

export interface ProviderBenchmarkRankingEntry {
  providerId: string;
  providerLabel: string;

  findingF1: number;
  findingPrecision: number;
  findingRecall: number;

  casePassRate: number;
  scorePassRate: number;

  falsePositiveCount: number;
  falseNegativeCount: number;

  /** F1×0.40 + Precision×0.25 + Recall×0.20 + casePassRate×0.10 + scorePassRate×0.05 */
  compositeScore: number;
}

// ─── Sumário do benchmark ─────────────────────────────────────────────────────

export interface ProviderBenchmarkSummary {
  totalProviders: number;
  successfulProviders: number;
  failedProviders: number;

  results: ProviderBenchmarkResult[];

  /** Ordenado por compositeScore decrescente. Inclui apenas providers bem-sucedidos. */
  ranking: ProviderBenchmarkRankingEntry[];

  /** Primeiro colocado do ranking. undefined se ranking vazio. */
  bestProvider?: ProviderBenchmarkRankingEntry;
}

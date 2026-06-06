/**
 * FASE 9.0.8.1 — Configuração Padrão do Live Benchmark
 *
 * Limites de custo baseados nos saldos atuais com margem de segurança:
 *   OpenAI:   saldo $10.27 → limite $8.00
 *   DeepSeek: saldo $6.06  → limite $5.00
 *   Gemini:   saldo ~R$40  → limite $6.00 (estimativa conservadora)
 *
 * Defaults seguros: enabled=false, dryRun=true, maxDocuments=5.
 */

import type { LiveBenchmarkConfig } from "./live-provider.types.js";

export const DEFAULT_LIVE_BENCHMARK_CONFIG: Readonly<LiveBenchmarkConfig> = {
  enabled: false,
  dryRun: true,

  providers: ["openai", "gemini", "deepseek"],

  maxDocumentsPerProvider: 5,

  costLimits: {
    openai: { maxUsd: 8.00 },
    gemini: { maxUsd: 6.00 },
    deepseek: { maxUsd: 5.00 },
  },

  modelByProvider: {
    openai: "gpt-4o",
    gemini: "gemini-2.5-pro",
    deepseek: "deepseek-reasoner",
  },

  maxInputTokensPerDocument: 12_000,
  maxOutputTokensPerDocument: 2_000,

  persistRawResponses: false,
  resume: true,
};

/** Configuração para dry-run completo do corpus (100 documentos, sem custo real). */
export const FULL_DRY_RUN_CONFIG: Readonly<LiveBenchmarkConfig> = {
  ...DEFAULT_LIVE_BENCHMARK_CONFIG,
  enabled: false,
  dryRun: true,
  maxDocumentsPerProvider: 100,
};

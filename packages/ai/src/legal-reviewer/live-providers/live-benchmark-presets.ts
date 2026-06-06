/**
 * FASE 9.0.8.2 — Preset Pilot 20 Cases
 *
 * Seleção de 20 casos representativos do Gold Corpus V1 para o benchmark piloto:
 * boas peças, peças com falhas moderadas e severas, múltiplos domínios e tipos.
 *
 * Env overrides (lidas no momento da importação do módulo):
 *   OPENAI_BENCHMARK_MODEL   — modelo OpenAI (padrão: gpt-5.4)
 *   GEMINI_BENCHMARK_MODEL   — modelo Gemini (padrão: gemini-2.5-pro)
 *   DEEPSEEK_BENCHMARK_MODEL — modelo DeepSeek (padrão: deepseek-reasoner)
 */

import type { LiveBenchmarkConfig, LiveProviderId } from "./live-provider.types.js";

// ─── Lista de casos ────────────────────────────────────────────────────────────

export const LIVE_BENCHMARK_PILOT_20_CASE_IDS: ReadonlyArray<string> = [
  // RGPS — Regime Geral de Previdência Social
  "RGPS-002",
  "RGPS-003",
  "RGPS-008",
  "RGPS-015",
  // Tributário
  "TRIB-002",
  "TRIB-004",
  "TRIB-007",
  // Família
  "FAM-001",
  "FAM-004",
  "FAM-007",
  // Consumidor
  "CONS-001",
  "CONS-006",
  "CONS-008",
  // Criminal
  "CRIM-002",
  "CRIM-005",
  "CRIM-007",
  // Fazenda Pública
  "FAZ-002",
  "FAZ-004",
  // Cível Geral
  "CIV-007",
  // Juizado Especial
  "JEC-002",
];

// ─── Resolução de modelos com override por env ─────────────────────────────────

/**
 * Retorna o mapa de modelos por provider, respeitando env vars de override.
 * Aceita env como parâmetro para facilitar testes sem efeitos colaterais.
 */
export function buildModelByProvider(
  env: Partial<Record<string, string>> = process.env,
): Record<LiveProviderId, string> {
  return {
    openai: env["OPENAI_BENCHMARK_MODEL"] ?? "gpt-5.4",
    gemini: env["GEMINI_BENCHMARK_MODEL"] ?? "gemini-2.5-pro",
    deepseek: env["DEEPSEEK_BENCHMARK_MODEL"] ?? "deepseek-reasoner",
  };
}

// ─── Configuração do piloto ────────────────────────────────────────────────────

export const LIVE_BENCHMARK_PILOT_20_CONFIG: Partial<LiveBenchmarkConfig> = {
  enabled: true,
  dryRun: false,

  providers: ["openai", "gemini", "deepseek"],
  maxDocumentsPerProvider: 20,
  includeCaseIds: LIVE_BENCHMARK_PILOT_20_CASE_IDS as string[],

  costLimits: {
    openai: { maxUsd: 3.00 },
    gemini: { maxUsd: 3.00 },
    deepseek: { maxUsd: 2.00 },
  },

  modelByProvider: buildModelByProvider(),

  maxInputTokensPerDocument: 18_000,
  maxOutputTokensPerDocument: 4_000,

  persistRawResponses: true,
  resume: true,
};

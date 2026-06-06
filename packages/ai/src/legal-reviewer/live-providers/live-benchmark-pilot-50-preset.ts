/**
 * FASE 9.0.8.2A — Preset Pilot 50
 *
 * 50 casos do Gold Corpus V1 × 3 providers = 150 análises reais.
 * Distribui cobertura por todos os 11 domínios jurídicos.
 *
 * Os 20 casos do Pilot 20 são um subconjunto deste preset.
 */

import { DEFAULT_LIVE_BENCHMARK_CONFIG } from "./live-benchmark-config.js";
import { buildModelByProvider } from "./live-benchmark-presets.js";
import type { LiveBenchmarkConfig, LiveProviderId } from "./live-provider.types.js";

// ─── IDs selecionados ─────────────────────────────────────────────────────────

export const LIVE_BENCHMARK_PILOT_50_CASE_IDS: ReadonlyArray<string> = [
  // RGPS — 10 casos (de 15 disponíveis)
  "RGPS-001", "RGPS-002", "RGPS-003", "RGPS-004", "RGPS-005",
  "RGPS-006", "RGPS-008", "RGPS-009", "RGPS-010", "RGPS-015",

  // RPPS — 4 casos (de 5 disponíveis)
  "RPPS-001", "RPPS-002", "RPPS-003", "RPPS-004",

  // TRABALHISTA — 5 casos (de 10 disponíveis)
  "TRAB-001", "TRAB-002", "TRAB-003", "TRAB-004", "TRAB-005",

  // TRIBUTARIO — 5 casos (de 10 disponíveis)
  "TRIB-001", "TRIB-002", "TRIB-003", "TRIB-004", "TRIB-007",

  // FAMILIA — 5 casos (de 10 disponíveis)
  "FAM-001", "FAM-002", "FAM-003", "FAM-004", "FAM-007",

  // CONSUMIDOR — 5 casos (de 10 disponíveis)
  "CONS-001", "CONS-002", "CONS-003", "CONS-006", "CONS-008",

  // CRIMINAL — 5 casos (de 10 disponíveis)
  "CRIM-001", "CRIM-002", "CRIM-003", "CRIM-005", "CRIM-007",

  // FAZENDA_PUBLICA — 4 casos (de 10 disponíveis)
  "FAZ-001", "FAZ-002", "FAZ-003", "FAZ-004",

  // AMBIENTAL — 2 casos (de 5 disponíveis)
  "AMB-001", "AMB-002",

  // CIVEL — 3 casos (de 10 disponíveis)
  "CIV-001", "CIV-002", "CIV-007",

  // JUIZADO_ESPECIAL — 2 casos (de 5 disponíveis)
  "JEC-001", "JEC-002",
];

// ─── Configuração ─────────────────────────────────────────────────────────────

export const LIVE_BENCHMARK_PILOT_50_CONFIG: LiveBenchmarkConfig = {
  ...DEFAULT_LIVE_BENCHMARK_CONFIG,
  enabled: true,
  dryRun: false,
  providers: ["openai", "gemini", "deepseek"] as LiveProviderId[],
  maxDocumentsPerProvider: 50,
  includeCaseIds: LIVE_BENCHMARK_PILOT_50_CASE_IDS as string[],
  costLimits: {
    openai:    { maxUsd: 7.50 },
    gemini:    { maxUsd: 7.50 },
    deepseek:  { maxUsd: 5.00 },
  },
  modelByProvider: buildModelByProvider(),
  maxInputTokensPerDocument: 18_000,
  maxOutputTokensPerDocument: 4_000,
  persistRawResponses: true,
  resume: true,
};

/**
 * FASE 9.0.8.1 — Cost Guard do Live Benchmark
 *
 * Protege contra consumo acidental de créditos durante execução do benchmark.
 *
 * Regras:
 * 1. Bloqueia provider se custo acumulado + estimativa exceder maxUsd.
 * 2. Bloqueia se inputTokens estimado exceder maxInputTokensPerDocument.
 * 3. Bloqueia se outputTokens solicitado exceder maxOutputTokensPerDocument.
 * 4. Em dryRun, calcula estimativas sem chamar API.
 * 5. Nunca permite live run se enabled !== true.
 * 6. Nunca permite live run se LIVE_BENCHMARK_ENABLED !== "true".
 * 7. Chaves ausentes geram erro claro, sem imprimir a chave.
 * 8. Custo estimado é conservador (acima do preço real publicado).
 */

import type { LiveBenchmarkConfig, LiveBenchmarkRunState, LiveProviderId } from "./live-provider.types.js";

// ─── Tabela de custo conservadora (USD por 1 000 tokens) ──────────────────────
// Usar valores acima dos preços publicados para margem de segurança.

const COST_PER_1K: Record<LiveProviderId, { input: number; output: number }> = {
  openai: { input: 0.010, output: 0.030 },   // GPT-4o+: ~$0.0025/$0.010 real → 4x margem
  gemini: { input: 0.005, output: 0.015 },   // Gemini 2.5: ~$0.00125/$0.010 real → 4x margem
  deepseek: { input: 0.001, output: 0.003 }, // DeepSeek R1: ~$0.00055/$0.00219 real → 2x margem
};

export class LiveBenchmarkCostGuardService {

  // ─── Estimativa de tokens de entrada ───────────────────────────────────────

  estimateInputTokens(text: string): number {
    // ~3.5 caracteres por token (estimativa conservadora — real ≈ 4 chars/token)
    return Math.ceil(text.length / 3.5);
  }

  // ─── Estimativa de custo ────────────────────────────────────────────────────

  estimateCost(
    providerId: LiveProviderId,
    _model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const rates = COST_PER_1K[providerId];
    if (!rates) return 0;
    const cost = (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
    if (!isFinite(cost) || isNaN(cost)) return 0;
    return cost;
  }

  // ─── Verificação sem exceção ────────────────────────────────────────────────

  canRunProviderDocument(
    providerId: LiveProviderId,
    estimatedNextCostUsd: number,
    currentState: LiveBenchmarkRunState,
    config: LiveBenchmarkConfig,
    estimatedInputTokens?: number,
    requestedOutputTokens?: number,
  ): boolean {
    if (!config.enabled) return false;
    if (process.env["LIVE_BENCHMARK_ENABLED"] !== "true") return false;

    // Token limits (0 = sem limite)
    if (
      estimatedInputTokens !== undefined &&
      config.maxInputTokensPerDocument > 0 &&
      estimatedInputTokens > config.maxInputTokensPerDocument
    ) {
      return false;
    }
    if (
      requestedOutputTokens !== undefined &&
      config.maxOutputTokensPerDocument > 0 &&
      requestedOutputTokens > config.maxOutputTokensPerDocument
    ) {
      return false;
    }

    // Custo acumulado
    const limit = config.costLimits[providerId]?.maxUsd ?? 0;
    const accumulated = currentState.totalsByProvider[providerId]?.estimatedCostUsd ?? 0;
    if (accumulated + estimatedNextCostUsd > limit) return false;

    return true;
  }

  // ─── Verificação com exceção ────────────────────────────────────────────────

  assertCanRunProviderDocument(
    providerId: LiveProviderId,
    estimatedNextCostUsd: number,
    currentState: LiveBenchmarkRunState,
    config: LiveBenchmarkConfig,
    estimatedInputTokens?: number,
    requestedOutputTokens?: number,
  ): void {
    if (!config.enabled) {
      throw new Error(`Live benchmark desabilitado: config.enabled deve ser true para execução real`);
    }
    if (process.env["LIVE_BENCHMARK_ENABLED"] !== "true") {
      throw new Error(`Live benchmark requer variável de ambiente LIVE_BENCHMARK_ENABLED=true`);
    }

    if (
      estimatedInputTokens !== undefined &&
      config.maxInputTokensPerDocument > 0 &&
      estimatedInputTokens > config.maxInputTokensPerDocument
    ) {
      throw new Error(
        `Documento excede limite de ${config.maxInputTokensPerDocument} tokens de entrada ` +
        `(estimado: ${estimatedInputTokens})`,
      );
    }
    if (
      requestedOutputTokens !== undefined &&
      config.maxOutputTokensPerDocument > 0 &&
      requestedOutputTokens > config.maxOutputTokensPerDocument
    ) {
      throw new Error(
        `Tokens de saída solicitados (${requestedOutputTokens}) excedem limite de ` +
        `${config.maxOutputTokensPerDocument}`,
      );
    }

    const limit = config.costLimits[providerId]?.maxUsd ?? 0;
    const accumulated = currentState.totalsByProvider[providerId]?.estimatedCostUsd ?? 0;
    if (accumulated + estimatedNextCostUsd > limit) {
      throw new Error(
        `Limite de custo excedido para provider ${providerId}: ` +
        `acumulado $${accumulated.toFixed(4)} + próximo $${estimatedNextCostUsd.toFixed(4)} ` +
        `> limite $${limit.toFixed(2)}`,
      );
    }
  }
}

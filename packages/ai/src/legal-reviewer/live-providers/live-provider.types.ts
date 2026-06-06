/**
 * FASE 9.0.8.1 — Tipos do Live Provider Benchmark
 *
 * Regras de design:
 * - Sem lógica executável — apenas tipos.
 * - totalsByProvider usa Record<LiveProviderId, ...> para garantir tipagem
 *   exaustiva nos três providers alvo.
 * - LiveBenchmarkConfig é imutável em runtime — nunca modificado pelo runner.
 */

export type LiveProviderId = "openai" | "gemini" | "deepseek";

// ─── Configuração ─────────────────────────────────────────────────────────────

export interface LiveBenchmarkConfig {
  /** Habilita execução real. false = bloqueia live mode. */
  enabled: boolean;

  /** Se true, simula execução sem chamar APIs. */
  dryRun: boolean;

  /** Providers a executar. */
  providers: LiveProviderId[];

  /** Número máximo de documentos por provider. */
  maxDocumentsPerProvider: number;

  /** Filtro por domínios (undefined = todos). */
  includeDomains?: string[];

  /** Filtro por caseIds específicos (undefined = todos). */
  includeCaseIds?: string[];

  /** Limite de custo USD por provider. */
  costLimits: Record<LiveProviderId, { maxUsd: number }>;

  /** Modelo a usar por provider. */
  modelByProvider: Record<LiveProviderId, string>;

  /** Máximo de tokens de entrada por documento. 0 = sem limite. */
  maxInputTokensPerDocument: number;

  /** Máximo de tokens de saída por documento. */
  maxOutputTokensPerDocument: number;

  /** Se true, preserva resposta bruta do provider no resultado. */
  persistRawResponses: boolean;

  /** Se true, ignora documentos já processados em execuções anteriores. */
  resume: boolean;
}

// ─── Uso de tokens e custo ────────────────────────────────────────────────────

export interface LiveProviderUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

// ─── Resultado por documento/provider ────────────────────────────────────────

export interface LiveProviderReviewResult {
  providerId: LiveProviderId;
  model: string;
  caseId: string;
  domain: string;

  /** Resultado normalizado do reviewer (AiLegalStrengthReviewResult ou similar). */
  review: unknown;

  /** Resposta bruta — presente apenas quando persistRawResponses=true. */
  rawResponse?: unknown;

  usage: LiveProviderUsage;
  durationMs: number;

  /** Mensagem de erro se a chamada falhou. Nunca inclui chaves de API. */
  error?: string;
}

// ─── Estado da execução ───────────────────────────────────────────────────────

export interface LiveBenchmarkRunState {
  runId: string;
  startedAt: string;
  completedAt?: string;

  config: LiveBenchmarkConfig;

  results: LiveProviderReviewResult[];

  totalsByProvider: Record<
    LiveProviderId,
    {
      documentsCompleted: number;
      documentsFailed: number;
      estimatedCostUsd: number;
      inputTokens: number;
      outputTokens: number;
    }
  >;
}

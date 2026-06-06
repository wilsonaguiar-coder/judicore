/**
 * FASE 9.0.8.1 — Runner do Live Benchmark
 *
 * Orquestra a execução dos documentos do Gold Corpus contra providers reais.
 *
 * Regras de design:
 * - Nunca chama APIs reais em dryRun (simula resultados sem custo).
 * - Bloqueia live mode se config.enabled=false ou LIVE_BENCHMARK_ENABLED!="true".
 * - Isola erros por documento — falha individual não aborta o run.
 * - Persiste estado após cada documento (permite resume em caso de crash).
 * - Resume: pula documentos já presentes no estado carregado.
 * - Chaves de API nunca aparecem em mensagens de erro.
 */

import { goldCorpusGeneratedDocuments } from "../gold-corpus/gold-corpus-generated-documents.js";
import type { GeneratedGoldCorpusDocument } from "../gold-corpus/gold-corpus-document-generator.service.js";
import type { ReviewerLike } from "../gold-corpus/gold-corpus-regression.types.js";
import type { AiLegalStrengthReviewRequest } from "../dto/ai-legal-strength-review-request.js";
import type { IntegratedAuditResponse } from "../../audit/audit.service.js";
import { LiveBenchmarkCostGuardService } from "./live-benchmark-cost-guard.service.js";
import { LiveBenchmarkStorageService } from "./live-benchmark-storage.service.js";
import type {
  LiveBenchmarkConfig,
  LiveBenchmarkRunState,
  LiveProviderReviewResult,
  LiveProviderId,
} from "./live-provider.types.js";

// ─── Utilitários de request ────────────────────────────────────────────────────

function buildMinimalAudit(doc: GeneratedGoldCorpusDocument): IntegratedAuditResponse {
  return {
    pieceId: doc.caseId,
    audit: {
      status: "APROVADA",
      score: 100,
      classification: doc.documentType,
      fatalErrors: [],
      nonFatalErrors: [],
      strengths: [],
    },
  };
}

function buildReviewRequest(doc: GeneratedGoldCorpusDocument): AiLegalStrengthReviewRequest {
  return {
    draft: doc.text,
    classification: doc.documentType,
    domain: doc.domain,
    pieceType: doc.documentType,
    audit: buildMinimalAudit(doc),
  };
}

function generateRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class LiveBenchmarkRunnerService {
  constructor(
    private readonly costGuard: LiveBenchmarkCostGuardService,
    private readonly storage: LiveBenchmarkStorageService,
    private readonly providerReviewers: Partial<Record<LiveProviderId, ReviewerLike>>,
  ) {}

  /**
   * Executa o benchmark contra o Gold Corpus para cada provider configurado.
   * @param config — configuração do run (imutável durante execução).
   * @param runId  — ID do run; se fornecido com resume=true, retoma run anterior.
   */
  async run(config: LiveBenchmarkConfig, runId?: string): Promise<LiveBenchmarkRunState> {
    if (!config.dryRun) {
      if (!config.enabled) {
        throw new Error(
          "Live benchmark desabilitado: config.enabled deve ser true para execução real",
        );
      }
      if (process.env["LIVE_BENCHMARK_ENABLED"] !== "true") {
        throw new Error(
          "Live benchmark requer variável de ambiente LIVE_BENCHMARK_ENABLED=true",
        );
      }
    }

    const resolvedRunId = runId ?? generateRunId();
    let state: LiveBenchmarkRunState;

    if (config.resume && runId) {
      const existing = await this.storage.loadState(resolvedRunId);
      state = existing ?? this.storage.createRun(resolvedRunId, config);
    } else {
      state = this.storage.createRun(resolvedRunId, config);
    }

    // ── Filtrar documentos ────────────────────────────────────────────────────

    let documents = goldCorpusGeneratedDocuments as GeneratedGoldCorpusDocument[];

    if (config.includeDomains) {
      const domains = config.includeDomains;
      documents = documents.filter((d) => domains.includes(d.domain));
    }
    if (config.includeCaseIds) {
      const ids = config.includeCaseIds;
      documents = documents.filter((d) => ids.includes(d.caseId));
    }

    // ── Loop por provider ─────────────────────────────────────────────────────

    for (const providerId of config.providers) {
      const reviewer = this.providerReviewers[providerId];
      if (!reviewer) continue;

      const model = config.modelByProvider[providerId] ?? providerId;
      let count = 0;

      for (const doc of documents) {
        if (count >= config.maxDocumentsPerProvider) break;
        count++;

        if (config.resume && this.storage.hasResult(state, providerId, doc.caseId)) {
          continue;
        }

        const result = config.dryRun
          ? this.buildDryRunResult(providerId, model, doc)
          : await this.runLiveDocument(providerId, model, reviewer, config, state, doc);

        state = this.storage.appendResult(state, result);
        await this.storage.saveState(state);
      }
    }

    state = { ...state, completedAt: new Date().toISOString() };
    await this.storage.saveState(state);
    return state;
  }

  // ─── Dry-run: resultado simulado sem custo ─────────────────────────────────

  private buildDryRunResult(
    providerId: LiveProviderId,
    model: string,
    doc: GeneratedGoldCorpusDocument,
  ): LiveProviderReviewResult {
    const estimatedInputTokens = this.costGuard.estimateInputTokens(doc.text);
    return {
      providerId,
      model,
      caseId: doc.caseId,
      domain: doc.domain,
      review: null,
      usage: {
        inputTokens: estimatedInputTokens,
        outputTokens: 0,
        totalTokens: estimatedInputTokens,
        estimatedCostUsd: 0,
      },
      durationMs: 0,
    };
  }

  // ─── Live: chama reviewer real com cost guard ──────────────────────────────

  private async runLiveDocument(
    providerId: LiveProviderId,
    model: string,
    reviewer: ReviewerLike,
    config: LiveBenchmarkConfig,
    state: LiveBenchmarkRunState,
    doc: GeneratedGoldCorpusDocument,
  ): Promise<LiveProviderReviewResult> {
    const estimatedInputTokens = this.costGuard.estimateInputTokens(doc.text);
    const estimatedCost = this.costGuard.estimateCost(
      providerId,
      model,
      estimatedInputTokens,
      config.maxOutputTokensPerDocument,
    );

    if (
      !this.costGuard.canRunProviderDocument(
        providerId,
        estimatedCost,
        state,
        config,
        estimatedInputTokens,
        config.maxOutputTokensPerDocument,
      )
    ) {
      return {
        providerId,
        model,
        caseId: doc.caseId,
        domain: doc.domain,
        review: null,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
        },
        durationMs: 0,
        error: `Limite de custo ou tokens excedido para provider ${providerId}`,
      };
    }

    const request = buildReviewRequest(doc);
    const startTime = Date.now();

    try {
      const reviewResult = await reviewer.review(request);
      const durationMs = Date.now() - startTime;
      const estimatedOutputTokens = config.maxOutputTokensPerDocument;
      const actualCost = this.costGuard.estimateCost(
        providerId,
        model,
        estimatedInputTokens,
        estimatedOutputTokens,
      );

      return {
        providerId,
        model,
        caseId: doc.caseId,
        domain: doc.domain,
        review: reviewResult,
        ...(config.persistRawResponses ? { rawResponse: reviewResult } : {}),
        usage: {
          inputTokens: estimatedInputTokens,
          outputTokens: estimatedOutputTokens,
          totalTokens: estimatedInputTokens + estimatedOutputTokens,
          estimatedCostUsd: actualCost,
        },
        durationMs,
      };
    } catch (error) {
      return {
        providerId,
        model,
        caseId: doc.caseId,
        domain: doc.domain,
        review: null,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
        },
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

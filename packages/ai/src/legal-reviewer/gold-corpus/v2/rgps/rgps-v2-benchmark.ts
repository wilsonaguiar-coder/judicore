/**
 * FASE 9.0.8.12 — RGPS V2 Live Benchmark Runner
 *
 * Executa os 15 casos RGPS V2 contra GPT, Gemini e DeepSeek.
 * Usa os serviços existentes (cost guard, storage, resume) sem alterar o benchmark V1.
 *
 * Execução:
 *   LIVE_BENCHMARK_ENABLED=true \
 *   OPENAI_API_KEY=... GEMINI_API_KEY=... DEEPSEEK_API_KEY=... \
 *   node --import tsx/esm src/legal-reviewer/gold-corpus/v2/rgps/rgps-v2-benchmark.ts
 */

import { generateAllRgpsDocumentsV2 } from "./rgps-generator-v2.js";
import { LiveBenchmarkCostGuardService } from "../../../live-providers/live-benchmark-cost-guard.service.js";
import { LiveBenchmarkStorageService } from "../../../live-providers/live-benchmark-storage.service.js";
import { createOpenAIReviewer } from "../../../live-providers/openai-reviewer.provider.js";
import { createGeminiReviewer } from "../../../live-providers/gemini-reviewer.provider.js";
import { createDeepSeekReviewer } from "../../../live-providers/deepseek-reviewer.provider.js";
import type { ReviewerLike } from "../../gold-corpus-regression.types.js";
import type {
  LiveBenchmarkConfig,
  LiveProviderReviewResult,
  LiveProviderId,
  LiveBenchmarkRunState,
} from "../../../live-providers/live-provider.types.js";
import type { GeneratedRgpsDocumentV2 } from "./rgps-scenario.types.js";

// ─── Configuração ─────────────────────────────────────────────────────────────

const RGPS_V2_CONFIG: LiveBenchmarkConfig = {
  enabled: true,
  dryRun: false,
  providers: ["openai", "gemini", "deepseek"],
  maxDocumentsPerProvider: 15,
  costLimits: {
    openai:   { maxUsd: 4.00 },
    gemini:   { maxUsd: 4.00 },
    deepseek: { maxUsd: 2.00 },
  },
  modelByProvider: {
    openai:   "gpt-4o",
    gemini:   "gemini-2.5-pro",
    deepseek: "deepseek-reasoner",
  },
  maxInputTokensPerDocument: 16_000,
  maxOutputTokensPerDocument: 8_192,
  persistRawResponses: false,
  resume: true,
};

// ─── Build review request a partir de doc V2 ─────────────────────────────────

function buildRequest(doc: GeneratedRgpsDocumentV2): unknown {
  return {
    draft: doc.text,
    classification: doc.documentType,
    domain: doc.domain,
    pieceType: doc.documentType,
    audit: {
      pieceId: doc.caseId,
      audit: {
        status: "APROVADA",
        score: 100,
        classification: doc.documentType,
        fatalErrors: [],
        nonFatalErrors: [],
        strengths: [],
      },
    },
  };
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  if (process.env["LIVE_BENCHMARK_ENABLED"] !== "true") {
    throw new Error("Defina LIVE_BENCHMARK_ENABLED=true para executar o benchmark real.");
  }

  const docs = generateAllRgpsDocumentsV2();
  console.log(`\nRGPS V2 Benchmark — ${docs.length} documentos × 3 providers = ${docs.length * 3} análises`);
  console.log(`RunId: ${getRunId()}\n`);

  const costGuard = new LiveBenchmarkCostGuardService();
  const storage   = new LiveBenchmarkStorageService();
  const runId     = getRunId();

  let state: LiveBenchmarkRunState = storage.createRun(runId, RGPS_V2_CONFIG);
  const existing = RGPS_V2_CONFIG.resume ? await storage.loadState(runId) : null;
  if (existing) {
    state = existing;
    console.log(`Resume: carregado estado existente (${existing.results.length} resultados)`);
  }

  const providers: Record<LiveProviderId, ReviewerLike> = {
    openai:   createOpenAIReviewer(),
    gemini:   createGeminiReviewer(process.env["GEMINI_API_KEY"]),
    deepseek: createDeepSeekReviewer(),
  };

  for (const providerId of RGPS_V2_CONFIG.providers) {
    const reviewer = providers[providerId];
    const model    = RGPS_V2_CONFIG.modelByProvider[providerId];
    console.log(`\n── ${providerId.toUpperCase()} (${model}) ──`);

    let count = 0;
    for (const doc of docs) {
      if (count >= RGPS_V2_CONFIG.maxDocumentsPerProvider) break;
      count++;

      if (storage.hasResult(state, providerId, doc.caseId)) {
        console.log(`  SKIP ${doc.caseId} (já processado)`);
        continue;
      }

      const result = await runDocument(providerId, model, reviewer, doc, state, costGuard);
      state = storage.appendResult(state, result);
      await storage.saveState(state);

      const findingsCount = (result.review as { findings?: unknown[] } | null)?.findings?.length ?? 0;
      const status = result.error ? `ERRO: ${result.error}` : `${findingsCount} findings (${result.durationMs}ms)`;
      console.log(`  ${doc.caseId} [${doc.quality}] — ${status}`);
    }
  }

  state = { ...state, completedAt: new Date().toISOString() };
  await storage.saveState(state);

  console.log("\n\nBenchmark concluído.");
  console.log(`Arquivo: .benchmark-runs/live-benchmark-${runId}.json`);
  printTotals(state);
}

async function runDocument(
  providerId: LiveProviderId,
  model: string,
  reviewer: ReviewerLike,
  doc: GeneratedRgpsDocumentV2,
  state: LiveBenchmarkRunState,
  costGuard: LiveBenchmarkCostGuardService,
): Promise<LiveProviderReviewResult> {
  const estimatedInputTokens = costGuard.estimateInputTokens(doc.text);
  const estimatedCost = costGuard.estimateCost(
    providerId, model, estimatedInputTokens, RGPS_V2_CONFIG.maxOutputTokensPerDocument,
  );

  if (!costGuard.canRunProviderDocument(
    providerId, estimatedCost, state, RGPS_V2_CONFIG,
    estimatedInputTokens, RGPS_V2_CONFIG.maxOutputTokensPerDocument,
  )) {
    return {
      providerId, model, caseId: doc.caseId, domain: doc.domain,
      review: null,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
      durationMs: 0,
      error: `Limite de custo excedido para ${providerId}`,
    };
  }

  const request = buildRequest(doc);
  const t0 = Date.now();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviewResult = await reviewer.review(request as any);
    const durationMs   = Date.now() - t0;
    const actualCost   = costGuard.estimateCost(
      providerId, model, estimatedInputTokens, RGPS_V2_CONFIG.maxOutputTokensPerDocument,
    );
    return {
      providerId, model, caseId: doc.caseId, domain: doc.domain,
      review: reviewResult,
      usage: {
        inputTokens: estimatedInputTokens,
        outputTokens: RGPS_V2_CONFIG.maxOutputTokensPerDocument,
        totalTokens: estimatedInputTokens + RGPS_V2_CONFIG.maxOutputTokensPerDocument,
        estimatedCostUsd: actualCost,
      },
      durationMs,
    };
  } catch (err) {
    return {
      providerId, model, caseId: doc.caseId, domain: doc.domain,
      review: null,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
      durationMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function printTotals(state: LiveBenchmarkRunState): void {
  console.log("\nTotais por provider:");
  for (const [pid, totals] of Object.entries(state.totalsByProvider)) {
    console.log(
      `  ${pid.padEnd(10)} — docs: ${totals.documentsCompleted}/${totals.documentsCompleted + totals.documentsFailed}` +
      ` | custo estimado: $${totals.estimatedCostUsd.toFixed(4)}` +
      ` | tokens in: ${totals.inputTokens} out: ${totals.outputTokens}`,
    );
  }
}

// ─── RunId determinístico por dia (permite resume em caso de crash) ──────────

function getRunId(): string {
  return `rgps-v2-${new Date().toISOString().slice(0, 10)}`;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

run().catch((err) => {
  console.error("Erro fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});

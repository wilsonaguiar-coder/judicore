/**
 * FASE 9.0.8.1 — Storage do Live Benchmark
 *
 * Persiste o estado da execução em JSON local.
 * Diretório padrão: packages/ai/.benchmark-runs/
 *
 * Métodos:
 * - createRun()     — inicializa estado (síncrono, pura computação)
 * - saveState()     — persiste estado em disco (assíncrono)
 * - loadState()     — lê estado do disco (assíncrono)
 * - appendResult()  — adiciona resultado e atualiza totais (síncrono)
 * - hasResult()     — verifica se caseId/provider já tem resultado (síncrono)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  LiveBenchmarkConfig,
  LiveBenchmarkRunState,
  LiveProviderReviewResult,
  LiveProviderId,
} from "./live-provider.types.js";

const DEFAULT_BASE_DIR = path.resolve(
  new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
  "../../../../../.benchmark-runs",
);

// ─── Totais iniciais por provider ─────────────────────────────────────────────

function emptyTotals() {
  return {
    documentsCompleted: 0,
    documentsFailed: 0,
    estimatedCostUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class LiveBenchmarkStorageService {
  constructor(private readonly baseDir: string = DEFAULT_BASE_DIR) {}

  // ─── Criação de run state ───────────────────────────────────────────────────

  createRun(runId: string, config: LiveBenchmarkConfig): LiveBenchmarkRunState {
    return {
      runId,
      startedAt: new Date().toISOString(),
      config,
      results: [],
      totalsByProvider: {
        openai: emptyTotals(),
        gemini: emptyTotals(),
        deepseek: emptyTotals(),
      },
    };
  }

  // ─── Persistência em disco ─────────────────────────────────────────────────

  async saveState(state: LiveBenchmarkRunState): Promise<void> {
    fs.mkdirSync(this.baseDir, { recursive: true });
    const filePath = this.stateFilePath(state.runId);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
  }

  async loadState(runId: string): Promise<LiveBenchmarkRunState | null> {
    const filePath = this.stateFilePath(runId);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as LiveBenchmarkRunState;
  }

  // ─── Operações sobre o state (síncrono, sem I/O) ──────────────────────────

  appendResult(
    state: LiveBenchmarkRunState,
    result: LiveProviderReviewResult,
  ): LiveBenchmarkRunState {
    const updatedResults = [...state.results, result];
    const totals = { ...state.totalsByProvider };
    const pid = result.providerId;

    totals[pid] = {
      documentsCompleted: totals[pid].documentsCompleted + (result.error ? 0 : 1),
      documentsFailed: totals[pid].documentsFailed + (result.error ? 1 : 0),
      estimatedCostUsd: totals[pid].estimatedCostUsd + result.usage.estimatedCostUsd,
      inputTokens: totals[pid].inputTokens + result.usage.inputTokens,
      outputTokens: totals[pid].outputTokens + result.usage.outputTokens,
    };

    return { ...state, results: updatedResults, totalsByProvider: totals };
  }

  hasResult(
    state: LiveBenchmarkRunState,
    providerId: LiveProviderId,
    caseId: string,
  ): boolean {
    return state.results.some(
      (r) => r.providerId === providerId && r.caseId === caseId,
    );
  }

  // ─── Utilitário ────────────────────────────────────────────────────────────

  private stateFilePath(runId: string): string {
    return path.join(this.baseDir, `live-benchmark-${runId}.json`);
  }
}

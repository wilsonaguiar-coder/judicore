/**
 * FASE 9.0.8.2 — Script Live Benchmark Pilot 20
 *
 * Executa 20 peças do Gold Corpus V1 contra GPT, Gemini e DeepSeek.
 *
 * Uso:
 *   tsx scripts/run-live-benchmark-pilot-20.ts --dry-run   (sem custo real)
 *   LIVE_BENCHMARK_ENABLED=true tsx scripts/run-live-benchmark-pilot-20.ts
 *
 * Segurança:
 *   - Nenhuma chave de API é impressa no console.
 *   - Respostas brutas não são impressas (apenas métricas resumidas).
 *   - Estado é preservado para resume em caso de interrupção.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { LiveBenchmarkRunnerService } from "../src/legal-reviewer/live-providers/live-benchmark-runner.service.js";
import { LiveBenchmarkCostGuardService } from "../src/legal-reviewer/live-providers/live-benchmark-cost-guard.service.js";
import { LiveBenchmarkStorageService } from "../src/legal-reviewer/live-providers/live-benchmark-storage.service.js";
import { DEFAULT_LIVE_BENCHMARK_CONFIG } from "../src/legal-reviewer/live-providers/live-benchmark-config.js";
import {
  LIVE_BENCHMARK_PILOT_20_CONFIG,
} from "../src/legal-reviewer/live-providers/live-benchmark-presets.js";
import { createOpenAIReviewer } from "../src/legal-reviewer/live-providers/openai-reviewer.provider.js";
import { createGeminiReviewer } from "../src/legal-reviewer/live-providers/gemini-reviewer.provider.js";
import { createDeepSeekReviewer } from "../src/legal-reviewer/live-providers/deepseek-reviewer.provider.js";
import type { LiveBenchmarkConfig, LiveBenchmarkRunState, LiveProviderId } from "../src/legal-reviewer/live-providers/live-provider.types.js";
import type { ReviewerLike } from "../src/legal-reviewer/gold-corpus/gold-corpus-regression.types.js";

// ─── Env .env loader (sem dependência externa) ────────────────────────────────

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// Carrega .env local (se existir) sem sobrescrever vars já definidas no shell
loadEnvFile(path.resolve(process.cwd(), ".env"));

// ─── Flags de linha de comando ────────────────────────────────────────────────

const isDryRun = process.argv.includes("--dry-run");

// ─── Validação de ambiente ────────────────────────────────────────────────────

function validateLiveEnvironment(): void {
  if (process.env["LIVE_BENCHMARK_ENABLED"] !== "true") {
    console.error("ERRO: LIVE_BENCHMARK_ENABLED deve ser 'true' para execução real.");
    console.error("      Defina: export LIVE_BENCHMARK_ENABLED=true");
    console.error("      Ou use --dry-run para testar o fluxo sem custo.");
    process.exit(1);
  }

  const missing: string[] = [];
  if (!process.env["OPENAI_API_KEY"]) missing.push("OPENAI_API_KEY");
  if (!process.env["GEMINI_API_KEY"]) missing.push("GEMINI_API_KEY");
  if (!process.env["DEEPSEEK_API_KEY"]) missing.push("DEEPSEEK_API_KEY");

  if (missing.length > 0) {
    console.error(`ERRO: Variáveis de ambiente ausentes: ${missing.join(", ")}`);
    console.error("      Configure as chaves de API antes de executar.");
    process.exit(1);
  }
}

// ─── Reviewer de dry-run (nunca chamado pelo runner) ─────────────────────────

function createDryRunReviewer(): ReviewerLike {
  return {
    async review(): Promise<never> {
      throw new Error("[BUG] Reviewer chamado em modo dry-run — não deveria acontecer.");
    },
  };
}

// ─── Impressão do resumo ──────────────────────────────────────────────────────

function printSummary(
  state: LiveBenchmarkRunState,
  config: LiveBenchmarkConfig,
  runId: string,
): void {
  const separator = "══════════════════════════════════════════════";
  console.log(`\n${separator}`);
  console.log(isDryRun ? "RESUMO — DRY-RUN PILOT 20" : "RESUMO — LIVE BENCHMARK PILOT 20");
  console.log(separator);
  console.log(`Run ID:    ${runId}`);
  console.log(`Início:    ${state.startedAt}`);
  console.log(`Conclusão: ${state.completedAt ?? "em andamento"}`);
  console.log(`Modo:      ${isDryRun ? "DRY-RUN (sem custo real)" : "LIVE"}`);

  console.log("\nResultados por provider:");
  for (const pid of config.providers) {
    const t = state.totalsByProvider[pid as LiveProviderId];
    if (!t) continue;
    const model = config.modelByProvider[pid as LiveProviderId] ?? pid;
    console.log(`\n  ${pid.toUpperCase()} (${model})`);
    console.log(`    Concluídos:   ${t.documentsCompleted}`);
    console.log(`    Erros:        ${t.documentsFailed}`);
    if (!isDryRun) {
      console.log(`    Custo est.:   $${t.estimatedCostUsd.toFixed(4)}`);
      console.log(`    Tokens (in):  ${t.inputTokens}`);
      console.log(`    Tokens (out): ${t.outputTokens}`);
    }
  }

  console.log(`\nResultados salvos em: .benchmark-runs/live-benchmark-${runId}.json`);

  if (state.results.some((r) => r.error)) {
    const errCount = state.results.filter((r) => r.error).length;
    console.log(`\nATENÇÃO: ${errCount} documento(s) com erro — verifique o arquivo de resultados.`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const mode = isDryRun ? "DRY-RUN" : "LIVE";
  console.log("══════════════════════════════════════════════");
  console.log(`LIVE BENCHMARK PILOT 20 — ${mode}`);
  console.log("══════════════════════════════════════════════");

  if (!isDryRun) {
    validateLiveEnvironment();
  }

  // ── Montar configuração completa ──────────────────────────────────────────

  const config: LiveBenchmarkConfig = {
    ...DEFAULT_LIVE_BENCHMARK_CONFIG,
    ...LIVE_BENCHMARK_PILOT_20_CONFIG,
    ...(isDryRun ? { dryRun: true, enabled: false } : {}),
  };

  // ── Run ID ────────────────────────────────────────────────────────────────

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23);
  const runId = `pilot20-${timestamp}`;
  console.log(`\nRun ID: ${runId}`);
  console.log("(Guarde este ID para retomar em caso de interrupção com resume=true)");

  // ── Providers ─────────────────────────────────────────────────────────────

  const geminiModel = config.modelByProvider["gemini"] ?? "gemini-2.5-pro";

  const reviewers: Partial<Record<LiveProviderId, ReviewerLike>> = isDryRun
    ? {
        openai: createDryRunReviewer(),
        gemini: createDryRunReviewer(),
        deepseek: createDryRunReviewer(),
      }
    : {
        openai: createOpenAIReviewer(),
        gemini: createGeminiReviewer(undefined, geminiModel),
        deepseek: createDeepSeekReviewer(),
      };

  // ── Executar ──────────────────────────────────────────────────────────────

  const costGuard = new LiveBenchmarkCostGuardService();
  const storage = new LiveBenchmarkStorageService();
  const runner = new LiveBenchmarkRunnerService(costGuard, storage, reviewers);

  console.log(
    `\nIniciando ${isDryRun ? "simulação" : "execução real"}: ` +
    `${config.includeCaseIds?.length ?? 0} casos × ${config.providers.length} providers`,
  );
  if (!isDryRun) {
    const limits = config.providers
      .map((p) => `${p}: $${config.costLimits[p as LiveProviderId]?.maxUsd.toFixed(2)}`)
      .join(", ");
    console.log(`Limites de custo: ${limits}`);
  }
  console.log("");

  let state: LiveBenchmarkRunState | undefined;

  try {
    state = await runner.run(config, runId);
    printSummary(state, config, runId);
    console.log("\nBenchmark concluído com sucesso.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\nERRO durante execução: ${msg}`);
    console.error(`Estado parcial preservado para resume.`);
    console.error(`Para retomar: use o mesmo runId '${runId}' com resume=true.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});

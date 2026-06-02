// Runner principal do Quality Lab.
//
// Chama o LegalPipeline para cada caso sintético e coleta resultados.
//
// CLI:
//   tsx quality-lab/quality-runner.ts                   # 100 casos
//   tsx quality-lab/quality-runner.ts --count=20        # 20 casos
//   tsx quality-lab/quality-runner.ts --area=RPPS       # só RPPS
//   tsx quality-lab/quality-runner.ts --dry-run         # gera casos, sem OpenAI
//
// Limites de custo (env):
//   JUDICORE_QUALITY_MAX_CASES   (default: 100)
//   JUDICORE_QUALITY_MAX_TOKENS  (default: 500_000)
//   JUDICORE_QUALITY_MAX_COST_USD (default: 20)

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LegalPipeline } from "../src/pipeline/pipeline.js";
import { setOpenAIClient } from "../src/client.js";
import { generateSyntheticCases } from "./case-factory.js";
import {
  estimateCost,
  type CaseResult,
  type LegalArea,
  type SyntheticCase,
} from "./case-types.js";
import { evaluateTrap } from "./trap-evaluator.js";
import type {
  LegalAudit,
  ValidationError,
  GenerationMode,
  DocumentStatus,
  TipoPeca,
} from "../src/pipeline/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");

interface CliArgs {
  count: number;
  area?: LegalArea;
  documentType?: TipoPeca;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const countArg = args.find((a) => a.startsWith("--count="));
  const areaArg = args.find((a) => a.startsWith("--area="));
  // Aceita --type= ou --documentType= (ambos equivalentes)
  const typeArg = args.find((a) => a.startsWith("--type=") || a.startsWith("--documentType="));
  const result: CliArgs = {
    count: countArg ? Number.parseInt(countArg.slice("--count=".length), 10) : 100,
    dryRun: args.includes("--dry-run"),
  };
  if (areaArg) result.area = areaArg.slice("--area=".length) as LegalArea;
  if (typeArg) {
    const val = typeArg.startsWith("--documentType=")
      ? typeArg.slice("--documentType=".length)
      : typeArg.slice("--type=".length);
    result.documentType = val as TipoPeca;
  }
  return result;
}

interface CostLimits {
  maxCases: number;
  maxTokens: number;
  maxCostUsd: number;
}

function loadLimits(): CostLimits {
  return {
    maxCases: Number.parseInt(process.env["JUDICORE_QUALITY_MAX_CASES"] ?? "100", 10),
    maxTokens: Number.parseInt(process.env["JUDICORE_QUALITY_MAX_TOKENS"] ?? "500000", 10),
    maxCostUsd: Number.parseFloat(process.env["JUDICORE_QUALITY_MAX_COST_USD"] ?? "20"),
  };
}

async function runOneCase(fx: SyntheticCase): Promise<CaseResult> {
  const start = Date.now();
  const pipeline = new LegalPipeline();
  let draft = "";
  let mode: GenerationMode | undefined;
  let documentStatus: DocumentStatus | undefined;
  let safeMessage: string | undefined;
  let audit: LegalAudit | undefined;
  const validationErrors: ValidationError[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let errorMessage: string | undefined;

  try {
    for await (const evt of pipeline.run(
      {
        userId: "quality_lab",
        caseDescription: fx.caseDescription,
        documentType: fx.documentType,
        jurisprudencias: fx.jurisprudencias ?? [],
        instruction: fx.instruction,
      },
      `qlab_${fx.id}`,
      async (_stage, data) => {
        const d = data as { usage?: { inputTokens?: number; outputTokens?: number } };
        if (d?.usage) {
          inputTokens += d.usage.inputTokens ?? 0;
          outputTokens += d.usage.outputTokens ?? 0;
        }
      },
    )) {
      if (evt.event === "chunk") draft += evt.data;
      if (evt.event === "mode") mode = evt.data.mode;
      if (evt.event === "audit") audit = evt.data;
      if (evt.event === "done") {
        documentStatus = evt.data.status as DocumentStatus | undefined;
        safeMessage = evt.data.safe_message;
      }
      if (evt.event === "validation_errors") validationErrors.push(...evt.data);
      if (evt.event === "error" && evt.data.fatal) errorMessage = evt.data.message;
    }
  } catch (err) {
    errorMessage = String(err);
  }

  const durationMs = Date.now() - start;
  const cost = estimateCost(inputTokens, outputTokens);

  const result: CaseResult = {
    caseId: fx.id,
    area: fx.area,
    documentType: fx.documentType,
    theme: fx.theme,
    themeLabel: fx.themeLabel,
    title: fx.title,
    status: errorMessage ? "error" : "success",
    validationErrors: validationErrors.map((e) => ({
      rule: e.rule,
      message: e.message,
      fatal: e.fatal,
    })),
    auditErrors: audit?.erros?.map((e) => `[${e.severidade}] ${e.tipo}: ${e.trecho} → ${e.correcao}`) ?? [],
    inputTokens,
    outputTokens,
    estimatedCostUsd: cost,
    durationMs,
  };
  if (errorMessage) result.errorMessage = errorMessage;
  if (mode) result.mode = mode;
  if (documentStatus) result.documentStatus = documentStatus;
  if (audit) result.score = audit.score;
  if (safeMessage) result.safeMessage = safeMessage;
  if (draft) {
    result.draft = draft;
    result.draftExcerpt = draft.slice(0, 600);
  }
  if (fx.trap) {
    result.trap = fx.trap;
    // Avalia outcome com o draft já preenchido em result
    const outcome = evaluateTrap(fx.trap, result);
    result.trapOutcome = outcome;
    result.trapDetected = outcome !== "MISSED";
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const limits = loadLimits();
  const cases = generateSyntheticCases(args.count, args.area, args.documentType).slice(0, limits.maxCases);

  console.log(`[quality-runner] Configuração:`);
  console.log(`  modo:        ${args.dryRun ? "DRY-RUN (sem OpenAI)" : "REAL (OpenAI)"}`);
  console.log(`  casos:       ${cases.length}${cases.length < args.count ? ` (máximo disponível para área+tipo — solicitado: ${args.count})` : ""}`);
  console.log(`  área filtro: ${args.area ?? "todas"}`);
  console.log(`  tipo filtro: ${args.documentType ?? "todos"}`);
  console.log(`  limites:     ${limits.maxCases} casos / ${limits.maxTokens} tokens / $${limits.maxCostUsd}`);

  if (args.dryRun) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(join(OUTPUT_DIR, "cases.json"), JSON.stringify(cases, null, 2), "utf8");
    console.log(`[quality-runner] Dry-run concluído. ${cases.length} casos gravados em cases.json`);
    return;
  }

  if (!process.env["OPENAI_API_KEY"]) {
    console.error("[quality-runner] OPENAI_API_KEY ausente. Use --dry-run para validar sem OpenAI.");
    process.exit(2);
  }
  setOpenAIClient(null);

  const results: CaseResult[] = [];
  let totalTokens = 0;
  let totalCost = 0;
  let aborted = false;

  for (let i = 0; i < cases.length; i++) {
    const fx = cases[i]!;
    const trapTag = fx.trap ? ` [trap:${fx.trap}]` : "";
    process.stdout.write(`[quality-runner] (${i + 1}/${cases.length}) ${fx.id} [${fx.documentType}/${fx.area}]${trapTag} ... `);
    try {
      const r = await runOneCase(fx);
      results.push(r);
      totalTokens += r.inputTokens + r.outputTokens;
      totalCost += r.estimatedCostUsd;
      const statusLabel =
        r.status === "error" ? `ERROR — ${r.errorMessage?.slice(0, 60)}` :
        r.documentStatus ?? "—";
      console.log(
        `${statusLabel} | score ${r.score ?? "—"} | ${r.inputTokens + r.outputTokens}tok | ${r.durationMs}ms | $${r.estimatedCostUsd.toFixed(4)}`,
      );
    } catch (err) {
      console.log(`FATAL — ${String(err)}`);
    }

    if (totalTokens > limits.maxTokens) {
      console.error(`[quality-runner] LIMITE EXCEDIDO: ${totalTokens} tokens > ${limits.maxTokens}. Abortando.`);
      aborted = true;
      break;
    }
    if (totalCost > limits.maxCostUsd) {
      console.error(`[quality-runner] LIMITE EXCEDIDO: $${totalCost.toFixed(2)} > $${limits.maxCostUsd}. Abortando.`);
      aborted = true;
      break;
    }
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const resultsPath = join(OUTPUT_DIR, "results.json");
  await writeFile(resultsPath, JSON.stringify(results, null, 2), "utf8");

  console.log(`\n[quality-runner] Concluído ${aborted ? "(ABORTADO)" : ""}`);
  console.log(`  casos rodados: ${results.length}/${cases.length}`);
  console.log(`  tokens totais: ${totalTokens}`);
  console.log(`  custo total:   $${totalCost.toFixed(4)}`);
  console.log(`  resultados:    ${resultsPath}`);
  console.log(`\nPróximo passo: pnpm quality:report`);
}

void main().catch((err) => {
  console.error("[quality-runner] erro fatal:", err);
  process.exit(2);
});

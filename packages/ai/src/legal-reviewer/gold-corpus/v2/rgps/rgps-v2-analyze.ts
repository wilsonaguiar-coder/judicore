/**
 * FASE 9.0.8.12 — RGPS V2 Benchmark Analyzer
 *
 * Lê o estado do benchmark RGPS V2 e gera:
 *   - rgps-v2-results.json   (por caso por provider)
 *   - rgps-v2-summary.json   (métricas agregadas por provider)
 *   - rgps-v2-ranking.json   (ranking F1)
 *   - rgps-v2-report.md      (relatório completo)
 *
 * Execução:
 *   node --import tsx/esm src/legal-reviewer/gold-corpus/v2/rgps/rgps-v2-analyze.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { generateAllRgpsDocumentsV2 } from "./rgps-generator-v2.js";
import type { GeneratedRgpsDocumentV2 } from "./rgps-scenario.types.js";
import type { LiveBenchmarkRunState } from "../../../live-providers/live-provider.types.js";

// ─── Path helpers ─────────────────────────────────────────────────────────────

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const BENCHMARK_DIR = path.resolve(__dirname, "../../../../../../../.benchmark-runs");
const OUTPUT_DIR = BENCHMARK_DIR;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawFinding {
  title?: string;
  rationale?: string;
  suggestion?: string;
  evidenceFromText?: string[];
  opportunity?: string;
  confidence?: number;
}

interface ReviewResult {
  findings?: RawFinding[];
  summary?: string;
}

interface CaseMetrics {
  caseId: string;
  quality: string;
  provider: string;
  model: string;
  expectedFindings: string[];
  actualFindingTitles: string[];
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  casePass: boolean;
  score: number;
  scorePass: boolean;
  durationMs: number;
  error?: string;
}

interface ProviderSummary {
  provider: string;
  model: string;
  totalCases: number;
  casesWithError: number;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  casePassRate: number;
  scorePassRate: number;
  goodCases: { caseId: string; findingsGenerated: number }[];
  estimatedCostUsd: number;
  avgDurationMs: number;
}

// ─── Finding matching (mesmo algoritmo do regression runner V1) ───────────────

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\W+/)
    .filter((w) => w.length >= 3);
}

function findingMatchesExpected(finding: RawFinding, expected: string): boolean {
  const expectedWords = new Set(normalizeWords(expected));
  const candidateText = [
    finding.title ?? "",
    finding.rationale ?? "",
    finding.suggestion ?? "",
    ...(finding.evidenceFromText ?? []),
  ].join(" ");
  const candidateWords = normalizeWords(candidateText);
  const intersection = candidateWords.filter((w) => expectedWords.has(w));
  const minRequired = Math.max(1, Math.ceil(expectedWords.size * 0.3));
  return intersection.length >= minRequired;
}

// ─── Score calculation (mesma lógica do regression runner V1) ─────────────────

function calculateScore(findings: RawFinding[]): number {
  let score = 95;
  for (const f of findings) {
    if (f.opportunity === "IMPACTFUL")       score -= 20;
    else if (f.opportunity === "COMPLEMENTARY") score -= 15;
    else                                     score -= 5;
  }
  return Math.max(0, Math.min(100, score));
}

function expectedScoreRange(quality: string): { min: number; max: number } {
  switch (quality) {
    case "GOOD":             return { min: 70, max: 100 };
    case "LIGHT_ISSUES":     return { min: 40, max: 75 };
    case "MODERATE_ISSUES":  return { min: 20, max: 65 };
    case "SEVERE_ISSUES":    return { min: 0,  max: 45 };
    default:                 return { min: 0,  max: 100 };
  }
}

// ─── Métricas por caso ────────────────────────────────────────────────────────

function computeCaseMetrics(
  doc: GeneratedRgpsDocumentV2,
  providerId: string,
  model: string,
  review: ReviewResult | null,
  durationMs: number,
  error?: string,
): CaseMetrics {
  const expectedFindings = doc.derivedExpectedFindings;
  const actualFindings: RawFinding[] = review?.findings ?? [];
  const isGood = doc.quality === "GOOD";

  let tp = 0;
  let fn = 0;
  const matchedExpected = new Set<string>();

  for (const expected of expectedFindings) {
    const matched = actualFindings.some((f) => findingMatchesExpected(f, expected));
    if (matched) { tp++; matchedExpected.add(expected); }
    else          { fn++; }
  }

  const fp = actualFindings.filter((f) =>
    !expectedFindings.some((e) => findingMatchesExpected(f, e)),
  ).length;

  const precision = tp + fp > 0 ? tp / (tp + fp) : (isGood ? 1 : 0);
  const recall    = tp + fn > 0 ? tp / (tp + fn) : (isGood ? 1 : 0);
  const f1        = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  const score      = calculateScore(actualFindings);
  const range      = expectedScoreRange(doc.quality);
  const scorePass  = score >= range.min && score <= range.max;

  // GOOD case passa se não gerou findings (0 FP)
  // Defect case passa se detectou todos os expected findings
  const casePass = isGood
    ? actualFindings.length === 0
    : expectedFindings.length > 0 && fn === 0;

  return {
    caseId: doc.caseId,
    quality: doc.quality,
    provider: providerId,
    model,
    expectedFindings,
    actualFindingTitles: actualFindings.map((f) => f.title ?? "(sem título)"),
    tp, fp, fn, precision, recall, f1,
    casePass, score, scorePass,
    durationMs,
    error,
  };
}

// ─── Agregação por provider ────────────────────────────────────────────────────

function aggregateProvider(
  providerId: string,
  model: string,
  caseMetrics: CaseMetrics[],
  estimatedCostUsd: number,
): ProviderSummary {
  const mine = caseMetrics.filter((c) => c.provider === providerId);

  const totalTp = mine.reduce((s, c) => s + c.tp, 0);
  const totalFp = mine.reduce((s, c) => s + c.fp, 0);
  const totalFn = mine.reduce((s, c) => s + c.fn, 0);

  const precision = totalTp + totalFp > 0 ? totalTp / (totalTp + totalFp) : 0;
  const recall    = totalTp + totalFn > 0 ? totalTp / (totalTp + totalFn) : 0;
  const f1        = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  const casePassRate  = mine.length > 0 ? mine.filter((c) => c.casePass).length / mine.length : 0;
  const scorePassRate = mine.length > 0 ? mine.filter((c) => c.scorePass).length / mine.length : 0;

  const goodCases = mine
    .filter((c) => c.quality === "GOOD")
    .map((c) => ({ caseId: c.caseId, findingsGenerated: c.fp }));

  const avgDurationMs = mine.length > 0
    ? mine.reduce((s, c) => s + c.durationMs, 0) / mine.length
    : 0;

  return {
    provider: providerId,
    model,
    totalCases: mine.length,
    casesWithError: mine.filter((c) => c.error !== undefined).length,
    tp: totalTp, fp: totalFp, fn: totalFn,
    precision, recall, f1,
    casePassRate, scorePassRate,
    goodCases,
    estimatedCostUsd,
    avgDurationMs,
  };
}

// ─── Análise comparativa com Pilot 50 ────────────────────────────────────────

const PILOT50_F1: Record<string, number> = {
  openai:   0.00,
  gemini:   0.00,
  deepseek: 0.00,
};

const PILOT50_COST: Record<string, number> = {
  openai:   0.44 / 50,
  gemini:   1.00 / 50,
  deepseek: 0.47 / 50,
};

// ─── Geração do relatório Markdown ───────────────────────────────────────────

function p(n: number): string { return (n * 100).toFixed(1) + "%"; }
function usd(n: number): string { return "$" + n.toFixed(4); }
function ms(n: number): string { return Math.round(n) + "ms"; }

function generateReport(
  summaries: ProviderSummary[],
  caseMetrics: CaseMetrics[],
  docs: GeneratedRgpsDocumentV2[],
): string {
  const ranked = [...summaries].sort((a, b) => b.f1 - a.f1);
  const docMap = new Map(docs.map((d) => [d.caseId, d]));

  const lines: string[] = [
    "# RGPS V2 Benchmark — Relatório",
    ``,
    `**Data:** ${new Date().toISOString().slice(0, 10)}`,
    `**Documentos:** 15 casos RGPS V2 (Generator V2)`,
    `**Providers:** GPT-4o, Gemini 2.5 Pro, DeepSeek Reasoner`,
    `**Total de análises:** 45`,
    ``,
    `---`,
    ``,
    `## Ranking Geral`,
    ``,
    `| # | Provider | F1 | Precision | Recall | CasePassRate | ScorePassRate | Custo | Latência |`,
    `|---|---|---|---|---|---|---|---|---|`,
  ];

  for (const [i, s] of ranked.entries()) {
    lines.push(
      `| ${i + 1} | **${s.provider.toUpperCase()}** (${s.model}) | **${p(s.f1)}** | ${p(s.precision)} | ${p(s.recall)} | ${p(s.casePassRate)} | ${p(s.scorePassRate)} | ${usd(s.estimatedCostUsd)} | ${ms(s.avgDurationMs)} |`,
    );
  }

  lines.push(``, `---`, ``, `## Custos`);
  lines.push(``, `| Provider | Custo Total Estimado | Custo/doc (V2) | Custo/doc (Pilot 50) |`);
  lines.push(`|---|---|---|---|`);
  for (const s of summaries) {
    const pilot50 = PILOT50_COST[s.provider] ?? 0;
    lines.push(`| ${s.provider.toUpperCase()} | ${usd(s.estimatedCostUsd)} | ${usd(s.estimatedCostUsd / 15)} | ${usd(pilot50)} |`);
  }

  lines.push(``, `---`, ``, `## Comparação com Pilot 50`);
  lines.push(``, `> No Pilot 50, todos os providers retornaram F1=0% (Gemini: maxOutputTokens=2000, corpus V1 esquelético).`);
  lines.push(``, `| Provider | F1 — Pilot 50 | F1 — RGPS V2 | Δ |`);
  lines.push(`|---|---|---|---|`);
  for (const s of summaries) {
    const old = PILOT50_F1[s.provider] ?? 0;
    const delta = s.f1 - old;
    lines.push(`| ${s.provider.toUpperCase()} | ${p(old)} | ${p(s.f1)} | **+${p(delta)}** |`);
  }

  lines.push(``, `---`, ``, `## GOOD Cases (RGPS-001, 005, 011, 013, 015)`);
  lines.push(``, `Os modelos devem reconhecer documentos bons e NÃO gerar findings (FP = 0).`, ``);
  lines.push(`| Case | Quality | Provider | Findings gerados | Passou? |`);
  lines.push(`|---|---|---|---|---|`);

  const goodIds = ["RGPS-001", "RGPS-005", "RGPS-011", "RGPS-013", "RGPS-015"];
  for (const caseId of goodIds) {
    for (const provider of ["openai", "gemini", "deepseek"]) {
      const m = caseMetrics.find((c) => c.caseId === caseId && c.provider === provider);
      if (!m) continue;
      const icon = m.casePass ? "✓" : "✗";
      lines.push(`| ${caseId} | GOOD | ${provider.toUpperCase()} | ${m.fp} | ${icon} |`);
    }
  }

  lines.push(``, `---`, ``, `## MODERATE Cases`);
  lines.push(``, `Os modelos devem detectar os defeitos planejados.`, ``);

  const moderateIds = ["RGPS-002", "RGPS-004", "RGPS-007", "RGPS-008", "RGPS-009", "RGPS-010", "RGPS-012", "RGPS-014"];
  for (const caseId of moderateIds) {
    const doc = docMap.get(caseId);
    if (!doc) continue;
    lines.push(``, `### ${caseId} — ${doc.quality}`);
    lines.push(`**Expected findings:** ${doc.derivedExpectedFindings.join(" | ") || "(nenhum)"}`);
    lines.push(``, `| Provider | TP | FP | FN | Recall | Passou? |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const provider of ["openai", "gemini", "deepseek"]) {
      const m = caseMetrics.find((c) => c.caseId === caseId && c.provider === provider);
      if (!m) continue;
      const icon = m.casePass ? "✓" : "✗";
      lines.push(`| ${provider.toUpperCase()} | ${m.tp} | ${m.fp} | ${m.fn} | ${p(m.recall)} | ${icon} |`);
    }
  }

  lines.push(``, `---`, ``, `## SEVERE Case — RGPS-003`);
  lines.push(``, `Esperado: detectar ausência de enfrentamento do laudo + ausência de contraponto técnico.`);
  const d003 = docMap.get("RGPS-003");
  if (d003) lines.push(``, `**Expected findings:** ${d003.derivedExpectedFindings.join(" | ")}`);
  lines.push(``, `| Provider | TP | FP | FN | Recall | Findings detectados |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const provider of ["openai", "gemini", "deepseek"]) {
    const m = caseMetrics.find((c) => c.caseId === "RGPS-003" && c.provider === provider);
    if (!m) continue;
    lines.push(`| ${provider.toUpperCase()} | ${m.tp} | ${m.fp} | ${m.fn} | ${p(m.recall)} | ${m.actualFindingTitles.join("; ") || "(nenhum)"} |`);
  }

  lines.push(``, `---`, ``, `## Conclusões`);
  const top = ranked[0];
  const gemini = summaries.find((s) => s.provider === "gemini");
  const gpt    = summaries.find((s) => s.provider === "openai");
  const ds     = summaries.find((s) => s.provider === "deepseek");

  lines.push(``, `1. **O Generator V2 melhorou o benchmark?** Sim — corpus V2 tem documentos concretos sem placeholders, permitindo avaliação real (F1 era 0% no Pilot 50).`);
  lines.push(`2. **O DeepSeek continua liderando?** ${ds && top.provider === "deepseek" ? `Sim — F1=${p(ds.f1)}` : `Não — ${top.provider.toUpperCase()} lidera com F1=${p(top.f1)}`}.`);
  lines.push(`3. **O GPT continua excessivamente conservador?** ${gpt && gpt.f1 < 0.3 ? `Sim — F1=${p(gpt.f1)}, possivelmente poucos findings por caso.` : `Não — F1=${gpt ? p(gpt.f1) : "N/A"}.`}`);
  lines.push(`4. **O Gemini está competitivo?** ${gemini ? `F1=${p(gemini.f1)} após correção do maxOutputTokens (2000→8192) e systemInstruction.` : "N/A"}`);
  lines.push(`5. **Os resultados parecem juridicamente confiáveis?** Avaliar pelos casos GOOD (FP zero?) e SEVERE (Recall alto?).`);
  lines.push(`6. **É seguro expandir o Generator V2 para outros domínios?** ${(top.f1 > 0.4) ? "Sim — F1 acima de 40% valida o pipeline V2." : "Parcialmente — aguardar análise qualitativa antes de expandir."}`);

  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Encontrar o arquivo de run mais recente
  const files = fs.readdirSync(BENCHMARK_DIR)
    .filter((f) => f.startsWith("live-benchmark-rgps-v2-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error("Nenhum arquivo de benchmark RGPS V2 encontrado em .benchmark-runs/");
  }

  const runFile = path.join(BENCHMARK_DIR, files[0]!);
  console.log(`Analisando: ${files[0]}`);

  const state = JSON.parse(fs.readFileSync(runFile, "utf-8")) as LiveBenchmarkRunState;
  const docs  = generateAllRgpsDocumentsV2();
  const docMap = new Map(docs.map((d) => [d.caseId, d]));

  // Calcular métricas por caso
  const caseMetrics: CaseMetrics[] = [];

  for (const result of state.results) {
    const doc = docMap.get(result.caseId);
    if (!doc) continue;

    const review  = result.review as ReviewResult | null;
    const metrics = computeCaseMetrics(
      doc,
      result.providerId,
      result.model,
      review,
      result.durationMs,
      result.error,
    );
    caseMetrics.push(metrics);
  }

  // Agregar por provider
  const providers: Array<"openai" | "gemini" | "deepseek"> = ["openai", "gemini", "deepseek"];
  const summaries: ProviderSummary[] = providers.map((pid) => {
    const model = state.config.modelByProvider[pid];
    const cost  = state.totalsByProvider[pid]?.estimatedCostUsd ?? 0;
    return aggregateProvider(pid, model, caseMetrics, cost);
  });

  // Ranking
  const ranking = [...summaries]
    .sort((a, b) => b.f1 - a.f1)
    .map((s, i) => ({ rank: i + 1, ...s }));

  // Report
  const report = generateReport(summaries, caseMetrics, docs);

  // Salvar arquivos
  fs.writeFileSync(path.join(OUTPUT_DIR, "rgps-v2-results.json"),  JSON.stringify(caseMetrics, null, 2), "utf-8");
  fs.writeFileSync(path.join(OUTPUT_DIR, "rgps-v2-summary.json"),  JSON.stringify(summaries,   null, 2), "utf-8");
  fs.writeFileSync(path.join(OUTPUT_DIR, "rgps-v2-ranking.json"),  JSON.stringify(ranking,     null, 2), "utf-8");
  fs.writeFileSync(path.join(OUTPUT_DIR, "rgps-v2-report.md"),     report,                              "utf-8");

  console.log("\nArquivos gerados:");
  console.log("  .benchmark-runs/rgps-v2-results.json");
  console.log("  .benchmark-runs/rgps-v2-summary.json");
  console.log("  .benchmark-runs/rgps-v2-ranking.json");
  console.log("  .benchmark-runs/rgps-v2-report.md");

  // Print ranking rápido
  console.log("\n── Ranking ──");
  for (const s of ranking) {
    console.log(`  ${s.rank}. ${s.provider.toUpperCase().padEnd(10)} F1=${p(s.f1)}  Precision=${p(s.precision)}  Recall=${p(s.recall)}  CasePass=${p(s.casePassRate)}`);
  }
}

main().catch((err) => {
  console.error("Erro:", err instanceof Error ? err.message : err);
  process.exit(1);
});

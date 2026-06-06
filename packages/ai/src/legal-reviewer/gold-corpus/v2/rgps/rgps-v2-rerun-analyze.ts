/**
 * FASE 9.0.8.15 — RGPS V2 Re-Run Analyzer (comparação antes/depois)
 *
 * Lê o run de rerun (live-benchmark-rgps-v2-rerun-*.json) e gera:
 *   - rgps-v2-rerun-results.json
 *   - rgps-v2-rerun-summary.json
 *   - rgps-v2-rerun-ranking.json
 *   - rgps-v2-rerun-report.md   (com tabela antes × depois)
 *
 * Execução:
 *   node --import tsx/esm src/legal-reviewer/gold-corpus/v2/rgps/rgps-v2-rerun-analyze.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { generateAllRgpsDocumentsV2 } from "./rgps-generator-v2.js";
import type { GeneratedRgpsDocumentV2 } from "./rgps-scenario.types.js";
import type { LiveBenchmarkRunState } from "../../../live-providers/live-provider.types.js";

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const BENCHMARK_DIR = path.resolve(__dirname, "../../../../../../../.benchmark-runs");

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawFinding {
  title?: string;
  rationale?: string;
  suggestion?: string;
  evidenceFromText?: string[];
  opportunity?: string;
}

interface ReviewResult {
  findings?: RawFinding[];
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

// ─── Baseline V2 (run original FASE 9.0.8.12) ────────────────────────────────

interface BaselineData {
  f1: number;
  precision: number;
  recall: number;
  goodFp: Record<string, number>;
}

const BASELINE_V2: Record<string, BaselineData> = {
  openai: {
    f1: 0.43478,
    precision: 0.45455,
    recall: 0.41667,
    goodFp: { "RGPS-001": 0, "RGPS-005": 3, "RGPS-011": 0, "RGPS-013": 0, "RGPS-015": 0 },
  },
  gemini: {
    f1: 0.31429,
    precision: 0.18966,
    recall: 0.91667,
    goodFp: { "RGPS-001": 5, "RGPS-005": 4, "RGPS-011": 6, "RGPS-013": 5, "RGPS-015": 4 },
  },
  deepseek: {
    f1: 0.33333,
    precision: 0.20370,
    recall: 0.91667,
    goodFp: { "RGPS-001": 0, "RGPS-005": 5, "RGPS-011": 5, "RGPS-013": 3, "RGPS-015": 4 },
  },
};

// ─── Finding matching ─────────────────────────────────────────────────────────

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

// ─── Score calculation ────────────────────────────────────────────────────────

function calculateScore(findings: RawFinding[]): number {
  let score = 95;
  for (const f of findings) {
    if (f.opportunity === "IMPACTFUL")         score -= 20;
    else if (f.opportunity === "COMPLEMENTARY") score -= 15;
    else                                        score -= 5;
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

  for (const expected of expectedFindings) {
    const matched = actualFindings.some((f) => findingMatchesExpected(f, expected));
    if (matched) tp++;
    else          fn++;
  }

  const fp = actualFindings.filter((f) =>
    !expectedFindings.some((e) => findingMatchesExpected(f, e)),
  ).length;

  const precision = tp + fp > 0 ? tp / (tp + fp) : (isGood ? 1 : 0);
  const recall    = tp + fn > 0 ? tp / (tp + fn) : (isGood ? 1 : 0);
  const f1        = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  const score     = calculateScore(actualFindings);
  const range     = expectedScoreRange(doc.quality);
  const scorePass = score >= range.min && score <= range.max;
  const casePass  = isGood ? actualFindings.length === 0 : expectedFindings.length > 0 && fn === 0;

  return {
    caseId: doc.caseId, quality: doc.quality, provider: providerId, model,
    expectedFindings, actualFindingTitles: actualFindings.map((f) => f.title ?? "(sem título)"),
    tp, fp, fn, precision, recall, f1, casePass, score, scorePass, durationMs, error,
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
  const precision     = totalTp + totalFp > 0 ? totalTp / (totalTp + totalFp) : 0;
  const recall        = totalTp + totalFn > 0 ? totalTp / (totalTp + totalFn) : 0;
  const f1            = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
  const casePassRate  = mine.length > 0 ? mine.filter((c) => c.casePass).length / mine.length : 0;
  const scorePassRate = mine.length > 0 ? mine.filter((c) => c.scorePass).length / mine.length : 0;
  const goodCases     = mine.filter((c) => c.quality === "GOOD").map((c) => ({ caseId: c.caseId, findingsGenerated: c.fp }));
  const avgDurationMs = mine.length > 0 ? mine.reduce((s, c) => s + c.durationMs, 0) / mine.length : 0;
  return {
    provider: providerId, model,
    totalCases: mine.length, casesWithError: mine.filter((c) => c.error !== undefined).length,
    tp: totalTp, fp: totalFp, fn: totalFn,
    precision, recall, f1, casePassRate, scorePassRate,
    goodCases, estimatedCostUsd, avgDurationMs,
  };
}

// ─── Formatters ────────────────────────────────────────────────────────────────

function p(n: number): string { return (n * 100).toFixed(1) + "%"; }
function usd(n: number): string { return "$" + n.toFixed(4); }
function ms(n: number): string { return Math.round(n) + "ms"; }
function delta(after: number, before: number): string {
  const d = (after - before) * 100;
  return (d >= 0 ? "+" : "") + d.toFixed(1) + "pp";
}

// ─── Relatório comparativo ─────────────────────────────────────────────────────

function generateReport(
  summaries: ProviderSummary[],
  caseMetrics: CaseMetrics[],
  docs: GeneratedRgpsDocumentV2[],
): string {
  const ranked  = [...summaries].sort((a, b) => b.f1 - a.f1);
  const docMap  = new Map(docs.map((d) => [d.caseId, d]));
  const goodIds = ["RGPS-001", "RGPS-005", "RGPS-011", "RGPS-013", "RGPS-015"];

  const lines: string[] = [
    `# RGPS V2 Re-Run — Relatório (pós-remediation FASE 9.0.8.14)`,
    ``,
    `**Data:** ${new Date().toISOString().slice(0, 10)}`,
    `**Baseline:** FASE 9.0.8.12 (run original — documentos GOOD com erros lógicos)`,
    `**Esta rodada:** pós-remediation (FASE 9.0.8.14 — 5 GOOD cases corrigidos)`,
    `**Total de análises:** 45 (15 docs × 3 providers)`,
    ``,
    `---`,
    ``,
    `## 1. Ranking Novo`,
    ``,
    `| # | Provider | F1 | Precision | Recall | CasePassRate | ScorePassRate | Custo | Latência |`,
    `|---|---|---|---|---|---|---|---|---|`,
  ];

  for (const [i, s] of ranked.entries()) {
    lines.push(
      `| ${i + 1} | **${s.provider.toUpperCase()}** (${s.model}) | **${p(s.f1)}** | ${p(s.precision)} | ${p(s.recall)} | ${p(s.casePassRate)} | ${p(s.scorePassRate)} | ${usd(s.estimatedCostUsd)} | ${ms(s.avgDurationMs)} |`,
    );
  }

  // ── Tabela antes × depois ──────────────────────────────────────────────────
  lines.push(``, `---`, ``, `## 2. Antes × Depois (FASE 9.0.8.12 → FASE 9.0.8.15)`, ``);
  lines.push(
    `| Provider | F1 antes | F1 depois | Δ F1 | Precision antes | Precision depois | Δ Precision | Recall antes | Recall depois | Δ Recall | GOOD FP antes | GOOD FP depois |`,
    `|---|---|---|---|---|---|---|---|---|---|---|---|`,
  );

  for (const s of ["openai", "gemini", "deepseek"]) {
    const after  = summaries.find((x) => x.provider === s);
    const before = BASELINE_V2[s];
    if (!after || !before) continue;

    const afterGoodFp  = after.goodCases.reduce((sum, g) => sum + g.findingsGenerated, 0);
    const beforeGoodFp = Object.values(before.goodFp).reduce((sum, v) => sum + v, 0);

    lines.push(
      `| **${s.toUpperCase()}** ` +
      `| ${p(before.f1)} | ${p(after.f1)} | ${delta(after.f1, before.f1)} ` +
      `| ${p(before.precision)} | ${p(after.precision)} | ${delta(after.precision, before.precision)} ` +
      `| ${p(before.recall)} | ${p(after.recall)} | ${delta(after.recall, before.recall)} ` +
      `| ${beforeGoodFp} | ${afterGoodFp} |`,
    );
  }

  // ── GOOD cases detalhados ──────────────────────────────────────────────────
  lines.push(``, `---`, ``, `## 3. Análise dos GOOD Cases (antes × depois)`, ``);

  for (const caseId of goodIds) {
    lines.push(`### ${caseId}`);
    lines.push(`| Provider | FP antes | FP depois | Passou antes? | Passou depois? | FP titles (depois) |`);
    lines.push(`|---|---|---|---|---|---|`);

    for (const provider of ["openai", "gemini", "deepseek"]) {
      const after   = caseMetrics.find((c) => c.caseId === caseId && c.provider === provider);
      const fpBefore = BASELINE_V2[provider]?.goodFp[caseId] ?? "?";
      const fpAfter  = after?.fp ?? "?";
      const passBefore = fpBefore === 0 ? "✓" : "✗";
      const passAfter  = after?.casePass ? "✓" : "✗";
      const titles     = after?.actualFindingTitles.join("; ") ?? "";
      lines.push(`| ${provider.toUpperCase()} | ${fpBefore} | ${fpAfter} | ${passBefore} | ${passAfter} | ${titles || "—"} |`);
    }
    lines.push(``);
  }

  // ── Análise qualitativa dos FP remanescentes em GOOD ──────────────────────
  lines.push(`---`, ``, `### Análise qualitativa dos FP remanescentes nos GOOD cases`, ``);
  lines.push(`Os FP listados abaixo devem ser classificados como:`);
  lines.push(`- **A** — FP inválido (modelo alucinou)  `);
  lines.push(`- **B** — Melhoria legítima (o modelo identificou uma melhoria real não prevista)  `);
  lines.push(`- **C** — Problema metodológico / documento ainda apresenta falha  `);
  lines.push(`- **D** — Problema de prompt (modelo mal calibrado)  `);
  lines.push(``);

  for (const caseId of goodIds) {
    for (const provider of ["openai", "gemini", "deepseek"]) {
      const after = caseMetrics.find((c) => c.caseId === caseId && c.provider === provider);
      if (!after || after.fp === 0) continue;
      lines.push(`**${caseId} × ${provider.toUpperCase()}** — ${after.fp} FP:`);
      for (const title of after.actualFindingTitles) {
        lines.push(`  - "${title}" → *[classificar manualmente: A/B/C/D]*`);
      }
      lines.push(``);
    }
  }

  // ── SEVERE case ────────────────────────────────────────────────────────────
  lines.push(`---`, ``, `## 4. SEVERE Case — RGPS-003`, ``);
  lines.push(`Esperado: detectar **enfrentamento insuficiente da prova pericial** + **ausência de contraponto técnico**.`);
  const d003 = docMap.get("RGPS-003");
  if (d003) lines.push(`**Expected:** ${d003.derivedExpectedFindings.join(" | ")}`);
  lines.push(``, `| Provider | TP | FP | FN | Recall | Passou? | Findings detectados |`);
  lines.push(`|---|---|---|---|---|---|---|`);
  for (const provider of ["openai", "gemini", "deepseek"]) {
    const m = caseMetrics.find((c) => c.caseId === "RGPS-003" && c.provider === provider);
    if (!m) continue;
    lines.push(`| ${provider.toUpperCase()} | ${m.tp} | ${m.fp} | ${m.fn} | ${p(m.recall)} | ${m.casePass ? "✓" : "✗"} | ${m.actualFindingTitles.join("; ") || "(nenhum)"} |`);
  }

  // ── MODERATE/LIGHT cases completos ────────────────────────────────────────
  lines.push(``, `---`, ``, `## 5. Demais Casos (MODERATE / LIGHT)`, ``);
  const otherIds = ["RGPS-002", "RGPS-004", "RGPS-006", "RGPS-007", "RGPS-008", "RGPS-009", "RGPS-010", "RGPS-012", "RGPS-014"];
  for (const caseId of otherIds) {
    const doc = docMap.get(caseId);
    if (!doc) continue;
    lines.push(``, `### ${caseId} — ${doc.quality}`);
    lines.push(`**Expected:** ${doc.derivedExpectedFindings.join(" | ") || "(nenhum)"}`);
    lines.push(``, `| Provider | TP | FP | FN | Recall | Passou? |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const provider of ["openai", "gemini", "deepseek"]) {
      const m = caseMetrics.find((c) => c.caseId === caseId && c.provider === provider);
      if (!m) continue;
      lines.push(`| ${provider.toUpperCase()} | ${m.tp} | ${m.fp} | ${m.fn} | ${p(m.recall)} | ${m.casePass ? "✓" : "✗"} |`);
    }
  }

  // ── Conclusões ─────────────────────────────────────────────────────────────
  lines.push(``, `---`, ``, `## 6. Conclusões`, ``);

  const gpt = summaries.find((s) => s.provider === "openai");
  const gem = summaries.find((s) => s.provider === "gemini");
  const ds  = summaries.find((s) => s.provider === "deepseek");
  const top = ranked[0];

  const gptGoodFp  = gpt?.goodCases.reduce((s, g) => s + g.findingsGenerated, 0) ?? 0;
  const gemGoodFp  = gem?.goodCases.reduce((s, g) => s + g.findingsGenerated, 0) ?? 0;
  const dsGoodFp   = ds?.goodCases.reduce((s, g) => s + g.findingsGenerated, 0) ?? 0;
  const gemBefore  = Object.values(BASELINE_V2["gemini"]?.goodFp ?? {}).reduce((s, v) => s + v, 0);
  const dsBefore   = Object.values(BASELINE_V2["deepseek"]?.goodFp ?? {}).reduce((s, v) => s + v, 0);

  lines.push(`1. **A remediation reduziu FP nos GOOD cases?**`);
  lines.push(`   - GPT: ${gptGoodFp} FP total em GOOD (antes: 3) — ${gptGoodFp <= 3 ? "manteve ou melhorou" : "aumentou"}`);
  lines.push(`   - Gemini: ${gemGoodFp} FP total em GOOD (antes: ${gemBefore}) — ${gemGoodFp < gemBefore ? `reduziu (−${gemBefore - gemGoodFp})` : gemGoodFp === gemBefore ? "sem mudança" : `aumentou (+${gemGoodFp - gemBefore})`}`);
  lines.push(`   - DeepSeek: ${dsGoodFp} FP total em GOOD (antes: ${dsBefore}) — ${dsGoodFp < dsBefore ? `reduziu (−${dsBefore - dsGoodFp})` : dsGoodFp === dsBefore ? "sem mudança" : `aumentou (+${dsGoodFp - dsBefore})`}`);
  lines.push(``);

  if (gem) {
    const gemPrecBefore = BASELINE_V2["gemini"]?.precision ?? 0;
    lines.push(`2. **Gemini melhorou?** Precision: ${p(gemPrecBefore)} → ${p(gem.precision)} (${delta(gem.precision, gemPrecBefore)}). F1: ${p(BASELINE_V2["gemini"]?.f1 ?? 0)} → ${p(gem.f1)} (${delta(gem.f1, BASELINE_V2["gemini"]?.f1 ?? 0)}).`);
  }

  if (ds) {
    const dsPrecBefore = BASELINE_V2["deepseek"]?.precision ?? 0;
    lines.push(`3. **DeepSeek melhorou?** Precision: ${p(dsPrecBefore)} → ${p(ds.precision)} (${delta(ds.precision, dsPrecBefore)}). F1: ${p(BASELINE_V2["deepseek"]?.f1 ?? 0)} → ${p(ds.f1)} (${delta(ds.f1, BASELINE_V2["deepseek"]?.f1 ?? 0)}).`);
  }

  if (gpt) {
    lines.push(`4. **GPT manteve precisão?** Precision: ${p(BASELINE_V2["openai"]?.precision ?? 0)} → ${p(gpt.precision)} (${delta(gpt.precision, BASELINE_V2["openai"]?.precision ?? 0)}). F1: ${p(BASELINE_V2["openai"]?.f1 ?? 0)} → ${p(gpt.f1)} (${delta(gpt.f1, BASELINE_V2["openai"]?.f1 ?? 0)}).`);
  }

  const severeM003 = caseMetrics.find((c) => c.caseId === "RGPS-003" && c.provider === "openai");
  lines.push(`5. **GPT detectou RGPS-003 (SEVERE)?** ${severeM003 && severeM003.tp > 0 ? `Sim — TP=${severeM003.tp}, Recall=${p(severeM003.recall)}` : "Não — Recall=0%"}`);

  const severeG003 = caseMetrics.find((c) => c.caseId === "RGPS-003" && c.provider === "gemini");
  lines.push(`6. **Gemini detectou RGPS-003 (SEVERE)?** ${severeG003 && severeG003.tp > 0 ? `Sim — TP=${severeG003.tp}, Recall=${p(severeG003.recall)}` : "Não — Recall=0%"}`);

  const severeD003 = caseMetrics.find((c) => c.caseId === "RGPS-003" && c.provider === "deepseek");
  lines.push(`7. **DeepSeek detectou RGPS-003 (SEVERE)?** ${severeD003 && severeD003.tp > 0 ? `Sim — TP=${severeD003.tp}, Recall=${p(severeD003.recall)}` : "Não — Recall=0%"}`);

  lines.push(`8. **É seguro expandir o Generator V2 para outros domínios?** ${top && top.f1 > 0.4 ? `Sim — provider líder com F1=${p(top.f1)} (acima de 40%). Documentos GOOD agora logicamente consistentes.` : `Parcialmente — aguardar resultado final desta análise.`}`);

  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Procura o arquivo de re-run (mais recente com prefixo rgps-v2-rerun-)
  const files = fs.readdirSync(BENCHMARK_DIR)
    .filter((f) => f.startsWith("live-benchmark-rgps-v2-rerun-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error("Nenhum arquivo de re-run RGPS V2 encontrado. Execute rgps-v2-rerun-benchmark.ts primeiro.");
  }

  const runFile = path.join(BENCHMARK_DIR, files[0]!);
  console.log(`Analisando re-run: ${files[0]}`);

  const state  = JSON.parse(fs.readFileSync(runFile, "utf-8")) as LiveBenchmarkRunState;
  const docs   = generateAllRgpsDocumentsV2();
  const docMap = new Map(docs.map((d) => [d.caseId, d]));

  // Calcular métricas por caso
  const caseMetrics: CaseMetrics[] = [];
  for (const result of state.results) {
    const doc = docMap.get(result.caseId);
    if (!doc) continue;
    const review  = result.review as ReviewResult | null;
    caseMetrics.push(computeCaseMetrics(doc, result.providerId, result.model, review, result.durationMs, result.error));
  }

  // Agregar por provider
  const providers: Array<"openai" | "gemini" | "deepseek"> = ["openai", "gemini", "deepseek"];
  const summaries: ProviderSummary[] = providers.map((pid) => {
    const model = state.config.modelByProvider[pid];
    const cost  = state.totalsByProvider[pid]?.estimatedCostUsd ?? 0;
    return aggregateProvider(pid, model, caseMetrics, cost);
  });

  const ranking = [...summaries].sort((a, b) => b.f1 - a.f1).map((s, i) => ({ rank: i + 1, ...s }));
  const report  = generateReport(summaries, caseMetrics, docs);

  // Salvar arquivos
  fs.writeFileSync(path.join(BENCHMARK_DIR, "rgps-v2-rerun-results.json"),  JSON.stringify(caseMetrics, null, 2), "utf-8");
  fs.writeFileSync(path.join(BENCHMARK_DIR, "rgps-v2-rerun-summary.json"),  JSON.stringify(summaries,   null, 2), "utf-8");
  fs.writeFileSync(path.join(BENCHMARK_DIR, "rgps-v2-rerun-ranking.json"),  JSON.stringify(ranking,     null, 2), "utf-8");
  fs.writeFileSync(path.join(BENCHMARK_DIR, "rgps-v2-rerun-report.md"),     report,                              "utf-8");

  console.log("\nArquivos gerados:");
  console.log("  .benchmark-runs/rgps-v2-rerun-results.json");
  console.log("  .benchmark-runs/rgps-v2-rerun-summary.json");
  console.log("  .benchmark-runs/rgps-v2-rerun-ranking.json");
  console.log("  .benchmark-runs/rgps-v2-rerun-report.md");

  console.log("\n── Ranking Re-Run ──");
  for (const s of ranking) {
    const before = BASELINE_V2[s.provider];
    const f1Delta = before ? delta(s.f1, before.f1) : "N/A";
    const precDelta = before ? delta(s.precision, before.precision) : "N/A";
    const goodFpTotal = s.goodCases.reduce((sum, g) => sum + g.findingsGenerated, 0);
    const goodFpBefore = before ? Object.values(before.goodFp).reduce((sum, v) => sum + v, 0) : "?";
    console.log(
      `  ${s.rank}. ${s.provider.toUpperCase().padEnd(10)} ` +
      `F1=${p(s.f1)} (${f1Delta})  ` +
      `Precision=${p(s.precision)} (${precDelta})  ` +
      `Recall=${p(s.recall)}  ` +
      `GOOD FP: ${goodFpTotal} (antes: ${goodFpBefore})`,
    );
  }
}

main().catch((err) => {
  console.error("Erro:", err instanceof Error ? err.message : err);
  process.exit(1);
});

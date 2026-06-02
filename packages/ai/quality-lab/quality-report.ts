// Gera relatório agregado (HTML + JSON) a partir de results.json.
//
// Seções:
//   - Resumo geral
//   - Por tipo de documento (score médio, taxas)
//   - Por tema (score médio, erros críticos, trap detection)
//   - Por validator (Evidence, Legal, Appeal, Structural, Final etc.)
//   - Por área (compatibilidade)
//   - Lista de casos

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mapRuleToValidator,
  type CaseResult,
  type RunSummary,
  type AreaStats,
  type ThemeStats,
  type ValidatorStats,
  type ValidatorComponent,
  type LegalArea,
} from "./case-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");

function emptyArea(): AreaStats {
  return { total: 0, approved: 0, withCaveats: 0, rejected: 0, avgScore: 0 };
}

function emptyByArea(): Record<LegalArea, AreaStats> {
  return {
    RPPS: emptyArea(), RGPS: emptyArea(), TRABALHISTA: emptyArea(),
    CRIMINAL: emptyArea(), CRIMINAL_MERITO: emptyArea(),
    CIVEL: emptyArea(), CIVEL_GERAL: emptyArea(), CONSUMIDOR: emptyArea(),
  };
}

function emptyValidator(): ValidatorStats {
  return { fatal: 0, nonFatal: 0, topRules: [] };
}

function emptyByValidator(): Record<ValidatorComponent, ValidatorStats> {
  return {
    EvidenceAnalyzer: emptyValidator(),
    LegalValidator: emptyValidator(),
    AppealValidator: emptyValidator(),
    StructuralValidator: emptyValidator(),
    FinalValidator: emptyValidator(),
    JurisprudenceValidator: emptyValidator(),
    GenericityValidator: emptyValidator(),
    MatrixQualityValidator: emptyValidator(),
    RichnessValidator: emptyValidator(),
    CivilValidator: emptyValidator(),
    ConsumerValidator: emptyValidator(),
    Other: emptyValidator(),
  };
}

function topN(map: Map<string, number>, n: number): { rule: string; count: number }[] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([rule, count]) => ({ rule, count }));
}

function applyStatus(stats: AreaStats, status: string | undefined): void {
  if (status === "MINUTA APROVADA") stats.approved++;
  else if (status === "APROVADA COM RESSALVAS") stats.withCaveats++;
  else if (status === "REPROVADA") stats.rejected++;
}

function summarize(results: CaseResult[]): RunSummary {
  const byArea = emptyByArea();
  const byDocumentType: Record<string, AreaStats> = {};
  const byTheme: Record<string, ThemeStats> = {};
  const byValidator = emptyByValidator();
  const ruleCounts = new Map<string, number>();
  const themeRuleCounts = new Map<string, Map<string, number>>();
  const validatorRuleCounts: Record<ValidatorComponent, Map<string, number>> = {
    EvidenceAnalyzer: new Map(), LegalValidator: new Map(), AppealValidator: new Map(),
    StructuralValidator: new Map(), FinalValidator: new Map(),
    JurisprudenceValidator: new Map(), GenericityValidator: new Map(),
    MatrixQualityValidator: new Map(), RichnessValidator: new Map(),
    CivilValidator: new Map(), ConsumerValidator: new Map(), Other: new Map(),
  };

  const areaScoreSum: Record<LegalArea, number> = { RPPS: 0, RGPS: 0, TRABALHISTA: 0, CRIMINAL: 0, CRIMINAL_MERITO: 0, CIVEL: 0, CIVEL_GERAL: 0, CONSUMIDOR: 0 };
  const areaScoreN: Record<LegalArea, number> = { RPPS: 0, RGPS: 0, TRABALHISTA: 0, CRIMINAL: 0, CRIMINAL_MERITO: 0, CIVEL: 0, CIVEL_GERAL: 0, CONSUMIDOR: 0 };
  const docScoreSum: Record<string, number> = {};
  const docScoreN: Record<string, number> = {};
  const themeScoreSum: Record<string, number> = {};
  const themeScoreN: Record<string, number> = {};

  let succeeded = 0, failed = 0;
  let approved = 0, withCaveats = 0, rejected = 0;
  let scoreSum = 0, scoreN = 0;
  let inputTokens = 0, outputTokens = 0, costUsd = 0, durationSum = 0;

  let totalWithTraps = 0, trapsDetected = 0, trapsAvoided = 0, trapsMissed = 0;
  const trapByKind = new Map<string, { total: number; detected: number; avoided: number; missed: number }>();

  for (const r of results) {
    if (r.status === "success") succeeded++; else failed++;
    if (r.documentStatus === "MINUTA APROVADA") approved++;
    else if (r.documentStatus === "APROVADA COM RESSALVAS") withCaveats++;
    else if (r.documentStatus === "REPROVADA") rejected++;

    if (typeof r.score === "number") {
      scoreSum += r.score; scoreN++;
      areaScoreSum[r.area] += r.score; areaScoreN[r.area]++;
      docScoreSum[r.documentType] = (docScoreSum[r.documentType] ?? 0) + r.score;
      docScoreN[r.documentType] = (docScoreN[r.documentType] ?? 0) + 1;
      themeScoreSum[r.themeLabel] = (themeScoreSum[r.themeLabel] ?? 0) + r.score;
      themeScoreN[r.themeLabel] = (themeScoreN[r.themeLabel] ?? 0) + 1;
    }

    inputTokens += r.inputTokens; outputTokens += r.outputTokens;
    costUsd += r.estimatedCostUsd; durationSum += r.durationMs;

    // By area
    const a = byArea[r.area];
    a.total++; applyStatus(a, r.documentStatus);

    // By documentType
    if (!byDocumentType[r.documentType]) byDocumentType[r.documentType] = emptyArea();
    const d = byDocumentType[r.documentType]!;
    d.total++; applyStatus(d, r.documentStatus);

    // By theme
    if (!byTheme[r.themeLabel]) {
      byTheme[r.themeLabel] = {
        ...emptyArea(),
        themeLabel: r.themeLabel,
        area: r.area,
        trapTotal: 0,
        trapDetected: 0,
        trapAvoided: 0,
        trapMissed: 0,
        topCriticalRules: [],
      };
      themeRuleCounts.set(r.themeLabel, new Map());
    }
    const t = byTheme[r.themeLabel]!;
    t.total++; applyStatus(t, r.documentStatus);

    // Traps — outcome tripartite (DETECTED/AVOIDED/MISSED)
    if (r.trap) {
      totalWithTraps++;
      t.trapTotal++;
      const bk = trapByKind.get(r.trap) ?? { total: 0, detected: 0, avoided: 0, missed: 0 };
      bk.total++;
      const outcome = r.trapOutcome ?? (r.trapDetected ? "DETECTED" : "MISSED");
      if (outcome === "DETECTED") {
        trapsDetected++; t.trapDetected++; bk.detected++;
      } else if (outcome === "AVOIDED") {
        trapsAvoided++; t.trapAvoided++; bk.avoided++;
      } else {
        trapsMissed++; t.trapMissed++; bk.missed++;
      }
      trapByKind.set(r.trap, bk);
    }

    // Validation errors
    for (const err of r.validationErrors) {
      const validator = mapRuleToValidator(err.rule);
      if (err.fatal) {
        byValidator[validator].fatal++;
        ruleCounts.set(err.rule, (ruleCounts.get(err.rule) ?? 0) + 1);
        themeRuleCounts.get(r.themeLabel)!.set(
          err.rule, (themeRuleCounts.get(r.themeLabel)!.get(err.rule) ?? 0) + 1,
        );
      } else {
        byValidator[validator].nonFatal++;
      }
      const vMap = validatorRuleCounts[validator];
      vMap.set(err.rule, (vMap.get(err.rule) ?? 0) + 1);
    }
  }

  // Compute averages
  for (const area of Object.keys(byArea) as LegalArea[]) {
    byArea[area].avgScore = areaScoreN[area] > 0 ? areaScoreSum[area] / areaScoreN[area] : 0;
  }
  for (const dt of Object.keys(byDocumentType)) {
    byDocumentType[dt]!.avgScore = docScoreN[dt]! > 0 ? docScoreSum[dt]! / docScoreN[dt]! : 0;
  }
  for (const label of Object.keys(byTheme)) {
    const t = byTheme[label]!;
    t.avgScore = themeScoreN[label]! > 0 ? themeScoreSum[label]! / themeScoreN[label]! : 0;
    t.topCriticalRules = topN(themeRuleCounts.get(label) ?? new Map(), 5);
  }
  for (const v of Object.keys(byValidator) as ValidatorComponent[]) {
    byValidator[v].topRules = topN(validatorRuleCounts[v], 5);
  }

  return {
    generatedAt: new Date().toISOString(),
    totalCases: results.length,
    succeeded, failed,
    approved, approvedWithCaveats: withCaveats, rejected,
    avgScore: scoreN > 0 ? scoreSum / scoreN : 0,
    totalInputTokens: inputTokens,
    totalOutputTokens: outputTokens,
    totalCostUsd: costUsd,
    avgDurationMs: results.length > 0 ? durationSum / results.length : 0,
    byArea, byDocumentType, byTheme, byValidator,
    trapStats: {
      totalWithTraps,
      detected: trapsDetected,
      avoided: trapsAvoided,
      missed: trapsMissed,
      byKind: Object.fromEntries(trapByKind),
    },
    topCriticalRules: topN(ruleCounts, 10),
    results,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderHtml(s: RunSummary): string {
  const passRate = s.totalCases > 0 ? Math.round(((s.approved + s.approvedWithCaveats) / s.totalCases) * 100) : 0;
  const trapHandledRate = s.trapStats.totalWithTraps > 0
    ? Math.round(((s.trapStats.detected + s.trapStats.avoided) / s.trapStats.totalWithTraps) * 100)
    : 0;
  const trapDetRate = s.trapStats.totalWithTraps > 0
    ? Math.round((s.trapStats.detected / s.trapStats.totalWithTraps) * 100)
    : 0;

  const areaRows = (Object.entries(s.byArea) as [LegalArea, AreaStats][]).map(([area, st]) => `
    <tr>
      <td><strong>${area}</strong></td>
      <td>${st.total}</td>
      <td class="ok">${st.approved}</td>
      <td class="warn">${st.withCaveats}</td>
      <td class="bad">${st.rejected}</td>
      <td>${st.avgScore.toFixed(1)}</td>
    </tr>`).join("");

  const docRows = Object.entries(s.byDocumentType).map(([dt, st]) => `
    <tr>
      <td><strong>${dt}</strong></td>
      <td>${st.total}</td>
      <td class="ok">${st.approved} <small>(${Math.round((st.approved / Math.max(st.total, 1)) * 100)}%)</small></td>
      <td class="warn">${st.withCaveats} <small>(${Math.round((st.withCaveats / Math.max(st.total, 1)) * 100)}%)</small></td>
      <td class="bad">${st.rejected} <small>(${Math.round((st.rejected / Math.max(st.total, 1)) * 100)}%)</small></td>
      <td><strong>${st.avgScore.toFixed(1)}</strong></td>
    </tr>`).join("");

  const themeRows = Object.values(s.byTheme).map((t) => `
    <tr>
      <td><strong>${escapeHtml(t.themeLabel)}</strong><br><small class="muted">${escapeHtml(t.area)}</small></td>
      <td>${t.total}</td>
      <td><strong>${t.avgScore.toFixed(1)}</strong></td>
      <td class="ok">${t.approved}</td>
      <td class="warn">${t.withCaveats}</td>
      <td class="bad">${t.rejected}</td>
      <td>${t.trapTotal > 0 ? `<span class="ok">${t.trapDetected}D</span> / <span class="warn">${t.trapAvoided}A</span> / <span class="bad">${t.trapMissed}M</span>` : `<span class="muted">—</span>`}</td>
      <td>${t.topCriticalRules.length > 0
        ? t.topCriticalRules.map((r) => `<code>${escapeHtml(r.rule)}</code>×${r.count}`).join("<br>")
        : `<span class="muted">—</span>`}</td>
    </tr>`).join("");

  const validatorRows = Object.entries(s.byValidator).map(([name, vs]) => `
    <tr>
      <td><strong>${escapeHtml(name)}</strong></td>
      <td class="bad">${vs.fatal}</td>
      <td class="warn">${vs.nonFatal}</td>
      <td>${vs.topRules.length > 0
        ? vs.topRules.map((r) => `<code>${escapeHtml(r.rule)}</code>×${r.count}`).join(", ")
        : `<span class="muted">—</span>`}</td>
    </tr>`).join("");

  const trapRows = Object.entries(s.trapStats.byKind).map(([kind, stats]) => `
    <tr>
      <td><code>${escapeHtml(kind)}</code></td>
      <td>${stats.total}</td>
      <td class="ok">${stats.detected}</td>
      <td class="warn">${stats.avoided}</td>
      <td class="bad">${stats.missed}</td>
      <td>${Math.round(((stats.detected + stats.avoided) / Math.max(stats.total, 1)) * 100)}%</td>
    </tr>`).join("");

  const caseRows = s.results.map((r) => {
    const statusClass =
      r.documentStatus === "MINUTA APROVADA" ? "ok" :
      r.documentStatus === "APROVADA COM RESSALVAS" ? "warn" :
      r.documentStatus === "REPROVADA" ? "bad" : "muted";
    const errors = r.validationErrors.length
      ? `<ul class="errors">${r.validationErrors.map((e) =>
          `<li class="${e.fatal ? 'fatal' : 'nonfatal'}"><code>${escapeHtml(e.rule)}</code> — ${escapeHtml(e.message)}</li>`,
        ).join("")}</ul>`
      : `<span class="muted">—</span>`;
    const excerpt = r.draftExcerpt
      ? `<details><summary>Trecho</summary><pre>${escapeHtml(r.draftExcerpt)}</pre></details>`
      : "";
    const trapInfo = r.trap
      ? `<br><span class="badge ${r.trapOutcome === "DETECTED" ? "ok" : r.trapOutcome === "AVOIDED" ? "warn" : "bad"}" title="${r.trapOutcome ?? "unknown"}">${escapeHtml(r.trap)}: ${r.trapOutcome ?? "?"}</span>`
      : "";
    return `
      <tr class="row-${statusClass}">
        <td><span class="badge ${statusClass}">${escapeHtml(r.documentStatus ?? r.status)}</span>${trapInfo}</td>
        <td><strong>${escapeHtml(r.caseId)}</strong><br><small>${escapeHtml(r.title)}</small></td>
        <td>${escapeHtml(r.area)}</td>
        <td>${escapeHtml(r.documentType)}</td>
        <td>${escapeHtml(r.mode ?? "—")}</td>
        <td>${r.score ?? "—"}</td>
        <td>${errors}${excerpt}</td>
        <td><small>${r.inputTokens + r.outputTokens}tok<br>$${r.estimatedCostUsd.toFixed(4)}<br>${r.durationMs}ms</small></td>
      </tr>`;
  }).join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>JudiCore Quality Lab — Relatório</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #222; }
  h1, h2 { margin: 16px 0 8px; }
  .meta { color: #666; margin-bottom: 16px; }
  .summary { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; min-width: 130px; }
  .card .v { font-size: 28px; font-weight: 700; }
  .card.ok .v { color: #16a34a; }
  .card.warn .v { color: #ca8a04; }
  .card.bad .v { color: #dc2626; }
  .card.total .v { color: #2563eb; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th, td { border-bottom: 1px solid #eee; padding: 8px; vertical-align: top; font-size: 13px; text-align: left; }
  th { background: #f8fafc; font-weight: 600; }
  td.ok { color: #16a34a; font-weight: 600; }
  td.warn { color: #ca8a04; font-weight: 600; }
  td.bad { color: #dc2626; font-weight: 600; }
  .row-ok { background: #f0fdf4; }
  .row-warn { background: #fefce8; }
  .row-bad { background: #fef2f2; }
  .row-muted { background: #f9fafb; color: #999; }
  .badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .badge.ok { background: #dcfce7; color: #166534; }
  .badge.warn { background: #fef9c3; color: #854d0e; }
  .badge.bad { background: #fee2e2; color: #991b1b; }
  .badge.muted { background: #f3f4f6; color: #4b5563; }
  ul.errors { margin: 0; padding-left: 16px; }
  ul.errors li.fatal { color: #991b1b; }
  ul.errors li.nonfatal { color: #854d0e; }
  code { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-size: 11px; }
  pre { background: #f8fafc; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 11px; max-height: 240px; white-space: pre-wrap; }
  details summary { cursor: pointer; color: #2563eb; font-size: 11px; }
  .muted { color: #999; }
</style>
</head>
<body>
  <h1>JudiCore Quality Lab — Relatório</h1>
  <div class="meta">Gerado em ${escapeHtml(s.generatedAt)}</div>

  <h2>Resumo</h2>
  <div class="summary">
    <div class="card total"><div class="v">${s.totalCases}</div><div>Casos</div></div>
    <div class="card ok"><div class="v">${s.approved}</div><div>MINUTA APROVADA</div></div>
    <div class="card warn"><div class="v">${s.approvedWithCaveats}</div><div>COM RESSALVAS</div></div>
    <div class="card bad"><div class="v">${s.rejected}</div><div>REPROVADA</div></div>
    <div class="card"><div class="v">${passRate}%</div><div>Aprovação</div></div>
    <div class="card"><div class="v">${s.avgScore.toFixed(1)}</div><div>Score médio</div></div>
  </div>

  <div class="summary">
    <div class="card"><div class="v">${s.totalInputTokens + s.totalOutputTokens}</div><div>Tokens totais</div></div>
    <div class="card"><div class="v">$${s.totalCostUsd.toFixed(2)}</div><div>Custo estimado</div></div>
    <div class="card"><div class="v">${Math.round(s.avgDurationMs)}ms</div><div>Tempo médio</div></div>
    <div class="card bad"><div class="v">${s.failed}</div><div>Erros de execução</div></div>
    <div class="card ok"><div class="v">${trapHandledRate}%</div><div>Traps tratadas (detect+avoid)</div></div>
    <div class="card"><div class="v">${trapDetRate}%</div><div>Detec. determinística</div></div>
  </div>

  <h2>Por tipo de documento</h2>
  <table>
    <thead><tr><th>Tipo</th><th>Total</th><th>Aprovados</th><th>C/ ressalvas</th><th>Reprovados</th><th>Score médio</th></tr></thead>
    <tbody>${docRows}</tbody>
  </table>

  <h2>Por tema</h2>
  <table>
    <thead><tr><th>Tema</th><th>Total</th><th>Score médio</th><th>Aprov</th><th>C/ress</th><th>Reprov</th><th>Traps D/A/M</th><th>Top erros críticos</th></tr></thead>
    <tbody>${themeRows}</tbody>
  </table>

  <h2>Por componente (validator)</h2>
  <table>
    <thead><tr><th>Componente</th><th>Erros fatais</th><th>Avisos</th><th>Top regras</th></tr></thead>
    <tbody>${validatorRows}</tbody>
  </table>

  <h2>Detecção de armadilhas (traps)</h2>
  ${trapRows
    ? `<table><thead><tr><th>Trap</th><th>Total</th><th>Detectadas (rule)</th><th>Evitadas (AI dodge)</th><th>Missed (problema)</th><th>Taxa tratamento</th></tr></thead><tbody>${trapRows}</tbody></table>`
    : `<p class="muted">Nenhuma armadilha aplicada.</p>`}

  <h2>Por área jurídica</h2>
  <table>
    <thead><tr><th>Área</th><th>Total</th><th>Aprov</th><th>C/ress</th><th>Reprov</th><th>Score médio</th></tr></thead>
    <tbody>${areaRows}</tbody>
  </table>

  <h2>Casos</h2>
  <table>
    <thead><tr><th>Status</th><th>ID</th><th>Área</th><th>Tipo</th><th>Modo</th><th>Score</th><th>Detalhes</th><th>Métricas</th></tr></thead>
    <tbody>${caseRows}</tbody>
  </table>
</body>
</html>`;
}

async function main(): Promise<void> {
  const resultsPath = join(OUTPUT_DIR, "results.json");
  let raw: string;
  try {
    raw = await readFile(resultsPath, "utf8");
  } catch {
    console.error(`[quality-report] ${resultsPath} não encontrado. Rode "pnpm quality:run" primeiro.`);
    process.exit(2);
  }
  const results = JSON.parse(raw) as CaseResult[];
  const summary = summarize(results);

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(join(OUTPUT_DIR, "report.json"), JSON.stringify(summary, null, 2), "utf8");
  await writeFile(join(OUTPUT_DIR, "report.html"), renderHtml(summary), "utf8");

  console.log(`[quality-report] Sumário:`);
  console.log(`  casos:    ${summary.totalCases}`);
  console.log(`  aprov:    ${summary.approved}`);
  console.log(`  c/ress:   ${summary.approvedWithCaveats}`);
  console.log(`  reprov:   ${summary.rejected}`);
  console.log(`  erros:    ${summary.failed}`);
  console.log(`  score:    ${summary.avgScore.toFixed(1)}`);
  console.log(`  traps:    ${summary.trapStats.detected} DETECTED / ${summary.trapStats.avoided} AVOIDED / ${summary.trapStats.missed} MISSED (de ${summary.trapStats.totalWithTraps})`);
  console.log(`  tokens:   ${summary.totalInputTokens + summary.totalOutputTokens}`);
  console.log(`  custo:    $${summary.totalCostUsd.toFixed(2)}`);
  console.log(`  JSON:     ${join(OUTPUT_DIR, "report.json")}`);
  console.log(`  HTML:     ${join(OUTPUT_DIR, "report.html")}`);
}

void main().catch((err) => {
  console.error("[quality-report] erro fatal:", err);
  process.exit(2);
});

// Gera relatório agregado (HTML + JSON sumarizado) a partir de results.json.
//
// Mostra:
//   - totais e taxas
//   - score médio global, por área e por tipo de peça
//   - top regras críticas
//   - lista de casos com status, score, erros e trecho

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CaseResult,
  RunSummary,
  AreaStats,
  LegalArea,
} from "./case-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");

function emptyAreaStats(): AreaStats {
  return { total: 0, approved: 0, withCaveats: 0, rejected: 0, avgScore: 0 };
}

function emptyByArea(): Record<LegalArea, AreaStats> {
  return {
    RPPS: emptyAreaStats(),
    RGPS: emptyAreaStats(),
    TRABALHISTA: emptyAreaStats(),
    CRIMINAL: emptyAreaStats(),
    CIVEL: emptyAreaStats(),
  };
}

function summarize(results: CaseResult[]): RunSummary {
  const byArea = emptyByArea();
  const byDocumentType: Record<string, AreaStats> = {};
  const ruleCounts = new Map<string, number>();

  let approved = 0;
  let approvedWithCaveats = 0;
  let rejected = 0;
  let succeeded = 0;
  let failed = 0;
  let scoreSum = 0;
  let scoreN = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  let durationSum = 0;

  // Per-area score accumulators
  const areaScoreSum: Record<LegalArea, number> = { RPPS: 0, RGPS: 0, TRABALHISTA: 0, CRIMINAL: 0, CIVEL: 0 };
  const areaScoreN: Record<LegalArea, number> = { RPPS: 0, RGPS: 0, TRABALHISTA: 0, CRIMINAL: 0, CIVEL: 0 };
  const docScoreSum: Record<string, number> = {};
  const docScoreN: Record<string, number> = {};

  for (const r of results) {
    if (r.status === "success") succeeded++;
    else failed++;

    if (r.documentStatus === "MINUTA APROVADA") approved++;
    else if (r.documentStatus === "APROVADA COM RESSALVAS") approvedWithCaveats++;
    else if (r.documentStatus === "REPROVADA") rejected++;

    if (typeof r.score === "number") {
      scoreSum += r.score;
      scoreN++;
      areaScoreSum[r.area] += r.score;
      areaScoreN[r.area]++;
      docScoreSum[r.documentType] = (docScoreSum[r.documentType] ?? 0) + r.score;
      docScoreN[r.documentType] = (docScoreN[r.documentType] ?? 0) + 1;
    }

    inputTokens += r.inputTokens;
    outputTokens += r.outputTokens;
    costUsd += r.estimatedCostUsd;
    durationSum += r.durationMs;

    // Por área
    const a = byArea[r.area];
    a.total++;
    if (r.documentStatus === "MINUTA APROVADA") a.approved++;
    else if (r.documentStatus === "APROVADA COM RESSALVAS") a.withCaveats++;
    else if (r.documentStatus === "REPROVADA") a.rejected++;

    // Por tipo de peça
    if (!byDocumentType[r.documentType]) byDocumentType[r.documentType] = emptyAreaStats();
    const d = byDocumentType[r.documentType]!;
    d.total++;
    if (r.documentStatus === "MINUTA APROVADA") d.approved++;
    else if (r.documentStatus === "APROVADA COM RESSALVAS") d.withCaveats++;
    else if (r.documentStatus === "REPROVADA") d.rejected++;

    // Regras críticas (fatal)
    for (const err of r.validationErrors) {
      if (err.fatal) ruleCounts.set(err.rule, (ruleCounts.get(err.rule) ?? 0) + 1);
    }
  }

  for (const area of Object.keys(byArea) as LegalArea[]) {
    byArea[area].avgScore = areaScoreN[area] > 0 ? areaScoreSum[area] / areaScoreN[area] : 0;
  }
  for (const dt of Object.keys(byDocumentType)) {
    byDocumentType[dt]!.avgScore = docScoreN[dt]! > 0 ? docScoreSum[dt]! / docScoreN[dt]! : 0;
  }

  const topCriticalRules = [...ruleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([rule, count]) => ({ rule, count }));

  return {
    generatedAt: new Date().toISOString(),
    totalCases: results.length,
    succeeded,
    failed,
    approved,
    approvedWithCaveats,
    rejected,
    avgScore: scoreN > 0 ? scoreSum / scoreN : 0,
    totalInputTokens: inputTokens,
    totalOutputTokens: outputTokens,
    totalCostUsd: costUsd,
    avgDurationMs: results.length > 0 ? durationSum / results.length : 0,
    byArea,
    byDocumentType,
    topCriticalRules,
    results,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderHtml(s: RunSummary): string {
  const passRate = s.totalCases > 0 ? Math.round(((s.approved + s.approvedWithCaveats) / s.totalCases) * 100) : 0;

  const areaRows = (Object.entries(s.byArea) as [LegalArea, AreaStats][])
    .map(([area, st]) => `
      <tr>
        <td><strong>${area}</strong></td>
        <td>${st.total}</td>
        <td class="ok">${st.approved}</td>
        <td class="warn">${st.withCaveats}</td>
        <td class="bad">${st.rejected}</td>
        <td>${st.avgScore.toFixed(1)}</td>
      </tr>
    `).join("");

  const docRows = Object.entries(s.byDocumentType)
    .map(([dt, st]) => `
      <tr>
        <td><strong>${dt}</strong></td>
        <td>${st.total}</td>
        <td class="ok">${st.approved}</td>
        <td class="warn">${st.withCaveats}</td>
        <td class="bad">${st.rejected}</td>
        <td>${st.avgScore.toFixed(1)}</td>
      </tr>
    `).join("");

  const ruleRows = s.topCriticalRules
    .map((r) => `<tr><td><code>${escapeHtml(r.rule)}</code></td><td>${r.count}</td></tr>`)
    .join("");

  const caseRows = s.results
    .map((r) => {
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
      return `
        <tr class="row-${statusClass}">
          <td><span class="badge ${statusClass}">${escapeHtml(r.documentStatus ?? r.status)}</span></td>
          <td><strong>${escapeHtml(r.caseId)}</strong><br><small>${escapeHtml(r.title)}</small></td>
          <td>${escapeHtml(r.area)}</td>
          <td>${escapeHtml(r.documentType)}</td>
          <td>${escapeHtml(r.mode ?? "—")}</td>
          <td>${r.score ?? "—"}</td>
          <td>${errors}${excerpt}</td>
          <td><small>${r.inputTokens + r.outputTokens}tok<br>$${r.estimatedCostUsd.toFixed(4)}<br>${r.durationMs}ms</small></td>
        </tr>
      `;
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
    <div class="card warn"><div class="v">${s.approvedWithCaveats}</div><div>APROVADA COM RESSALVAS</div></div>
    <div class="card bad"><div class="v">${s.rejected}</div><div>REPROVADA</div></div>
    <div class="card"><div class="v">${passRate}%</div><div>Aprovação (com ou sem ressalvas)</div></div>
    <div class="card"><div class="v">${s.avgScore.toFixed(1)}</div><div>Score médio</div></div>
  </div>

  <div class="summary">
    <div class="card"><div class="v">${s.totalInputTokens + s.totalOutputTokens}</div><div>Tokens totais</div></div>
    <div class="card"><div class="v">$${s.totalCostUsd.toFixed(2)}</div><div>Custo estimado</div></div>
    <div class="card"><div class="v">${Math.round(s.avgDurationMs)}ms</div><div>Tempo médio</div></div>
    <div class="card bad"><div class="v">${s.failed}</div><div>Erros de execução</div></div>
  </div>

  <h2>Por área</h2>
  <table>
    <thead><tr><th>Área</th><th>Total</th><th>Aprovados</th><th>C/ ressalvas</th><th>Reprovados</th><th>Score médio</th></tr></thead>
    <tbody>${areaRows}</tbody>
  </table>

  <h2>Por tipo de peça</h2>
  <table>
    <thead><tr><th>Tipo</th><th>Total</th><th>Aprovados</th><th>C/ ressalvas</th><th>Reprovados</th><th>Score médio</th></tr></thead>
    <tbody>${docRows}</tbody>
  </table>

  <h2>Top regras críticas (fatal)</h2>
  ${ruleRows ? `<table><thead><tr><th>Regra</th><th>Ocorrências</th></tr></thead><tbody>${ruleRows}</tbody></table>` : `<p class="muted">Nenhuma regra crítica emitida.</p>`}

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
  console.log(`  tokens:   ${summary.totalInputTokens + summary.totalOutputTokens}`);
  console.log(`  custo:    $${summary.totalCostUsd.toFixed(2)}`);
  console.log(`  JSON:     ${join(OUTPUT_DIR, "report.json")}`);
  console.log(`  HTML:     ${join(OUTPUT_DIR, "report.html")}`);
}

void main().catch((err) => {
  console.error("[quality-report] erro fatal:", err);
  process.exit(2);
});

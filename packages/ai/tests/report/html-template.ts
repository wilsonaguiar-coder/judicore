// Template HTML simples para o relatório de execução da suíte jurídica.

export interface ReportCase {
  fixtureId: string;
  fixtureName: string;
  documentType: string;
  expectedMode?: string;
  expectedStatus?: string;
  expectedCriticalErrors?: string[];
  obtainedMode?: string;
  obtainedStatus?: string;
  obtainedErrors: { rule: string; message: string; fatal: boolean }[];
  audit?: { score: number; aprovada: boolean };
  pass: boolean;
  failureReasons: string[];
  draftExcerpt?: string;
  problematicExcerpts?: string[];
  inputTokens?: number;
  outputTokens?: number;
}

export interface ReportData {
  generatedAt: string;
  totalCases: number;
  passed: number;
  failed: number;
  cases: ReportCase[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderHtml(data: ReportData): string {
  const passRate = data.totalCases > 0 ? Math.round((data.passed / data.totalCases) * 100) : 0;
  const rows = data.cases
    .map((c) => {
      const status = c.pass
        ? '<span class="badge pass">PASS</span>'
        : '<span class="badge fail">FAIL</span>';
      const errors = c.obtainedErrors.length
        ? `<ul class="errors">${c.obtainedErrors
            .map(
              (e) =>
                `<li class="${e.fatal ? "fatal" : "warn"}"><code>${escapeHtml(e.rule)}</code> — ${escapeHtml(e.message)}</li>`,
            )
            .join("")}</ul>`
        : '<span class="muted">—</span>';
      const reasons = c.failureReasons.length
        ? `<ul class="reasons">${c.failureReasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
        : '<span class="muted">—</span>';
      const excerpts = c.problematicExcerpts?.length
        ? `<details><summary>Trechos problemáticos (${c.problematicExcerpts.length})</summary><div class="excerpts">${c.problematicExcerpts.map((x) => `<pre>${escapeHtml(x)}</pre>`).join("")}</div></details>`
        : "";
      const draft = c.draftExcerpt
        ? `<details><summary>Trecho do draft</summary><pre>${escapeHtml(c.draftExcerpt)}</pre></details>`
        : "";
      return `
        <tr class="${c.pass ? "row-pass" : "row-fail"}">
          <td>${status}</td>
          <td><strong>${escapeHtml(c.fixtureId)}</strong><br><small>${escapeHtml(c.fixtureName)}</small></td>
          <td>${escapeHtml(c.documentType)}</td>
          <td>${escapeHtml(c.obtainedMode ?? "—")}<br><small>esperado: ${escapeHtml(c.expectedMode ?? "—")}</small></td>
          <td>${escapeHtml(c.obtainedStatus ?? "—")}<br><small>esperado: ${escapeHtml(c.expectedStatus ?? "—")}</small></td>
          <td>${c.audit ? `${c.audit.score}/100` : "—"}</td>
          <td>${errors}</td>
          <td>${reasons}${excerpts}${draft}</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>JudiCore — Relatório de Testes Jurídicos</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #222; }
  h1 { margin: 0 0 8px; }
  .meta { color: #666; margin-bottom: 16px; }
  .summary { display: flex; gap: 16px; margin-bottom: 24px; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; min-width: 140px; }
  .card .v { font-size: 32px; font-weight: 700; }
  .card.pass .v { color: #16a34a; }
  .card.fail .v { color: #dc2626; }
  .card.total .v { color: #2563eb; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #eee; padding: 10px; vertical-align: top; font-size: 13px; }
  th { background: #f8fafc; text-align: left; font-weight: 600; }
  .badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
  .badge.pass { background: #dcfce7; color: #166534; }
  .badge.fail { background: #fee2e2; color: #991b1b; }
  .row-fail { background: #fef2f2; }
  ul { margin: 0; padding-left: 16px; }
  .errors li.fatal { color: #991b1b; }
  .errors li.warn { color: #92400e; }
  .reasons li { color: #7f1d1d; }
  .muted { color: #999; }
  code { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-size: 11px; }
  pre { background: #f8fafc; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 11px; max-height: 240px; }
  details { margin-top: 6px; }
  summary { cursor: pointer; color: #2563eb; font-size: 11px; }
</style>
</head>
<body>
  <h1>JudiCore — Relatório de Testes Jurídicos</h1>
  <div class="meta">Gerado em ${escapeHtml(data.generatedAt)}</div>
  <div class="summary">
    <div class="card total"><div class="v">${data.totalCases}</div><div>Casos</div></div>
    <div class="card pass"><div class="v">${data.passed}</div><div>Passaram</div></div>
    <div class="card fail"><div class="v">${data.failed}</div><div>Falharam</div></div>
    <div class="card"><div class="v">${passRate}%</div><div>Taxa de sucesso</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>Caso</th>
        <th>Tipo</th>
        <th>Modo</th>
        <th>Status final</th>
        <th>Score</th>
        <th>Regras emitidas</th>
        <th>Motivos / Detalhes</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

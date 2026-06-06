"use client";

import React, { useEffect, useState } from "react";

// ── Tipos locais ──────────────────────────────────────────────────────────────

interface FindingFrequency {
  type: string;
  count: number;
  percentage: number;
}

interface Analytics {
  totalExecutions: number;
  totalFindings: number;
  avgFindingsPerExecution: number;
  topFindingTypes: FindingFrequency[];
  topFindingsByDomain: Record<string, FindingFrequency[]>;
  opportunityLevelDistribution: Record<string, number>;
  providerStats: Record<string, { executions: number; avgFindings: number; avgResponseTimeMs: number }>;
  feedbackStats: {
    totalFeedback: number;
    usefulCount: number;
    notUsefulCount: number;
    usefulRate: number;
    byFindingType: Record<string, { useful: number; notUseful: number; usefulRate: number }>;
  };
  anonymizedExamples: Array<{
    findingType: string;
    opportunityLevel: string;
    evidenceSnippet: string;
    domain?: string;
  }>;
}

const TYPE_LABEL: Record<string, string> = {
  MISSING_DEMONSTRATION:          "Demonstração insuficiente",
  MISSING_COMPARATIVE_TABLE:      "Quadro comparativo ausente",
  MISSING_CALCULATION:            "Cálculo ausente",
  MISSING_SUPPORTING_DOCUMENT:    "Documento de suporte ausente",
  MISSING_DATE_ANCHOR:            "Ancoragem temporal ausente",
  MISSING_LEGAL_ANCHOR:           "Fundamento normativo ausente",
  UNUSED_EXTRACTED_DATA:          "Dado disponível não aproveitado",
  FACTUAL_ENRICHMENT_OPPORTUNITY: "Enriquecimento fático",
  STRENGTHEN_ARGUMENT:            "Argumento pode ser reforçado",
  ANTICIPATE_COUNTERARGUMENT:     "Antecipação de contra-argumento",
  WEAK_FACTUAL_FOUNDATION:        "Base fática fraca",
};

const OPP_COLOR: Record<string, string> = {
  IMPACTFUL:     "bg-emerald-100 text-emerald-700",
  COMPLEMENTARY: "bg-blue-100 text-blue-700",
  OPTIONAL:      "bg-slate-100 text-slate-600",
};

// ── Componentes ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function BarRow({ label, count, percentage }: { label: string; count: number; percentage: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-48 text-xs text-slate-600 truncate flex-shrink-0">{label}</div>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-400 rounded-full"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-12 text-right flex-shrink-0">{percentage}%</span>
      <span className="text-xs font-semibold text-slate-700 w-6 flex-shrink-0">{count}</span>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function StrengthReviewAnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/review-studio/analytics")
      .then(r => r.json())
      .then((d: Analytics) => { setAnalytics(d); setLoading(false); })
      .catch(() => { setError("Erro ao carregar analytics."); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">{error ?? "Sem dados"}</p>
      </div>
    );
  }

  const domains = Object.keys(analytics.topFindingsByDomain);
  const providers = Object.keys(analytics.providerStats);
  const feedbackByType = Object.entries(analytics.feedbackStats.byFindingType);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-xl font-bold text-slate-900">Painel de Observabilidade</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI Legal Strength Reviewer — uso real</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

        {/* Métricas gerais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Execuções" value={analytics.totalExecutions} />
          <StatCard label="Findings totais" value={analytics.totalFindings} />
          <StatCard
            label="Média por execução"
            value={analytics.avgFindingsPerExecution}
            sub="findings / revisão"
          />
          <StatCard
            label="Taxa de utilidade"
            value={`${analytics.feedbackStats.usefulRate}%`}
            sub={`${analytics.feedbackStats.totalFeedback} feedbacks`}
          />
        </div>

        {/* Top findings */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Top Findings — Frequência Global</h2>
          {analytics.topFindingTypes.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum dado ainda.</p>
          ) : (
            <div className="space-y-3">
              {analytics.topFindingTypes.map(f => (
                <BarRow
                  key={f.type}
                  label={TYPE_LABEL[f.type] ?? f.type}
                  count={f.count}
                  percentage={f.percentage}
                />
              ))}
            </div>
          )}
        </div>

        {/* Distribution de OpportunityLevel */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Distribuição por Nível de Oportunidade</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(analytics.opportunityLevelDistribution).map(([level, count]) => (
              <div
                key={level}
                className={`px-4 py-2 rounded-xl border text-sm font-semibold ${OPP_COLOR[level] ?? "bg-slate-100 text-slate-600"}`}
              >
                {level}: {count}
              </div>
            ))}
          </div>
        </div>

        {/* Por domínio */}
        {domains.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Top Findings por Domínio</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {domains.map(domain => (
                <div key={domain}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{domain}</p>
                  <div className="space-y-2">
                    {(analytics.topFindingsByDomain[domain] ?? []).map(f => (
                      <BarRow
                        key={f.type}
                        label={TYPE_LABEL[f.type] ?? f.type}
                        count={f.count}
                        percentage={f.percentage}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Provider stats */}
        {providers.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Desempenho por Provider</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                    <th className="text-left pb-2 font-medium">Provider</th>
                    <th className="text-right pb-2 font-medium">Execuções</th>
                    <th className="text-right pb-2 font-medium">Média findings</th>
                    <th className="text-right pb-2 font-medium">Tempo médio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {providers.map(p => {
                    const s = analytics.providerStats[p]!;
                    return (
                      <tr key={p} className="py-2">
                        <td className="py-2 font-semibold text-slate-700">{p}</td>
                        <td className="py-2 text-right text-slate-600">{s.executions}</td>
                        <td className="py-2 text-right text-slate-600">{s.avgFindings}</td>
                        <td className="py-2 text-right text-slate-600">{s.avgResponseTimeMs}ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Feedback por tipo */}
        {feedbackByType.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Feedback por Tipo de Finding</h2>
            <p className="text-xs text-slate-400 mb-4">
              {analytics.feedbackStats.usefulCount} úteis · {analytics.feedbackStats.notUsefulCount} não úteis
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                    <th className="text-left pb-2 font-medium">Tipo</th>
                    <th className="text-right pb-2 font-medium">👍 Útil</th>
                    <th className="text-right pb-2 font-medium">👎 Não útil</th>
                    <th className="text-right pb-2 font-medium">Taxa útil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {feedbackByType
                    .sort((a, b) => (b[1].useful + b[1].notUseful) - (a[1].useful + a[1].notUseful))
                    .map(([type, stats]) => (
                      <tr key={type}>
                        <td className="py-2 text-slate-700">{TYPE_LABEL[type] ?? type}</td>
                        <td className="py-2 text-right text-emerald-600 font-semibold">{stats.useful}</td>
                        <td className="py-2 text-right text-red-500">{stats.notUseful}</td>
                        <td className="py-2 text-right font-semibold text-slate-700">{stats.usefulRate}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Exemplos anonimizados */}
        {analytics.anonymizedExamples.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Amostra Anonimizada</h2>
            <p className="text-xs text-slate-400 mb-4">Trechos para análise qualitativa — sem dados pessoais.</p>
            <div className="space-y-3">
              {analytics.anonymizedExamples.slice(0, 10).map((ex, i) => (
                <div key={i} className="border border-slate-100 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${OPP_COLOR[ex.opportunityLevel] ?? "bg-slate-100 text-slate-600"}`}>
                      {ex.opportunityLevel}
                    </span>
                    <span className="text-xs text-slate-500">{TYPE_LABEL[ex.findingType] ?? ex.findingType}</span>
                    {ex.domain && (
                      <span className="text-xs text-slate-400">· {ex.domain}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 italic">"{ex.evidenceSnippet}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {analytics.totalExecutions === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
            <p className="text-slate-400 text-sm">Nenhuma execução registrada ainda.</p>
            <p className="text-slate-300 text-xs mt-1">Os dados aparecerão aqui após as primeiras revisões.</p>
          </div>
        )}
      </div>
    </div>
  );
}

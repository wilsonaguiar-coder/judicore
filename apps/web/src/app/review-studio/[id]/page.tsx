"use client";

import React, { useEffect, useState } from "react";
import { AuditSummaryCard } from "../../../components/review-studio/AuditSummaryCard";
import { CorrectionPlanList } from "../../../components/review-studio/CorrectionPlanList";
import { GuidedRevisionChecklist } from "../../../components/review-studio/GuidedRevisionChecklist";
import { SuggestionPanel } from "../../../components/review-studio/SuggestionPanel";
import { RewriteComparison } from "../../../components/review-studio/RewriteComparison";
import { ReAuditMetrics } from "../../../components/review-studio/ReAuditMetrics";
import { HistoryTimeline } from "../../../components/review-studio/HistoryTimeline";

export default function ReviewStudioPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [suggestion, setSuggestion] = useState<any>(null);
  const [rewrite, setRewrite] = useState<any>(null);
  const [reAudit, setReAudit] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    fetch(`/api/review-studio/${params.id}/audit`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, [params.id]);

  const handleGenerateSuggestion = async () => {
    setLoadingAction(true);
    const res = await fetch(`/api/review-studio/${params.id}/suggestion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: "task-test-1" })
    });
    const sug = await res.json();
    setSuggestion(sug);
    setLoadingAction(false);
  };

  const handleDecision = async (decision: string) => {
    await fetch(`/api/review-studio/${params.id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: "task-test-1", decision })
    });
    alert(`Decision: ${decision} saved.`);
  };

  const handleGenerateRewrite = async () => {
    setLoadingAction(true);
    const res = await fetch(`/api/review-studio/${params.id}/rewrite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: "task-test-1", suggestionStr: suggestion?.suggestion })
    });
    const rw = await res.json();
    setRewrite(rw);
    setLoadingAction(false);
  };

  const handleReAudit = async () => {
    setLoadingAction(true);
    const res = await fetch(`/api/review-studio/${params.id}/re-audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalDraft: rewrite.originalDraft,
        rewrittenDraft: rewrite.rewrittenDraft,
        classification: "CIVIL_PETICAO_INICIAL"
      })
    });
    const ra = await res.json();
    setReAudit(ra);
    setLoadingAction(false);
  };

  if (loading || !data) return <div className="p-8">Carregando auditoria...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Review Studio</h1>
          <p className="text-slate-500 mt-1">Document ID: {params.id}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-8">
          <AuditSummaryCard {...data.audit} />
          <CorrectionPlanList items={data.correctionPlan?.items || []} />
          <HistoryTimeline items={[]} />
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <h2 className="font-semibold mb-4">A\u00E7\u00F5es do Est\u00FAdio</h2>
            <div className="flex gap-2">
              <button onClick={handleGenerateSuggestion} disabled={loadingAction} className="bg-blue-600 text-white px-4 py-2 rounded">
                Gerar Sugest\u00E3o
              </button>
              <button onClick={handleGenerateRewrite} disabled={!suggestion || loadingAction} className="bg-indigo-600 text-white px-4 py-2 rounded">
                Gerar Reescrita
              </button>
              <button onClick={handleReAudit} disabled={!rewrite || loadingAction} className="bg-emerald-600 text-white px-4 py-2 rounded">
                Executar Re-Audit
              </button>
            </div>
            {loadingAction && <p className="mt-2 text-sm text-slate-500">Processando com a IA...</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <GuidedRevisionChecklist tasks={[{id: "task-test-1", instruction: "Ajustar contradi\u00E7\u00E3o.", completed: false}]} />
            {suggestion && (
              <SuggestionPanel 
                ruleCode={suggestion.ruleCode || "UNKNOWN"}
                suggestion={suggestion.suggestion || "Nenhuma sugest\u00E3o"}
                provider={suggestion.provider || "DEEPSEEK"}
                onApprove={() => handleDecision("APPROVED")}
                onReject={() => handleDecision("REJECTED")}
                onSkip={() => handleDecision("SKIPPED")}
              />
            )}
          </div>

          {reAudit && <ReAuditMetrics {...reAudit.metrics} improved={reAudit.improved} regressed={reAudit.regressed} />}
          {rewrite && <RewriteComparison original={rewrite.originalDraft} rewritten={rewrite.rewrittenDraft} />}
        </div>
      </div>
    </div>
  );
}

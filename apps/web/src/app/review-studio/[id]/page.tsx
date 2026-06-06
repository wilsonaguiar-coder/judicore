"use client";

import React, { useEffect, useState } from "react";
import { AuditSummaryCard } from "../../../components/review-studio/AuditSummaryCard";
import { CorrectionPlanList } from "../../../components/review-studio/CorrectionPlanList";
import { GuidedRevisionChecklist } from "../../../components/review-studio/GuidedRevisionChecklist";
import { SuggestionPanel } from "../../../components/review-studio/SuggestionPanel";
import { RewriteComparison } from "../../../components/review-studio/RewriteComparison";
import { ReAuditMetrics } from "../../../components/review-studio/ReAuditMetrics";
import { HistoryTimeline } from "../../../components/review-studio/HistoryTimeline";
import { VersionTimeline } from "../../../components/review-studio/VersionTimeline";
import { VersionPreview } from "../../../components/review-studio/VersionPreview";
import { VersionComparePanel } from "../../../components/review-studio/VersionComparePanel";

export default function ReviewStudioPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<any>(null);
  const [rewrite, setRewrite] = useState<any>(null);
  const [reAudit, setReAudit] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [timeline, setTimeline] = useState<any>(null);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);

  const loadData = () => {
    setError(null);
    fetch(`/api/review-studio/${params.id}/audit`)
      .then(res => res.json())
      .then(d => {
        setData(d ?? {});
        return fetch(`/api/review-studio/${params.id}/versions`);
      })
      .then(res => res.json())
      .then(t => {
        setTimeline(t ?? null);
        setLoading(false);
      })
      .catch(err => {
        console.error("Review Studio load error:", err);
        setError("Erro ao carregar dados. Tente novamente.");
        setData({});
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [params.id]);

  const handleGenerateSuggestion = async () => {
    setLoadingAction(true);
    try {
      const res = await fetch(`/api/review-studio/${params.id}/suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: "task-test-1" })
      });
      const sug = await res.json();
      setSuggestion(sug ?? null);
    } catch (e) {
      console.error("Suggestion error:", e);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDecision = async (decision: string) => {
    try {
      await fetch(`/api/review-studio/${params.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: "task-test-1", decision })
      });
      alert(`Decision: ${decision} saved.`);
    } catch (e) {
      console.error("Decision error:", e);
    }
  };

  const handleGenerateRewrite = async () => {
    setLoadingAction(true);
    try {
      const res = await fetch(`/api/review-studio/${params.id}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: "task-test-1", suggestionStr: suggestion?.suggestion })
      });
      const rw = await res.json();
      setRewrite(rw ?? null);
    } catch (e) {
      console.error("Rewrite error:", e);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReAudit = async () => {
    if (!rewrite) return;
    setLoadingAction(true);
    try {
      const res = await fetch(`/api/review-studio/${params.id}/re-audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalDraft: rewrite?.originalDraft ?? "",
          rewrittenDraft: rewrite?.rewrittenDraft ?? "",
          classification: "CIVIL_PETICAO_INICIAL"
        })
      });
      const ra = await res.json();
      setReAudit(ra ?? null);
      loadData();
    } catch (e) {
      console.error("Re-audit error:", e);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRecommend = async (versionId: string) => {
    try {
      await fetch(`/api/review-studio/${params.id}/versions/${versionId}/recommend`, {
        method: "POST"
      });
      loadData();
    } catch (e) {
      console.error("Recommend error:", e);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-600">Carregando auditoria...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-red-600">
        <p className="font-semibold">Erro ao carregar Review Studio</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={loadData} className="mt-4 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-800">
          Tentar novamente
        </button>
      </div>
    );
  }

  // Defensive normalization — never pass undefined to child components
  const audit = data?.audit ?? {};
  const correctionPlanItems = data?.correctionPlan?.items ?? [];
  const reAuditMetrics = reAudit?.metrics ?? {};
  const versions = timeline?.versions ?? [];

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
          <AuditSummaryCard
            score={audit.score}
            classification={audit.classification}
            fatalErrors={audit.fatalErrors ?? []}
            nonFatalErrors={audit.nonFatalErrors ?? []}
            strengths={audit.strengths ?? []}
          />
          <CorrectionPlanList items={correctionPlanItems} />
          <HistoryTimeline timeline={timeline} />
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <h2 className="font-semibold mb-4">Ações do Estúdio</h2>
            <div className="flex gap-2">
              <button onClick={handleGenerateSuggestion} disabled={loadingAction} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
                Gerar Sugestão
              </button>
              <button onClick={handleGenerateRewrite} disabled={!suggestion || loadingAction} className="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-50">
                Gerar Reescrita
              </button>
              <button onClick={handleReAudit} disabled={!rewrite || loadingAction} className="bg-emerald-600 text-white px-4 py-2 rounded disabled:opacity-50">
                Executar Re-Audit
              </button>
            </div>
            {loadingAction && <p className="mt-2 text-sm text-slate-500">Processando com a IA...</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <GuidedRevisionChecklist tasks={[{id: "task-test-1", instruction: "Ajustar contradição.", completed: false}]} />
            {suggestion && (
              <SuggestionPanel
                ruleCode={suggestion?.ruleCode ?? "UNKNOWN"}
                suggestion={suggestion?.suggestion ?? "Nenhuma sugestão"}
                provider={suggestion?.provider ?? "DEEPSEEK"}
                onApprove={() => handleDecision("APPROVED")}
                onReject={() => handleDecision("REJECTED")}
                onSkip={() => handleDecision("SKIPPED")}
              />
            )}
          </div>

          {reAudit && (
            <ReAuditMetrics
              scoreBefore={reAuditMetrics.scoreBefore}
              scoreAfter={reAuditMetrics.scoreAfter}
              scoreDelta={reAuditMetrics.scoreDelta}
              fatalDelta={reAuditMetrics.fatalDelta}
              warningDelta={reAuditMetrics.warningDelta}
              improved={reAudit.improved}
              regressed={reAudit.regressed}
            />
          )}
          {rewrite && (
            <RewriteComparison
              original={rewrite?.originalDraft ?? ""}
              rewritten={rewrite?.rewrittenDraft ?? ""}
            />
          )}

          {versions.length > 0 && (
            <VersionTimeline versions={versions} onSelect={setSelectedVersion} />
          )}
          {selectedVersion && (
            <VersionPreview version={selectedVersion} onRecommend={handleRecommend} />
          )}
        </div>
      </div>
    </div>
  );
}

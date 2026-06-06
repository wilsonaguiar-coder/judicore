"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AuditSummaryCard } from "../../../components/review-studio/AuditSummaryCard";
import { CorrectionPlanList } from "../../../components/review-studio/CorrectionPlanList";
import { GuidedRevisionChecklist } from "../../../components/review-studio/GuidedRevisionChecklist";
import { SuggestionPanel } from "../../../components/review-studio/SuggestionPanel";
import { RewriteComparison } from "../../../components/review-studio/RewriteComparison";
import { ReAuditMetrics } from "../../../components/review-studio/ReAuditMetrics";
import { HistoryTimeline } from "../../../components/review-studio/HistoryTimeline";
import { VersionTimeline } from "../../../components/review-studio/VersionTimeline";
import { VersionPreview } from "../../../components/review-studio/VersionPreview";
import { ReviewWorkflowStepper, WorkflowStep } from "../../../components/review-studio/ReviewWorkflowStepper";
import { AuditEntrypointCard } from "../../../components/review-studio/AuditEntrypointCard";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeSteps(
  hasAudit: boolean,
  hasSuggestion: boolean,
  hasRewrite: boolean,
  hasReAudit: boolean
): WorkflowStep[] {
  return [
    {
      id: 1,
      label: "Auditoria",
      description: "Executar auditoria jurídica",
      status: hasAudit ? "completed" : "active",
    },
    {
      id: 2,
      label: "Sugestão",
      description: "Gerar sugestão de melhoria",
      status: !hasAudit ? "pending" : hasSuggestion ? "completed" : "active",
    },
    {
      id: 3,
      label: "Reescrita",
      description: "Reescrever trecho",
      status: !hasSuggestion ? "pending" : hasRewrite ? "completed" : "active",
    },
    {
      id: 4,
      label: "Re-Audit",
      description: "Auditar nova versão",
      status: !hasRewrite ? "pending" : hasReAudit ? "completed" : "active",
    },
  ];
}

// ─── Tooltip wrapper for disabled buttons ────────────────────────────────────

function StepButton({
  id,
  label,
  onClick,
  disabled,
  disabledReason,
  colorClass,
  loading,
}: {
  id: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
  disabledReason?: string | undefined;
  colorClass: string;
  loading?: boolean | undefined;
}) {
  return (
    <div className="relative group inline-block">
      <button
        id={id}
        onClick={onClick}
        disabled={disabled}
        className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200
          ${disabled
            ? "bg-slate-300 cursor-not-allowed text-slate-500"
            : `${colorClass} active:scale-95 shadow-sm`
          }`}
      >
        {loading ? "Processando..." : label}
      </button>
      {disabled && disabledReason && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
          <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg">
            {disabledReason}
          </div>
          <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ReviewStudioPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<any>(null);
  const [rewrite, setRewrite] = useState<any>(null);
  const [reAudit, setReAudit] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [timeline, setTimeline] = useState<any>(null);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);

  // ─── Derived state ────────────────────────────────────────────────────────

  const audit = data?.audit ?? {};
  const correctionPlanItems = data?.correctionPlan?.items ?? [];
  const reAuditMetrics = reAudit?.metrics ?? {};
  const versions = timeline?.versions ?? [];

  /**
   * hasAudit: true when the audit response contains a classification or score > 0.
   * This guards all subsequent workflow steps.
   */
  const hasAudit: boolean =
    !!(audit?.classification) ||
    (typeof audit?.score === "number" && audit.score > 0);

  const hasSuggestion = !!suggestion;
  const hasRewrite = !!rewrite;
  const hasReAudit = !!reAudit;

  const steps = computeSteps(hasAudit, hasSuggestion, hasRewrite, hasReAudit);

  // ─── Data loading ─────────────────────────────────────────────────────────

  const loadData = useCallback(() => {
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
  }, [params.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleRunAudit = async () => {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/review-studio/${params.id}/audit`, {
        method: "GET",
      });
      const d = await res.json();
      setData(d ?? {});
      // Reload versions after audit
      const tv = await fetch(`/api/review-studio/${params.id}/versions`).then(r => r.json());
      setTimeline(tv ?? null);
    } catch (e) {
      console.error("Audit error:", e);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleGenerateSuggestion = async () => {
    setLoadingAction(true);
    try {
      const res = await fetch(`/api/review-studio/${params.id}/suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: "task-test-1" }),
      });
      setSuggestion((await res.json()) ?? null);
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
        body: JSON.stringify({ taskId: "task-test-1", decision }),
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
        body: JSON.stringify({ taskId: "task-test-1", suggestionStr: suggestion?.suggestion }),
      });
      setRewrite((await res.json()) ?? null);
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
          classification: "CIVIL_PETICAO_INICIAL",
        }),
      });
      setReAudit((await res.json()) ?? null);
      loadData();
    } catch (e) {
      console.error("Re-audit error:", e);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRecommend = async (versionId: string) => {
    try {
      await fetch(`/api/review-studio/${params.id}/versions/${versionId}/recommend`, { method: "POST" });
      loadData();
    } catch (e) {
      console.error("Recommend error:", e);
    }
  };

  // ─── Loading / Error screens ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-medium">Carregando Review Studio...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="bg-white border border-red-200 rounded-xl p-8 max-w-md text-center">
          <p className="font-semibold text-red-700 text-lg mb-2">Erro ao carregar</p>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <button
            onClick={loadData}
            className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors text-sm font-medium"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Review Studio</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Documento: <span className="font-mono text-slate-700">{params.id}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border
                ${hasAudit
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${hasAudit ? "bg-emerald-500" : "bg-amber-400"}`}
              />
              {hasAudit ? "Auditado" : "Aguardando auditoria"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Stepper */}
        <ReviewWorkflowStepper steps={steps} />

        {/* STEP 1: No audit yet — show entrypoint card */}
        {!hasAudit ? (
          <AuditEntrypointCard onRunAudit={handleRunAudit} loading={auditLoading} />
        ) : (
          /* MAIN LAYOUT — only when audit exists */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left column */}
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

            {/* Right column */}
            <div className="lg:col-span-2 space-y-8">
              {/* ── Workflow Actions ── */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-base font-semibold text-slate-800 mb-1">
                  {!hasSuggestion
                    ? "Passo 2 — Gerar Sugestão"
                    : !hasRewrite
                    ? "Passo 3 — Gerar Reescrita"
                    : !hasReAudit
                    ? "Passo 4 — Executar Re-Audit"
                    : "Ciclo completo ✓"}
                </h2>
                <p className="text-sm text-slate-400 mb-5">
                  {!hasSuggestion
                    ? "Auditoria concluída. Gere uma sugestão para iniciar a revisão guiada."
                    : !hasRewrite
                    ? "Sugestão disponível. Aplique a reescrita ao trecho identificado."
                    : !hasReAudit
                    ? "Nova versão disponível. Execute o Re-Audit para comparar os resultados."
                    : "O ciclo de revisão foi completado com sucesso."}
                </p>

                <div className="flex flex-wrap gap-3">
                  <StepButton
                    id="btn-suggestion"
                    label="Gerar Sugestão"
                    onClick={handleGenerateSuggestion}
                    disabled={!hasAudit || hasSuggestion || loadingAction}
                    disabledReason={
                      !hasAudit
                        ? "Execute a auditoria primeiro"
                        : hasSuggestion
                        ? "Sugestão já gerada"
                        : undefined
                    }
                    colorClass="bg-blue-600 hover:bg-blue-700"
                    loading={loadingAction && !hasSuggestion}
                  />
                  <StepButton
                    id="btn-rewrite"
                    label="Gerar Reescrita"
                    onClick={handleGenerateRewrite}
                    disabled={!hasSuggestion || hasRewrite || loadingAction}
                    disabledReason={
                      !hasAudit
                        ? "Execute a auditoria primeiro"
                        : !hasSuggestion
                        ? "Execute a auditoria primeiro"
                        : hasRewrite
                        ? "Reescrita já gerada"
                        : undefined
                    }
                    colorClass="bg-indigo-600 hover:bg-indigo-700"
                    loading={loadingAction && hasSuggestion && !hasRewrite}
                  />
                  <StepButton
                    id="btn-reaudit"
                    label="Executar Re-Audit"
                    onClick={handleReAudit}
                    disabled={!hasRewrite || hasReAudit || loadingAction}
                    disabledReason={
                      !hasAudit
                        ? "Execute a auditoria primeiro"
                        : !hasRewrite
                        ? "Gere a reescrita primeiro"
                        : hasReAudit
                        ? "Re-Audit já executado"
                        : undefined
                    }
                    colorClass="bg-emerald-600 hover:bg-emerald-700"
                    loading={loadingAction && hasRewrite && !hasReAudit}
                  />
                </div>

                {loadingAction && (
                  <p className="mt-4 text-sm text-slate-400 flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                    Processando com a IA...
                  </p>
                )}
              </div>

              {/* ── Guided Revision + Suggestion ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GuidedRevisionChecklist
                  tasks={[{ id: "task-test-1", instruction: "Ajustar contradição.", completed: hasSuggestion }]}
                />
                {hasSuggestion && (
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

              {/* ── Rewrite Comparison ── */}
              {hasRewrite && (
                <RewriteComparison
                  original={rewrite?.originalDraft ?? ""}
                  rewritten={rewrite?.rewrittenDraft ?? ""}
                />
              )}

              {/* ── Re-Audit Metrics ── */}
              {hasReAudit && (
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

              {/* ── Version Timeline ── */}
              {versions.length > 0 && (
                <VersionTimeline versions={versions} onSelect={setSelectedVersion} />
              )}
              {selectedVersion && (
                <VersionPreview version={selectedVersion} onRecommend={handleRecommend} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

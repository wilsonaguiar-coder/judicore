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

const DEMO_ID = "teste-1";

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

// ─── Tooltip-aware disabled button ───────────────────────────────────────────

function StepButton({
  id,
  label,
  onClick,
  disabled,
  disabledReason,
  colorClass,
  loading,
  loadingLabel,
}: {
  id: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
  disabledReason?: string | undefined;
  colorClass: string;
  loading?: boolean | undefined;
  loadingLabel?: string | undefined;
}) {
  return (
    <div className="relative group inline-block">
      <button
        id={id}
        onClick={onClick}
        disabled={disabled}
        className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
          ${disabled
            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
            : `${colorClass} text-white active:scale-95 shadow-sm`
          }`}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {loadingLabel ?? "Processando..."}
          </span>
        ) : label}
      </button>
      {disabled && disabledReason && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
          <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg">
            {disabledReason}
          </div>
          <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </div>
  );
}

// ─── Guided step prompt card ──────────────────────────────────────────────────

function GuidedPrompt({ step, message, children }: { step: number; message: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
      <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {step}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-blue-800 font-medium mb-3">{message}</p>
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReviewStudioPage({ params }: { params: { id: string } }) {
  const isDemo = params.id === DEMO_ID;

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
  const [decisionStatus, setDecisionStatus] = useState<string | null>(null);
  const [decisionLoading, setDecisionLoading] = useState<string | null>(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  // ─── Derived state ────────────────────────────────────────────────────────

  const audit = data?.audit ?? {};
  const correctionPlanItems = data?.correctionPlan?.items ?? [];
  const reAuditMetrics = reAudit?.metrics ?? {};
  const versions = timeline?.versions ?? [];

  /**
   * hasAudit: true when audit contains a classification OR score > 0.
   */
  const hasAudit: boolean =
    !!(audit?.classification) ||
    (typeof audit?.score === "number" && audit.score > 0);

  const hasSuggestion = !!suggestion;
  const hasRewrite = !!rewrite;
  const hasReAudit = !!reAudit;

  const fatalCount: number = (audit?.fatalErrors ?? []).length;
  const warningCount: number = (audit?.nonFatalErrors ?? []).length;

  const steps = computeSteps(hasAudit, hasSuggestion, hasRewrite, hasReAudit);

  // ─── Data loading ─────────────────────────────────────────────────────────

  const loadVersions = useCallback(async () => {
    try {
      const t = await fetch(`/api/review-studio/${params.id}/versions`).then(r => r.json());
      setTimeline(t ?? null);
    } catch { /* non-fatal */ }
  }, [params.id]);

  const loadData = useCallback(() => {
    setError(null);
    // GET: read existing audit (no trigger)
    fetch(`/api/review-studio/${params.id}/audit`)
      .then(res => res.json())
      .then(d => {
        setData(d ?? {});
        return loadVersions();
      })
      .then(() => setLoading(false))
      .catch(err => {
        console.error("Review Studio load error:", err);
        setError("Erro ao carregar dados. Tente novamente.");
        setData({});
        setLoading(false);
      });
  }, [params.id, loadVersions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  /**
   * Trigger audit via POST — works for demo and real docs.
   */
  const handleRunAudit = async () => {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/review-studio/${params.id}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // backend picks up demo draft automatically
      });
      const d = await res.json();
      setData(d ?? {});
      await loadVersions();
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
    if (decisionStatus || decisionLoading) return;
    setDecisionLoading(decision);
    try {
      const ruleCode = suggestion?.code ?? suggestion?.ruleCode ?? "UNKNOWN";
      const res = await fetch(`/api/review-studio/${params.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: "task-test-1", ruleCode, decision }),
      });
      if (!res.ok) throw new Error(`Decision failed: ${res.status}`);
      const d = await res.json();
      setDecisionStatus(d?.decision?.status ?? decision);
    } catch (e) {
      console.error("Decision error:", e);
    } finally {
      setDecisionLoading(null);
    }
  };

  const handleGenerateRewrite = async () => {
    if (!suggestion || decisionStatus !== "APPROVED") return;
    setRewriteLoading(true);
    setRewriteError(null);
    try {
      const res = await fetch(`/api/review-studio/${params.id}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: suggestion.taskId ?? "task-test-1",
          provider: "DEEPSEEK",
          task: {
            id: suggestion.taskId ?? "task-test-1",
            code: suggestion.code ?? suggestion.ruleCode ?? "UNADDRESSED_MAIN_REQUEST",
            priority: "HIGH",
            area: "MÉRITO",
            instruction: suggestion.instruction ?? "Resolver a contradição",
          },
          suggestion: {
            taskId: suggestion.taskId ?? "task-test-1",
            code: suggestion.code ?? suggestion.ruleCode ?? "UNADDRESSED_MAIN_REQUEST",
            instruction: suggestion.instruction ?? "",
            suggestion: suggestion.suggestion ?? "",
            riskLevel: suggestion.riskLevel ?? "HIGH",
            requiresHumanReview: true,
          },
        }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Resposta inesperada do servidor: ${text.slice(0, 120)}`);
      }
      const d = await res.json();
      if (!res.ok) {
        throw new Error(d?.error ?? `Erro ${res.status}`);
      }
      setRewrite(d ?? null);
      await loadVersions();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar reescrita.";
      console.error("Rewrite error:", msg);
      setRewriteError(msg);
    } finally {
      setRewriteLoading(false);
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

  // ─── Loading / Error ──────────────────────────────────────────────────────

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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Review Studio</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Documento:{" "}
              <span className="font-mono text-slate-700">{params.id}</span>
              {isDemo && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 border border-violet-200 rounded-full text-xs font-semibold">
                  🎭 DEMO
                </span>
              )}
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
              <span className={`w-1.5 h-1.5 rounded-full ${hasAudit ? "bg-emerald-500 animate-none" : "bg-amber-400 animate-pulse"}`} />
              {hasAudit ? "Auditado" : "Aguardando auditoria"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Demo banner */}
        {isDemo && (
          <div className="mb-6 flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-xl px-5 py-4">
            <span className="text-xl flex-shrink-0 mt-0.5">🎭</span>
            <div>
              <p className="text-sm font-semibold text-violet-800">Modo demonstração ativo</p>
              <p className="text-xs text-violet-600 mt-0.5">
                Este documento é fictício. Contém contradição deliberada (dano moral) e omissão de nexo causal para demonstração do JudiAudit.
              </p>
            </div>
          </div>
        )}

        {/* Stepper */}
        <ReviewWorkflowStepper steps={steps} />

        {/* STEP 1: No audit yet */}
        {!hasAudit ? (
          <AuditEntrypointCard onRunAudit={handleRunAudit} loading={auditLoading} />
        ) : (
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
            <div className="lg:col-span-2 space-y-6">
              {/* ── Guided Prompt ── */}
              {!hasSuggestion && (
                <GuidedPrompt
                  step={2}
                  message={
                    fatalCount + warningCount > 0
                      ? `Foram encontrados ${fatalCount} erro(s) fatal(is) e ${warningCount} alerta(s). Gere uma sugestão para iniciar a revisão guiada.`
                      : "Auditoria concluída. Gere uma sugestão para iniciar a revisão guiada."
                  }
                >
                  <StepButton
                    id="btn-suggestion"
                    label="Gerar Sugestão"
                    onClick={handleGenerateSuggestion}
                    disabled={loadingAction}
                    colorClass="bg-blue-600 hover:bg-blue-700"
                    loading={loadingAction}
                  />
                </GuidedPrompt>
              )}

              {hasSuggestion && !hasRewrite && (
                <GuidedPrompt
                  step={3}
                  message={
                    decisionStatus === "APPROVED"
                      ? "Sugestão aprovada. Aplique a reescrita ao trecho identificado."
                      : "Aprove a sugestão antes de gerar a reescrita."
                  }
                >
                  <StepButton
                    id="btn-rewrite"
                    label="Gerar Reescrita"
                    onClick={handleGenerateRewrite}
                    disabled={rewriteLoading || decisionStatus !== "APPROVED"}
                    disabledReason={decisionStatus !== "APPROVED" ? "Aprove uma sugestão antes de gerar reescrita." : undefined}
                    colorClass="bg-indigo-600 hover:bg-indigo-700"
                    loading={rewriteLoading}
                    loadingLabel="Gerando reescrita..."
                  />
                </GuidedPrompt>
              )}

              {hasRewrite && !hasReAudit && (
                <GuidedPrompt step={4} message="Nova versão criada. Execute o Re-Audit para comparar os resultados.">
                  <StepButton
                    id="btn-reaudit"
                    label="Executar Re-Audit"
                    onClick={handleReAudit}
                    disabled={loadingAction}
                    colorClass="bg-emerald-600 hover:bg-emerald-700"
                    loading={loadingAction}
                  />
                </GuidedPrompt>
              )}

              {hasReAudit && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <p className="text-sm font-semibold text-emerald-800">Ciclo completo — todas as etapas concluídas.</p>
                </div>
              )}

              {/* ── All step buttons overview (collapsed/disabled state) ── */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Ações do Estúdio</h2>
                <div className="flex flex-wrap gap-3">
                  <StepButton
                    id="btn-suggestion-panel"
                    label="Gerar Sugestão"
                    onClick={handleGenerateSuggestion}
                    disabled={!hasAudit || hasSuggestion || loadingAction}
                    disabledReason={
                      !hasAudit ? "Execute a auditoria primeiro"
                        : hasSuggestion ? "Sugestão já gerada"
                        : undefined
                    }
                    colorClass="bg-blue-600 hover:bg-blue-700"
                  />
                  <StepButton
                    id="btn-rewrite-panel"
                    label="Gerar Reescrita"
                    onClick={handleGenerateRewrite}
                    disabled={!hasSuggestion || hasRewrite || rewriteLoading || decisionStatus !== "APPROVED"}
                    disabledReason={
                      !hasAudit ? "Execute a auditoria primeiro"
                        : !hasSuggestion ? "Gere a sugestão primeiro"
                        : decisionStatus !== "APPROVED" ? "Aprove uma sugestão antes de gerar reescrita"
                        : hasRewrite ? "Reescrita já gerada"
                        : undefined
                    }
                    colorClass="bg-indigo-600 hover:bg-indigo-700"
                    loading={rewriteLoading}
                    loadingLabel="Gerando reescrita..."
                  />
                  <StepButton
                    id="btn-reaudit-panel"
                    label="Executar Re-Audit"
                    onClick={handleReAudit}
                    disabled={!hasRewrite || hasReAudit || loadingAction}
                    disabledReason={
                      !hasAudit ? "Execute a auditoria primeiro"
                        : !hasRewrite ? "Gere a reescrita primeiro"
                        : hasReAudit ? "Re-Audit já executado"
                        : undefined
                    }
                    colorClass="bg-emerald-600 hover:bg-emerald-700"
                  />
                </div>
                {(loadingAction || rewriteLoading) && (
                  <p className="mt-4 text-sm text-slate-400 flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                    {rewriteLoading ? "Gerando reescrita com a IA..." : "Processando com a IA..."}
                  </p>
                )}
              </div>

              {/* ── Guided Revision + Suggestion Panel ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GuidedRevisionChecklist
                  tasks={[
                    {
                      id: "task-test-1",
                      instruction: "Corrigir contradição entre fundamentação e dispositivo.",
                      completed: decisionStatus === "APPROVED",
                    },
                  ]}
                />
                {hasSuggestion && (
                  <SuggestionPanel
                    ruleCode={suggestion?.code ?? suggestion?.ruleCode ?? "UNKNOWN"}
                    suggestion={suggestion?.suggestion ?? "Nenhuma sugestão"}
                    provider={suggestion?.provider ?? "DEEPSEEK"}
                    decisionStatus={decisionStatus}
                    decisionLoading={decisionLoading}
                    onApprove={() => handleDecision("APPROVED")}
                    onReject={() => handleDecision("REJECTED")}
                    onSkip={() => handleDecision("SKIPPED")}
                  />
                )}
              </div>

              {/* ── Rewrite error ── */}
              {rewriteError && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
                  <span className="text-red-500 text-lg flex-shrink-0">✗</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-800">Erro ao gerar reescrita</p>
                    <p className="text-xs text-red-600 mt-0.5 break-words">{rewriteError}</p>
                  </div>
                  <button onClick={() => setRewriteError(null)} className="text-red-400 hover:text-red-600 text-xs flex-shrink-0">✕</button>
                </div>
              )}

              {/* ── Rewrite ── */}
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

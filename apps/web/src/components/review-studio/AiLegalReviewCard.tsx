"use client";

import React, { useState } from "react";

// ── Tipos locais ──────────────────────────────────────────────────────────────

type OpportunityLevel = "IMPACTFUL" | "COMPLEMENTARY" | "OPTIONAL";
type StrengthFindingType =
  | "MISSING_DEMONSTRATION"
  | "MISSING_COMPARATIVE_TABLE"
  | "MISSING_CALCULATION"
  | "MISSING_SUPPORTING_DOCUMENT"
  | "MISSING_DATE_ANCHOR"
  | "MISSING_LEGAL_ANCHOR"
  | "UNUSED_EXTRACTED_DATA"
  | "FACTUAL_ENRICHMENT_OPPORTUNITY"
  | "STRENGTHEN_ARGUMENT"
  | "ANTICIPATE_COUNTERARGUMENT"
  | "WEAK_FACTUAL_FOUNDATION";

interface StrengthFinding {
  id: string;
  type: StrengthFindingType;
  opportunity: OpportunityLevel;
  title: string;
  rationale: string;
  evidenceFromText: string[];
  suggestion: string;
  availableSource?: string;
  confidence: number;
  requiresHumanReview: true;
}

interface StrengthReviewResult {
  findings: StrengthFinding[];
  summary: string;
  provider: string;
  model: string;
  generatedAt: string;
  requiresHumanReview: true;
}

interface Props {
  result: StrengthReviewResult | null;
  loading?: boolean;
  /** ID do documento — usado para enviar feedback ao endpoint correto. */
  domain?: string;
}

// ── Estilos e rótulos por OpportunityLevel ─────────────────────────────────

const OPPORTUNITY_STYLE: Record<OpportunityLevel, string> = {
  IMPACTFUL:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  COMPLEMENTARY: "bg-blue-100 text-blue-700 border-blue-200",
  OPTIONAL:      "bg-slate-100 text-slate-600 border-slate-200",
};

const OPPORTUNITY_LABEL: Record<OpportunityLevel, string> = {
  IMPACTFUL:     "Impactante",
  COMPLEMENTARY: "Complementar",
  OPTIONAL:      "Opcional",
};

const OPPORTUNITY_ICON: Record<OpportunityLevel, string> = {
  IMPACTFUL:     "▲",
  COMPLEMENTARY: "◆",
  OPTIONAL:      "●",
};

const TYPE_LABEL: Record<StrengthFindingType, string> = {
  MISSING_DEMONSTRATION:          "Demonstração pode ser reforçada",
  MISSING_COMPARATIVE_TABLE:      "Quadro comparativo sugerido",
  MISSING_CALCULATION:            "Cálculo pode fortalecer a tese",
  MISSING_SUPPORTING_DOCUMENT:    "Documento de suporte sugerido",
  MISSING_DATE_ANCHOR:            "Ancoragem temporal sugerida",
  MISSING_LEGAL_ANCHOR:           "Fundamento normativo pode ser explicitado",
  UNUSED_EXTRACTED_DATA:          "Dado disponível não aproveitado",
  FACTUAL_ENRICHMENT_OPPORTUNITY: "Enriquecimento fático sugerido",
  STRENGTHEN_ARGUMENT:            "Argumento pode ser reforçado",
  ANTICIPATE_COUNTERARGUMENT:     "Antecipação de argumento contrário",
  WEAK_FACTUAL_FOUNDATION:        "Base fática pode ser robustecida",
};

// ── Hook de feedback ──────────────────────────────────────────────────────────

type FeedbackState = "idle" | "USEFUL" | "NOT_USEFUL" | "loading" | "done";

function useFindingFeedback(finding: StrengthFinding, domain?: string) {
  const [state, setState] = useState<FeedbackState>("idle");

  const send = async (feedback: "USEFUL" | "NOT_USEFUL") => {
    if (state !== "idle") return;
    setState("loading");
    try {
      await fetch("/api/review-studio/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingId: finding.id,
          findingType: finding.type,
          opportunityLevel: finding.opportunity,
          domain,
          feedback,
        }),
      });
      setState("done");
    } catch {
      setState("idle"); // permite nova tentativa em caso de erro de rede
    }
  };

  return { state, send };
}

// ── Card de feedback inline ───────────────────────────────────────────────────

function FeedbackRow({ finding, domain }: { finding: StrengthFinding; domain?: string }) {
  const { state, send } = useFindingFeedback(finding, domain);

  if (state === "done") {
    return (
      <p className="text-xs text-slate-400 italic">Obrigado pelo feedback.</p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">Esta sugestão foi útil?</span>
      <button
        onClick={() => send("USEFUL")}
        disabled={state === "loading"}
        className="text-sm px-2 py-0.5 rounded-lg border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 transition-colors disabled:opacity-40"
        title="Útil"
      >
        👍
      </button>
      <button
        onClick={() => send("NOT_USEFUL")}
        disabled={state === "loading"}
        className="text-sm px-2 py-0.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-40"
        title="Não útil"
      >
        👎
      </button>
      {state === "loading" && (
        <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
      )}
    </div>
  );
}

// ── Card individual de oportunidade ──────────────────────────────────────────

function OpportunityCard({ finding, domain }: { finding: StrengthFinding; domain?: string }) {
  const [expanded, setExpanded] = useState(false);
  const oppStyle = OPPORTUNITY_STYLE[finding.opportunity] ?? OPPORTUNITY_STYLE["OPTIONAL"];

  return (
    <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <span className={`mt-0.5 flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${oppStyle}`}>
          <span>{OPPORTUNITY_ICON[finding.opportunity]}</span>
          {OPPORTUNITY_LABEL[finding.opportunity]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{finding.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{TYPE_LABEL[finding.type] ?? finding.type}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-400">{Math.round(finding.confidence * 100)}%</span>
          <span className="text-slate-400 text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-700">{finding.rationale}</p>

          {finding.evidenceFromText.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Trecho da peça
              </p>
              <ul className="space-y-1">
                {finding.evidenceFromText.map((ev, i) => (
                  <li key={i} className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 italic">
                    "{ev}"
                  </li>
                ))}
              </ul>
            </div>
          )}

          {finding.availableSource && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <span className="text-blue-500 flex-shrink-0 mt-0.5 text-sm">📄</span>
              <div>
                <p className="text-xs font-semibold text-blue-700 mb-0.5">Fonte disponível</p>
                <p className="text-xs text-blue-700">{finding.availableSource}</p>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Sugestão de fortalecimento
            </p>
            <p className="text-sm text-slate-700">{finding.suggestion}</p>
          </div>

          {/* Badge + feedback */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
              ⚠ Revisão Humana Necessária
            </span>
            <FeedbackRow finding={finding} {...(domain !== undefined ? { domain } : {})} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card principal — Relatório de Fortalecimento ──────────────────────────────

export function AiLegalReviewCard({ result, loading, domain }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm text-slate-500">Analisando oportunidades de fortalecimento com IA...</p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const impactful     = result.findings.filter(f => f.opportunity === "IMPACTFUL").length;
  const complementary = result.findings.filter(f => f.opportunity === "COMPLEMENTARY").length;
  const optional      = result.findings.filter(f => f.opportunity === "OPTIONAL").length;

  return (
    <div className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-emerald-100 bg-emerald-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-emerald-900">
              Relatório de Fortalecimento
            </h3>
            <p className="text-xs text-emerald-700 mt-0.5">{result.summary}</p>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold flex-shrink-0">
            ⚠ Revisão Humana Necessária
          </span>
        </div>

        {result.findings.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            {impactful > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                ▲ {impactful} impactante{impactful > 1 ? "s" : ""}
              </span>
            )}
            {complementary > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                ◆ {complementary} complementar{complementary > 1 ? "es" : ""}
              </span>
            )}
            {optional > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                ● {optional} opcional{optional > 1 ? "is" : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Findings */}
      <div className="p-4 space-y-3">
        {result.findings.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
            <span className="text-emerald-500 text-base">✓</span>
            Peça sólida — nenhuma oportunidade de fortalecimento identificada.
          </div>
        ) : (
          result.findings.map(f => <OpportunityCard key={f.id} finding={f} {...(domain !== undefined ? { domain } : {})} />)
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center gap-1.5 text-xs text-slate-400">
        <span>Analisado por</span>
        <span className="font-medium text-slate-500">{result.provider}</span>
        <span>·</span>
        <span>{result.model}</span>
      </div>
    </div>
  );
}

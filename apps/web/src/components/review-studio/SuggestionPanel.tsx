import React from "react";
import { Check, X, SkipForward, Bot, Loader2 } from "lucide-react";

type DecisionValue = "APPROVED" | "REJECTED" | "SKIPPED";

interface SuggestionPanelProps {
  ruleCode: string;
  suggestion: string;
  provider: string;
  decisionStatus?: string | null;
  decisionLoading?: string | null;
  onApprove?: () => void;
  onReject?: () => void;
  onSkip?: () => void;
}

const BADGE: Record<string, { label: string; className: string }> = {
  APPROVED: { label: "APPROVED", className: "bg-green-100 text-green-800 border-green-200" },
  REJECTED: { label: "REJECTED", className: "bg-red-100 text-red-800 border-red-200" },
  SKIPPED:  { label: "SKIPPED",  className: "bg-slate-100 text-slate-600 border-slate-200" },
};

export function SuggestionPanel({
  ruleCode,
  suggestion,
  provider,
  decisionStatus,
  decisionLoading,
  onApprove,
  onReject,
  onSkip,
}: SuggestionPanelProps) {
  const decided = !!decisionStatus;
  const badge = decisionStatus ? BADGE[decisionStatus] : null;

  function renderButton(
    value: DecisionValue,
    label: string,
    icon: React.ReactNode,
    onClick: (() => void) | undefined,
    colorClass: string,
  ) {
    const isLoading = decisionLoading === value;
    return (
      <button
        onClick={onClick}
        disabled={decided || !!decisionLoading}
        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors
          ${decided || decisionLoading
            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
            : colorClass
          }`}
      >
        {isLoading
          ? <><Loader2 size={16} className="animate-spin" /> Processando...</>
          : <>{icon} {label}</>
        }
      </button>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm border-blue-200">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-blue-900">AI Suggestion</h2>
          {badge && (
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-100">
          <Bot size={14} />
          {provider}
        </div>
      </div>

      <div className="mb-4">
        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded mb-2 inline-block">
          {ruleCode}
        </span>
        <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded border">
          {suggestion}
        </p>
      </div>

      <div className="flex gap-3 mt-6">
        {renderButton(
          "APPROVED",
          "Approve",
          <Check size={16} />,
          onApprove,
          "bg-green-600 hover:bg-green-700 text-white",
        )}
        {renderButton(
          "REJECTED",
          "Reject",
          <X size={16} />,
          onReject,
          "bg-red-100 hover:bg-red-200 text-red-700",
        )}
        {renderButton(
          "SKIPPED",
          "Skip",
          <SkipForward size={16} />,
          onSkip,
          "bg-slate-100 hover:bg-slate-200 text-slate-700",
        )}
      </div>
    </div>
  );
}

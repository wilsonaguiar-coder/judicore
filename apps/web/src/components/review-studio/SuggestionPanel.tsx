import React from "react";
import { Check, X, SkipForward, Bot } from "lucide-react";

interface SuggestionPanelProps {
  ruleCode: string;
  suggestion: string;
  provider: string;
  onApprove?: () => void;
  onReject?: () => void;
  onSkip?: () => void;
}

export function SuggestionPanel({ ruleCode, suggestion, provider, onApprove, onReject, onSkip }: SuggestionPanelProps) {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm border-blue-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-blue-900">AI Suggestion</h2>
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
        <button 
          onClick={onApprove}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
        >
          <Check size={16} /> Approve
        </button>
        <button 
          onClick={onReject}
          className="flex-1 flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 py-2 px-4 rounded-md text-sm font-medium transition-colors"
        >
          <X size={16} /> Reject
        </button>
        <button 
          onClick={onSkip}
          className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-4 rounded-md text-sm font-medium transition-colors"
        >
          <SkipForward size={16} /> Skip
        </button>
      </div>
    </div>
  );
}

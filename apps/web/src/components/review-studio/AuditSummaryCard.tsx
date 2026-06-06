import React from "react";
import { AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";

interface AuditSummaryProps {
  score?: number | null;
  classification?: string | null;
  fatalErrors?: any[] | null;
  nonFatalErrors?: any[] | null;
  strengths?: any[] | null;
}

export function AuditSummaryCard({ score, classification, fatalErrors, nonFatalErrors, strengths }: AuditSummaryProps) {
  const safeScore = score ?? 0;
  const safeClassification = classification ?? "—";
  const safeFatalErrors = fatalErrors ?? [];
  const safeNonFatalErrors = nonFatalErrors ?? [];
  const safeStrengths = strengths ?? [];

  const empty = safeFatalErrors.length === 0 && safeNonFatalErrors.length === 0 && safeStrengths.length === 0;

  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Audit Summary</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-50 p-4 rounded-md">
          <p className="text-sm text-slate-500 font-medium">Technical Score</p>
          <p className="text-3xl font-bold text-slate-800">{safeScore}/100</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-md">
          <p className="text-sm text-slate-500 font-medium">Classification</p>
          <p className="text-lg font-semibold text-slate-800">{safeClassification}</p>
        </div>
      </div>

      <div className="space-y-4">
        {safeFatalErrors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <ShieldAlert size={18} />
              <h3 className="font-semibold text-sm">Fatal Errors ({safeFatalErrors.length})</h3>
            </div>
            <ul className="text-sm space-y-2">
              {safeFatalErrors.map((e: any, i: number) => (
                <li key={i} className="bg-red-50 text-red-800 px-3 py-2 rounded border border-red-100">
                  {e?.titulo ?? e?.message ?? JSON.stringify(e)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {safeNonFatalErrors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <AlertTriangle size={18} />
              <h3 className="font-semibold text-sm">Warnings ({safeNonFatalErrors.length})</h3>
            </div>
            <ul className="text-sm space-y-2">
              {safeNonFatalErrors.map((e: any, i: number) => (
                <li key={i} className="bg-amber-50 text-amber-800 px-3 py-2 rounded border border-amber-100">
                  {e?.titulo ?? e?.message ?? JSON.stringify(e)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {safeStrengths.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <CheckCircle size={18} />
              <h3 className="font-semibold text-sm">Strengths ({safeStrengths.length})</h3>
            </div>
            <ul className="text-sm space-y-2">
              {safeStrengths.map((e: any, i: number) => (
                <li key={i} className="bg-green-50 text-green-800 px-3 py-2 rounded border border-green-100">
                  {e?.titulo ?? e?.message ?? JSON.stringify(e)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {empty && (
          <p className="text-sm text-slate-400 italic">Aguardando auditoria.</p>
        )}
      </div>
    </div>
  );
}

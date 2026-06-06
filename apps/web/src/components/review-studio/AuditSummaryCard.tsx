import React from "react";
import { AlertTriangle, CheckCircle, ShieldAlert, Zap } from "lucide-react";

interface AuditSummaryProps {
  score: number;
  classification: string;
  fatalErrors: any[];
  nonFatalErrors: any[];
  strengths: any[];
}

export function AuditSummaryCard({ score, classification, fatalErrors, nonFatalErrors, strengths }: AuditSummaryProps) {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Audit Summary</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-50 p-4 rounded-md">
          <p className="text-sm text-slate-500 font-medium">Technical Score</p>
          <p className="text-3xl font-bold text-slate-800">{score}/100</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-md">
          <p className="text-sm text-slate-500 font-medium">Classification</p>
          <p className="text-lg font-semibold text-slate-800">{classification}</p>
        </div>
      </div>

      <div className="space-y-4">
        {fatalErrors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <ShieldAlert size={18} />
              <h3 className="font-semibold text-sm">Fatal Errors ({fatalErrors.length})</h3>
            </div>
            <ul className="text-sm space-y-2">
              {fatalErrors.map((e, i) => <li key={i} className="bg-red-50 text-red-800 px-3 py-2 rounded border border-red-100">{e.titulo}</li>)}
            </ul>
          </div>
        )}

        {nonFatalErrors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <AlertTriangle size={18} />
              <h3 className="font-semibold text-sm">Warnings ({nonFatalErrors.length})</h3>
            </div>
            <ul className="text-sm space-y-2">
              {nonFatalErrors.map((e, i) => <li key={i} className="bg-amber-50 text-amber-800 px-3 py-2 rounded border border-amber-100">{e.titulo}</li>)}
            </ul>
          </div>
        )}

        {strengths.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <CheckCircle size={18} />
              <h3 className="font-semibold text-sm">Strengths ({strengths.length})</h3>
            </div>
            <ul className="text-sm space-y-2">
              {strengths.map((e, i) => <li key={i} className="bg-green-50 text-green-800 px-3 py-2 rounded border border-green-100">{e.titulo}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

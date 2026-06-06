import React from "react";
import { ScanSearch, Loader2 } from "lucide-react";

interface AuditEntrypointCardProps {
  onRunAudit: () => void;
  loading: boolean;
}

export function AuditEntrypointCard({ onRunAudit, loading }: AuditEntrypointCardProps) {
  return (
    <div className="col-span-full flex items-center justify-center py-12">
      <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-10 max-w-lg w-full text-center shadow-sm hover:border-blue-400 hover:shadow-md transition-all duration-300">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
            <ScanSearch size={32} className="text-blue-500" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Nenhuma auditoria encontrada
        </h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Este documento ainda não foi analisado pelo <span className="font-semibold text-blue-600">JudiAudit</span>.<br />
          Clique abaixo para executar a primeira auditoria.
        </p>

        <button
          id="btn-run-audit"
          onClick={onRunAudit}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 shadow-sm shadow-blue-200 text-sm"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Executando Auditoria...
            </>
          ) : (
            <>
              <ScanSearch size={16} />
              Executar Auditoria
            </>
          )}
        </button>
      </div>
    </div>
  );
}

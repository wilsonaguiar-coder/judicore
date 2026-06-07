"use client";

import { AlertCircle, Target } from "lucide-react";

interface QuotaCardProps {
  used: number;
  total: number;
  daysToRenew: number;
}

export function QuotaCard({ used, total, daysToRenew }: QuotaCardProps) {
  const percentage = Math.min(Math.round((used / total) * 100), 100);
  const isDanger = percentage >= 100;
  const isWarning = percentage >= 80 && !isDanger;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-600/10 text-violet-600 flex items-center justify-center">
            <Target size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Cota de Peças</h3>
            <p className="text-xs text-slate-500">Ciclo de assinatura</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-800">
            {used} / {total}
          </p>
          <p className="text-xs text-slate-500">peças utilizadas</p>
        </div>
      </div>

      <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            isDanger ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-violet-600"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className={isDanger ? "text-red-600 font-medium" : "text-slate-500"}>
          {percentage}% consumido
        </span>
        <span className="text-slate-500">
          Renovação em {daysToRenew} {daysToRenew === 1 ? "dia" : "dias"}
        </span>
      </div>

      {isDanger && (
        <div className="mt-4 flex items-start gap-2 bg-red-50 text-red-800 p-3 rounded-lg text-xs">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <p>Você atingiu o limite de peças do seu plano neste ciclo. Aguarde a renovação ou realize upgrade.</p>
        </div>
      )}
    </div>
  );
}

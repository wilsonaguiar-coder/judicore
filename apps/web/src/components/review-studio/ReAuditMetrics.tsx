import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ReAuditMetricsProps {
  scoreBefore?: number | null;
  scoreAfter?: number | null;
  scoreDelta?: number | null;
  fatalDelta?: number | null;
  warningDelta?: number | null;
  improved?: boolean | null;
  regressed?: boolean | null;
}

export function ReAuditMetrics({
  scoreBefore,
  scoreAfter,
  scoreDelta,
  fatalDelta,
  warningDelta,
  improved,
  regressed
}: ReAuditMetricsProps) {
  const sb = scoreBefore ?? 0;
  const sa = scoreAfter ?? 0;
  const sd = scoreDelta ?? 0;
  const fd = fatalDelta ?? 0;
  const wd = warningDelta ?? 0;
  const isImproved = improved ?? false;
  const isRegressed = regressed ?? false;

  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Re-Audit Result</h2>
        <div className="flex gap-2">
          {isImproved && (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1 border border-green-200">
              <TrendingUp size={14} /> Improved
            </span>
          )}
          {isRegressed && (
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1 border border-red-200">
              <TrendingDown size={14} /> Regressed
            </span>
          )}
          {!isImproved && !isRegressed && (
            <span className="px-3 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1 border border-slate-200">
              <Minus size={14} /> Neutral
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="bg-slate-50 p-4 rounded-md col-span-2 flex items-center justify-between">
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Before</p>
            <p className="text-2xl font-bold text-slate-400">{sb}</p>
          </div>
          <div className="text-slate-300">→</div>
          <div className="text-center">
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">After</p>
            <p className="text-3xl font-bold text-blue-700">{sa}</p>
          </div>
        </div>
        
        <div className="bg-slate-50 p-4 rounded-md text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Score Δ</p>
          <p className={`text-xl font-bold ${sd > 0 ? 'text-green-600' : sd < 0 ? 'text-red-600' : 'text-slate-600'}`}>
            {sd > 0 ? '+' : ''}{sd}
          </p>
        </div>
        
        <div className="bg-slate-50 p-4 rounded-md text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Fatal Δ</p>
          <p className={`text-xl font-bold ${fd < 0 ? 'text-green-600' : fd > 0 ? 'text-red-600' : 'text-slate-600'}`}>
            {fd > 0 ? '+' : ''}{fd}
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-md text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Warning Δ</p>
          <p className={`text-xl font-bold ${wd < 0 ? 'text-green-600' : wd > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
            {wd > 0 ? '+' : ''}{wd}
          </p>
        </div>
      </div>
    </div>
  );
}

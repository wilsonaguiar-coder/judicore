import React from "react";

interface RewriteComparisonProps {
  original: string;
  rewritten: string;
}

export function RewriteComparison({ original, rewritten }: RewriteComparisonProps) {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm col-span-full">
      <h2 className="text-xl font-semibold mb-4">Rewrite Viewer</h2>
      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col h-[500px]">
          <div className="bg-slate-100 py-2 px-4 text-sm font-medium text-slate-600 rounded-t-md border-t border-x border-slate-200">
            Original Draft
          </div>
          <div className="bg-slate-50 p-4 border border-slate-200 rounded-b-md flex-1 overflow-auto text-sm text-slate-700 whitespace-pre-wrap">
            {original}
          </div>
        </div>
        <div className="flex flex-col h-[500px]">
          <div className="bg-blue-100 py-2 px-4 text-sm font-medium text-blue-800 rounded-t-md border-t border-x border-blue-200 flex justify-between">
            <span>Rewritten Draft</span>
            <span className="text-xs bg-blue-200 px-2 py-0.5 rounded text-blue-900">Read-Only</span>
          </div>
          <div className="bg-white p-4 border border-blue-200 rounded-b-md flex-1 overflow-auto text-sm text-slate-800 whitespace-pre-wrap shadow-inner">
            {rewritten}
          </div>
        </div>
      </div>
    </div>
  );
}

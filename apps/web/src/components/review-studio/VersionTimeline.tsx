import React from "react";

export function VersionTimeline({ versions, onSelect }: { versions?: any[] | null, onSelect: (v: any) => void }) {
  const safeVersions = versions ?? [];

  if (safeVersions.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
      <h2 className="text-xl font-bold mb-4">Versões da Peça</h2>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {safeVersions.map((v: any, i: number) => (
          <button
            key={v?.id ?? i}
            onClick={() => onSelect(v)}
            className={`flex-shrink-0 px-4 py-2 border rounded-lg hover:bg-gray-100 ${v?.isRecommended ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
          >
            <div className="font-semibold">V{v?.versionNumber ?? i + 1} ({v?.sourceType ?? "—"})</div>
            {v?.isRecommended && <div className="text-xs text-green-600 font-bold">★ Recomendada</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

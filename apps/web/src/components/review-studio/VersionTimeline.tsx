export function VersionTimeline({ versions, onSelect }: { versions: any[], onSelect: (v: any) => void }) {
  if (!versions || versions.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
      <h2 className="text-xl font-bold mb-4">Vers\u00F5es da Pe\u00E7a</h2>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {versions.map((v: any) => (
          <button
            key={v.id}
            onClick={() => onSelect(v)}
            className={`flex-shrink-0 px-4 py-2 border rounded-lg hover:bg-gray-100 ${v.isRecommended ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
          >
            <div className="font-semibold">V{v.versionNumber} ({v.sourceType})</div>
            {v.isRecommended && <div className="text-xs text-green-600 font-bold">\u2605 Recomendada</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

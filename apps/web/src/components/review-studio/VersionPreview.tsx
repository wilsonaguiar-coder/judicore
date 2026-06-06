export function VersionPreview({ version, onRecommend }: { version: any, onRecommend: (id: string) => void }) {
  if (!version) return null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Visualizar Vers\u00E3o {version.versionNumber}</h2>
        {!version.isRecommended && (
          <button 
            onClick={() => onRecommend(version.id)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Marcar como Recomendada
          </button>
        )}
      </div>
      <div className="p-4 bg-gray-50 border rounded-lg whitespace-pre-wrap font-serif text-sm h-64 overflow-y-auto">
        {version.content}
      </div>
    </div>
  );
}

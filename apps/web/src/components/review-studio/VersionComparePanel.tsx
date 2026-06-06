export function VersionComparePanel({ compareData }: { compareData: any }) {
  if (!compareData) return null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
      <h2 className="text-xl font-bold mb-4">Compara\u00E7\u00E3o de Vers\u00F5es</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border rounded bg-gray-50">
          <h3 className="font-semibold">Vers\u00E3o {compareData.versionA.number}</h3>
          <ul className="mt-2 text-sm text-gray-600">
            <li>Data: {new Date(compareData.versionA.createdAt).toLocaleString()}</li>
            <li>Score: {compareData.versionA.score || "N/A"}</li>
            <li>Status: {compareData.versionA.status || "N/A"}</li>
          </ul>
        </div>
        <div className="p-4 border rounded bg-gray-50">
          <h3 className="font-semibold">Vers\u00E3o {compareData.versionB.number}</h3>
          <ul className="mt-2 text-sm text-gray-600">
            <li>Data: {new Date(compareData.versionB.createdAt).toLocaleString()}</li>
            <li>Score: {compareData.versionB.score || "N/A"}</li>
            <li>Status: {compareData.versionB.status || "N/A"}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

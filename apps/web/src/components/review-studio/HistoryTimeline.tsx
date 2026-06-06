export function HistoryTimeline({ timeline }: { timeline: any }) {
  if (!timeline || !timeline.events) return null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
      <h2 className="text-xl font-bold mb-4">Timeline de Auditoria</h2>
      <div className="space-y-4">
        {timeline.events.map((event: any, i: number) => (
          <div key={event.id || i} className="flex gap-4 p-4 border rounded bg-gray-50">
            <div className="font-mono text-sm text-gray-500 w-48">
              {new Date(event.timestamp).toLocaleString()}
            </div>
            <div>
              <span className="font-semibold">{event.type}</span>
              <pre className="text-xs text-gray-600 mt-1">
                {JSON.stringify(event.details, null, 2)}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

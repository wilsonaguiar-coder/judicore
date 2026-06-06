import React from "react";

interface CorrectionItem {
  priority?: "HIGH" | "MEDIUM" | "LOW";
  title?: string;
  description?: string;
  affectedArea?: string;
}

export function CorrectionPlanList({ items }: { items?: CorrectionItem[] | null }) {
  const safeItems = items ?? [];

  const priorityColors: Record<string, string> = {
    HIGH: "bg-red-100 text-red-800 border-red-200",
    MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
    LOW: "bg-slate-100 text-slate-800 border-slate-200",
  };

  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Correction Plan</h2>
      <div className="space-y-4">
        {safeItems.map((item, i) => {
          const priority = item.priority ?? "LOW";
          return (
            <div key={i} className={`p-4 border rounded-md ${priorityColors[priority] ?? priorityColors.LOW}`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">{item.title ?? "—"}</h3>
                <span className="text-xs font-bold px-2 py-1 rounded bg-white/50 uppercase">
                  {priority}
                </span>
              </div>
              <p className="text-sm opacity-90 mb-2">{item.description ?? "—"}</p>
              <div className="text-xs font-medium uppercase tracking-wide opacity-75">
                Area: {item.affectedArea ?? "—"}
              </div>
            </div>
          );
        })}
        {safeItems.length === 0 && (
          <p className="text-sm text-slate-500 italic">Nenhum plano disponível. Execute a auditoria.</p>
        )}
      </div>
    </div>
  );
}

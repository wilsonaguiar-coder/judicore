import React from "react";
import { Clock } from "lucide-react";

interface HistoryItem {
  id: string;
  date: string;
  score: number;
  status: string;
}

export function HistoryTimeline({ items }: { items: HistoryItem[] }) {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="text-slate-500" size={20} />
        <h2 className="text-xl font-semibold">History Timeline</h2>
      </div>
      
      <div className="relative border-l border-slate-200 ml-3 space-y-6">
        {items.map((item, i) => (
          <div key={item.id} className="relative pl-6">
            <div className={`absolute w-3 h-3 rounded-full -left-[6.5px] top-1.5 ${i === 0 ? 'bg-blue-500 ring-4 ring-blue-100' : 'bg-slate-300'}`}></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-800">{new Date(item.date).toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-1">Status: {item.status}</p>
              </div>
              <div className="bg-slate-100 px-3 py-1 rounded text-sm font-bold text-slate-700">
                {item.score} pts
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

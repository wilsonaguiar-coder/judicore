import React from "react";
import { CheckSquare, Square } from "lucide-react";

interface TaskItem {
  id: string;
  instruction: string;
  completed: boolean;
}

export function GuidedRevisionChecklist({ tasks }: { tasks: TaskItem[] }) {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Guided Revision</h2>
      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-start gap-3 p-3 bg-slate-50 border rounded-md">
            {task.completed ? (
              <CheckSquare className="text-green-600 mt-0.5" size={20} />
            ) : (
              <Square className="text-slate-400 mt-0.5" size={20} />
            )}
            <div>
              <p className={`text-sm ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                {task.instruction}
              </p>
              <span className="text-xs font-medium text-slate-500 mt-1 block">
                Status: {task.completed ? "Completed" : "Pending"}
              </span>
            </div>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-sm text-slate-500">No revision tasks pending.</p>}
      </div>
    </div>
  );
}

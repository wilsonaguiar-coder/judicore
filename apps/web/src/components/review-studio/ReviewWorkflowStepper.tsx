import React from "react";
import { Check, Clock, Loader2 } from "lucide-react";

export type StepStatus = "pending" | "active" | "completed";

export interface WorkflowStep {
  id: number;
  label: string;
  description: string;
  status: StepStatus;
}

interface ReviewWorkflowStepperProps {
  steps: WorkflowStep[];
}

export function ReviewWorkflowStepper({ steps }: ReviewWorkflowStepperProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-8">
      <div className="flex items-center gap-0">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            {/* Step Node */}
            <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: 72 }}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300
                  ${step.status === "completed"
                    ? "bg-emerald-500 border-emerald-500 text-white shadow-emerald-200 shadow-md"
                    : step.status === "active"
                    ? "bg-blue-600 border-blue-600 text-white shadow-blue-200 shadow-md animate-pulse"
                    : "bg-slate-100 border-slate-300 text-slate-400"
                  }`}
              >
                {step.status === "completed" ? (
                  <Check size={18} strokeWidth={3} />
                ) : step.status === "active" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Clock size={16} />
                )}
              </div>
              <span
                className={`mt-2 text-xs font-semibold text-center leading-tight max-w-[68px]
                  ${step.status === "completed"
                    ? "text-emerald-600"
                    : step.status === "active"
                    ? "text-blue-700"
                    : "text-slate-400"
                  }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 transition-all duration-500
                  ${step.status === "completed"
                    ? "bg-emerald-400"
                    : "bg-slate-200"
                  }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

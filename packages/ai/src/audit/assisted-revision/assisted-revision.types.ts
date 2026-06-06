import type { RevisionTask } from "../revision/guided-revision.types.js";

export interface AssistedRevisionRequest {
  draft: string;
  task: RevisionTask;
  context?: string | undefined;
}

export interface AssistedRevisionSuggestion {
  taskId: string;
  code: string;
  instruction: string;
  suggestion: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  requiresHumanReview: boolean;
}

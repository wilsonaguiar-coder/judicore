import type { RevisionTask } from "../revision/guided-revision.types.js";

export type RewriteProvider = "DEEPSEEK" | "OPENAI";

export interface RewriteRequest {
  draft: string;
  task: RevisionTask;
  suggestion: string;
  provider?: RewriteProvider;
}

export interface RewriteResult {
  originalDraft: string;
  rewrittenDraft: string;
  taskId: string;
  provider: string;
  generatedAt: string;
  requiresHumanReview: boolean;
}

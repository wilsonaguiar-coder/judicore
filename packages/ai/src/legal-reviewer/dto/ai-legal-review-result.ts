import type { AiLegalReviewFinding } from "./ai-legal-review-finding.js";

export interface AiLegalReviewResult {
  findings: AiLegalReviewFinding[];
  summary: string;
  provider: string;
  model: string;
  generatedAt: Date;
  requiresHumanReview: true;
}

import type { AiLegalStrengthFinding } from "./ai-legal-strength-finding.js";

export interface AiLegalStrengthReviewResult {
  findings: AiLegalStrengthFinding[];
  summary: string;
  provider: string;
  model: string;
  generatedAt: Date;
  requiresHumanReview: true;
}

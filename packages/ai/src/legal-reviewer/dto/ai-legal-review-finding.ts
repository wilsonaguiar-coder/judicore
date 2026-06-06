import type { FindingType } from "../enums/finding-type.enum.js";
import type { Severity } from "../enums/severity.enum.js";

export interface AiLegalReviewFinding {
  id: string;
  type: FindingType;
  severity: Severity;
  title: string;
  explanation: string;
  evidenceFromText: string[];
  suggestedReview: string;
  confidence: number;
  requiresHumanReview: true;
}

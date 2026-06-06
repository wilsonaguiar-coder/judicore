import type { HumanReviewDecision } from "./human-review.types.js";

export interface AnalyticsDecisionRecord extends HumanReviewDecision {
  provider?: string;
  affectedArea?: string;
}

export interface RuleEffectiveness {
  ruleCode: string;
  totalReviews: number;
  approved: number;
  rejected: number;
  skipped: number;
  approvalRate: number;
  rejectionRate: number;
  skipRate: number;
}

export interface ProviderEffectiveness {
  provider: string;
  totalReviews: number;
  approved: number;
  rejected: number;
  skipped: number;
  approvalRate: number;
}

export interface AreaEffectiveness {
  affectedArea: string;
  totalReviews: number;
  approved: number;
  rejected: number;
  skipped: number;
  approvalRate: number;
}

export interface RevisionDecisionAnalytics {
  totalReviews: number;
  approved: number;
  rejected: number;
  skipped: number;
  approvalRate: number;
  rejectionRate: number;
  skipRate: number;
  topRules: RuleEffectiveness[];
  topProviders: ProviderEffectiveness[];
  topAreas: AreaEffectiveness[];
}

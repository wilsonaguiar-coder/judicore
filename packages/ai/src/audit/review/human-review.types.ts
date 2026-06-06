export type HumanReviewStatus = "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";

export interface HumanReviewDecision {
  id: string;
  taskId: string;
  ruleCode: string;
  status: HumanReviewStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  notes?: string;
}

export interface HumanReviewSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  skipped: number;
  approvalRate: number; // percentage
}

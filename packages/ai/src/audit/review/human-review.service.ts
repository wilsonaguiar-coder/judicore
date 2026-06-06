import { randomUUID } from "crypto";
import type { HumanReviewDecision, HumanReviewSummary } from "./human-review.types.js";

export class HumanReviewService {
  public createDecision(taskId: string, ruleCode: string): HumanReviewDecision {
    return {
      id: randomUUID(),
      taskId,
      ruleCode,
      status: "PENDING"
    };
  }

  public approve(decision: HumanReviewDecision, reviewerId: string, notes?: string): HumanReviewDecision {
    const result: HumanReviewDecision = {
      ...decision,
      status: "APPROVED",
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString()
    };
    if (notes !== undefined) result.notes = notes;
    return result;
  }

  public reject(decision: HumanReviewDecision, reviewerId: string, notes?: string): HumanReviewDecision {
    const result: HumanReviewDecision = {
      ...decision,
      status: "REJECTED",
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString()
    };
    if (notes !== undefined) result.notes = notes;
    return result;
  }

  public skip(decision: HumanReviewDecision, reviewerId: string, notes?: string): HumanReviewDecision {
    const result: HumanReviewDecision = {
      ...decision,
      status: "SKIPPED",
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString()
    };
    if (notes !== undefined) result.notes = notes;
    return result;
  }

  public buildSummary(decisions: HumanReviewDecision[]): HumanReviewSummary {
    const total = decisions.length;
    const pending = decisions.filter(d => d.status === "PENDING").length;
    const approved = decisions.filter(d => d.status === "APPROVED").length;
    const rejected = decisions.filter(d => d.status === "REJECTED").length;
    const skipped = decisions.filter(d => d.status === "SKIPPED").length;

    const answered = approved + rejected;
    const approvalRate = answered === 0 ? 0 : (approved / answered) * 100;

    return {
      total,
      pending,
      approved,
      rejected,
      skipped,
      approvalRate
    };
  }
}

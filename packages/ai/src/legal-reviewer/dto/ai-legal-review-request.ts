import type { IntegratedAuditResponse } from "../../audit/audit.service.js";
import type { CorrectionPlan } from "../../audit/types/correction-plan.js";

export interface AiLegalReviewRequest {
  draft: string;
  classification: string;
  domain?: string;
  pieceType?: string;
  audit: IntegratedAuditResponse;
  correctionPlan?: CorrectionPlan;
  provider?: "DEEPSEEK" | "OPENAI";
}

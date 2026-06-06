import type { IntegratedAuditResponse } from "../audit.service.js";
import type { LegalClassification } from "../../pipeline/types.js";

export interface ReAuditRequest {
  originalDraft: string;
  rewrittenDraft: string;
  classification: LegalClassification;
}

export interface ReAuditMetrics {
  scoreBefore: number;
  scoreAfter: number;
  scoreDelta: number;
  fatalBefore: number;
  fatalAfter: number;
  fatalDelta: number;
  warningsBefore: number;
  warningsAfter: number;
  warningsDelta: number;
}

export interface ReAuditResult {
  originalAudit: IntegratedAuditResponse;
  rewrittenAudit: IntegratedAuditResponse;
  metrics: ReAuditMetrics;
  improved: boolean;
  regressed: boolean;
  generatedAt: string;
}

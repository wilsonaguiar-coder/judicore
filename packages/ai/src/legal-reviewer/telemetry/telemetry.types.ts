export type FeedbackValue = "USEFUL" | "NOT_USEFUL";

// ── Registro de execução ──────────────────────────────────────────────────────

export interface FindingTelemetry {
  findingType: string;
  opportunityLevel: string;
  confidence: number;
  /** Trecho anonimizado e truncado — sem PII. */
  evidenceSnippet?: string;
}

export interface StrengthReviewExecutionRecord {
  recordType: "EXECUTION";
  timestamp: string;
  domain?: string;
  pieceType?: string;
  provider: string;
  model: string;
  findingCount: number;
  responseTimeMs: number;
  findings: FindingTelemetry[];
}

// ── Registro de feedback ──────────────────────────────────────────────────────

export interface StrengthReviewFeedbackRecord {
  recordType: "FEEDBACK";
  timestamp: string;
  findingId: string;
  findingType: string;
  opportunityLevel: string;
  domain?: string;
  feedback: FeedbackValue;
}

export type TelemetryRecord = StrengthReviewExecutionRecord | StrengthReviewFeedbackRecord;

// ── Analytics agregado ────────────────────────────────────────────────────────

export interface FindingFrequency {
  type: string;
  count: number;
  percentage: number;
}

export interface FeedbackStats {
  totalFeedback: number;
  usefulCount: number;
  notUsefulCount: number;
  usefulRate: number;
  byFindingType: Record<string, { useful: number; notUseful: number; usefulRate: number }>;
}

export interface StrengthReviewAnalytics {
  totalExecutions: number;
  totalFindings: number;
  avgFindingsPerExecution: number;
  topFindingTypes: FindingFrequency[];
  topFindingsByDomain: Record<string, FindingFrequency[]>;
  opportunityLevelDistribution: Record<string, number>;
  providerStats: Record<string, { executions: number; avgFindings: number; avgResponseTimeMs: number }>;
  feedbackStats: FeedbackStats;
  /** Amostra anonimizada para análise qualitativa. */
  anonymizedExamples: AnonymizedExample[];
}

export interface AnonymizedExample {
  findingType: string;
  opportunityLevel: string;
  evidenceSnippet: string;
  suggestion: string;
  domain?: string;
}

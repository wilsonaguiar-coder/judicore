export interface AnalyticsCount {
  code: string;
  count: number;
}

export interface AuditAnalytics {
  totalAudits: number;
  approved: number;
  approvedWithWarnings: number;
  rejected: number;
  approvalRate: number;
  rejectionRate: number;
  topWarnings: AnalyticsCount[];
  topFatalErrors: AnalyticsCount[];
  topCorrectionAreas: AnalyticsCount[];
}

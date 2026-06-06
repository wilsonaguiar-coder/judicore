export interface AuditHistoryRecord {
  id: string;
  pieceId?: string;
  userId?: string;
  domain?: string;
  createdAt: string;
  status: string;
  score?: number;
  audit: unknown;
  feedback?: unknown;
  correctionPlan?: unknown;
  metadata?: Record<string, unknown>;
}

export interface AuditHistoryQuery {
  userId?: string;
  domain?: string;
  status?: string;
  from?: string; // ISO string date
  to?: string; // ISO string date
  limit?: number;
}

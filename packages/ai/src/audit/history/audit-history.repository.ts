import type { AuditHistoryRecord, AuditHistoryQuery } from "./audit-history.types.js";

export interface AuditHistoryRepository {
  add(record: AuditHistoryRecord): AuditHistoryRecord;
  list(query?: AuditHistoryQuery): AuditHistoryRecord[];
  getById(id: string): AuditHistoryRecord | undefined;
  clear(): void;
}

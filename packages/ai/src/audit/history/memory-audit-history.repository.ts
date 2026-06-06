import type { AuditHistoryRecord, AuditHistoryQuery } from "./audit-history.types.js";
import type { AuditHistoryRepository } from "./audit-history.repository.js";

export class MemoryAuditHistoryRepository implements AuditHistoryRepository {
  private records: AuditHistoryRecord[] = [];

  public add(record: AuditHistoryRecord): AuditHistoryRecord {
    // Store a copy of the record
    this.records.push({ ...record });
    return record;
  }

  public list(query?: AuditHistoryQuery): AuditHistoryRecord[] {
    let filtered = [...this.records];

    if (query) {
      if (query.userId !== undefined) {
        filtered = filtered.filter(r => r.userId === query.userId);
      }
      if (query.domain !== undefined) {
        filtered = filtered.filter(r => r.domain === query.domain);
      }
      if (query.status !== undefined) {
        filtered = filtered.filter(r => r.status === query.status);
      }
      if (query.from !== undefined) {
        const fromDate = new Date(query.from).getTime();
        filtered = filtered.filter(r => new Date(r.createdAt).getTime() >= fromDate);
      }
      if (query.to !== undefined) {
        const toDate = new Date(query.to).getTime();
        filtered = filtered.filter(r => new Date(r.createdAt).getTime() <= toDate);
      }
    }

    // Ordenar: createdAt desc
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // limit
    if (query?.limit !== undefined && query.limit > 0) {
      filtered = filtered.slice(0, query.limit);
    }

    return filtered;
  }

  public getById(id: string): AuditHistoryRecord | undefined {
    return this.records.find(r => r.id === id);
  }

  public clear(): void {
    this.records = [];
  }
}

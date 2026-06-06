import { randomUUID } from "node:crypto";
import type { AuditHistoryRecord, AuditHistoryQuery } from "./audit-history.types.js";
import type { AuditHistoryRepository } from "./audit-history.repository.js";
import { MemoryAuditHistoryRepository } from "./memory-audit-history.repository.js";

/**
 * Implementa\u00E7\u00E3o do servi\u00E7o de hist\u00F3rico baseada em inje\u00E7\u00E3o de depend\u00EAncia.
 * O repository padr\u00E3o \u00E9 in-memory para valida\u00E7\u00E3o de contrato.
 * Substituir por persist\u00EAncia real (ex: PrismaAuditHistoryRepository) em fase futura.
 */
export class AuditHistoryService {
  private repository: AuditHistoryRepository;

  constructor(repository?: AuditHistoryRepository) {
    this.repository = repository ?? new MemoryAuditHistoryRepository();
  }

  public add(recordInput: Omit<AuditHistoryRecord, "id" | "createdAt"> & { id?: string; createdAt?: string }): AuditHistoryRecord {
    const record: AuditHistoryRecord = {
      ...recordInput,
      id: recordInput.id ?? randomUUID(),
      createdAt: recordInput.createdAt ?? new Date().toISOString(),
    };

    return this.repository.add(record);
  }

  public list(query?: AuditHistoryQuery): AuditHistoryRecord[] {
    return this.repository.list(query);
  }

  public getById(id: string): AuditHistoryRecord | undefined {
    return this.repository.getById(id);
  }

  public clear(): void {
    this.repository.clear();
  }
}

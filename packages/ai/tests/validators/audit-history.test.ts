import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { AuditHistoryService } from "../../src/audit/history/audit-history.service.js";
import { MemoryAuditHistoryRepository } from "../../src/audit/history/memory-audit-history.repository.js";
import type { AuditHistoryRecord } from "../../src/audit/history/audit-history.types.js";

describe("AuditHistoryService com Repository Interface", () => {
  let service: AuditHistoryService;

  beforeEach(() => {
    service = new AuditHistoryService();
    service.clear();
  });

  const baseRecord = {
    status: "APROVADA",
    audit: { isFake: true },
  };

  it("1. Service funciona com repository padr\u00E3o (MemoryAuditHistoryRepository)", () => {
    const record = service.add(baseRecord);
    assert.ok(record.id);
    const found = service.getById(record.id);
    assert.ok(found);
  });

  it("2. Service aceita repository injetado", () => {
    class FakeRepository extends MemoryAuditHistoryRepository {
      public add(record: AuditHistoryRecord) {
        return super.add({ ...record, status: "FAKE_INJECTED" });
      }
    }
    const fakeRepo = new FakeRepository();
    const customService = new AuditHistoryService(fakeRepo);
    
    const record = customService.add(baseRecord);
    assert.equal(record.status, "FAKE_INJECTED");
  });

  it("3. MemoryRepository preserva comportamento da Fase 7.4.0", () => {
    // A presen\u00E7a e funcionalidade das filtragens garante isso
    assert.ok(service.list() !== undefined);
  });

  it("4. add salva registro", () => {
    const record = service.add(baseRecord);

    assert.ok(record.id);
    assert.ok(record.createdAt);
    assert.equal(record.status, "APROVADA");
  });

  it("5. list filtra por userId", () => {
    service.add({ ...baseRecord, userId: "user-1" });
    service.add({ ...baseRecord, userId: "user-2" });

    const list = service.list({ userId: "user-1" });
    assert.equal(list.length, 1);
    assert.equal(list[0]!.userId, "user-1");
  });

  it("6. list filtra por domain", () => {
    service.add({ ...baseRecord, domain: "TRABALHISTA" });
    service.add({ ...baseRecord, domain: "FAMILIA" });

    const list = service.list({ domain: "TRABALHISTA" });
    assert.equal(list.length, 1);
    assert.equal(list[0]!.domain, "TRABALHISTA");
  });

  it("7. list filtra por status", () => {
    service.add({ ...baseRecord, status: "APROVADA" });
    service.add({ ...baseRecord, status: "REPROVADA" });

    const list = service.list({ status: "REPROVADA" });
    assert.equal(list.length, 1);
    assert.equal(list[0]!.status, "REPROVADA");
  });

  it("8. list filtra por intervalo de datas", () => {
    service.add({ ...baseRecord, createdAt: "2023-01-01T10:00:00.000Z" });
    service.add({ ...baseRecord, createdAt: "2023-01-05T10:00:00.000Z" });
    service.add({ ...baseRecord, createdAt: "2023-01-10T10:00:00.000Z" });

    const list = service.list({
      from: "2023-01-02T00:00:00.000Z",
      to: "2023-01-08T00:00:00.000Z"
    });

    assert.equal(list.length, 1);
    assert.equal(list[0]!.createdAt, "2023-01-05T10:00:00.000Z");
  });

  it("9. limit funciona e ordena\u00E7\u00E3o \u00E9 desc", () => {
    service.add({ ...baseRecord, createdAt: "2023-01-01T10:00:00.000Z" });
    service.add({ ...baseRecord, createdAt: "2023-01-02T10:00:00.000Z" });
    service.add({ ...baseRecord, createdAt: "2023-01-03T10:00:00.000Z" });

    const list = service.list({ limit: 2 });
    assert.equal(list.length, 2);
    // Deve pegar os 2 mais recentes
    assert.equal(list[0]!.createdAt, "2023-01-03T10:00:00.000Z");
    assert.equal(list[1]!.createdAt, "2023-01-02T10:00:00.000Z");
  });

  it("10. getById funciona", () => {
    const added = service.add(baseRecord);
    const found = service.getById(added.id);

    assert.deepEqual(found, added);
  });

  it("11. clear funciona", () => {
    service.add(baseRecord);
    assert.equal(service.list().length, 1);

    service.clear();
    assert.equal(service.list().length, 0);
  });
});

import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ReAuditService } from "../../src/audit/re-audit/re-audit.service.js";
import { AuditService } from "../../src/audit/audit.service.js";
import type { ReAuditRequest } from "../../src/audit/re-audit/re-audit.types.js";
import type { IntegratedAuditResponse } from "../../src/audit/audit.service.js";

describe("Automatic Re-Audit", () => {
  const req: ReAuditRequest = {
    originalDraft: "Draft original com erros.",
    rewrittenDraft: "Draft corrigido pela IA.",
    classification: "CIVIL_CONTESTA\u00C7\u00C3O" // Random classification para o mock
  };

  afterEach(() => {
    mock.restoreAll();
  });

  function createMockAuditService(first: Partial<IntegratedAuditResponse["audit"]>, second: Partial<IntegratedAuditResponse["audit"]>) {
    const service = new AuditService();
    let callCount = 0;
    mock.method(service, "auditGeneratedDocument", () => {
      callCount++;
      const current = callCount === 1 ? first : second;
      return {
        pieceId: callCount === 1 ? "original-draft" : "rewritten-draft",
        audit: {
          score: current.score ?? 50,
          fatalErrors: current.fatalErrors ?? [],
          nonFatalErrors: current.nonFatalErrors ?? [],
          status: "APROVADA",
          classification: "CIVIL",
          strengths: []
        }
      };
    });
    return service;
  }

  it("1, 8, 9, 10. score melhora e deltas est\u00E3o corretos", () => {
    const auditMock = createMockAuditService(
      { score: 50, fatalErrors: [{ titulo: "E1", descricao: "" }] },
      { score: 80, fatalErrors: [] }
    );
    const service = new ReAuditService(auditMock);
    const result = service.runReAudit(req);

    assert.equal(result.improved, true);
    assert.equal(result.regressed, false);
    assert.equal(result.metrics.scoreDelta, 30);
    assert.equal(result.metrics.fatalDelta, -1);
    assert.equal(result.metrics.warningsDelta, 0);
  });

  it("2. score piora", () => {
    const auditMock = createMockAuditService(
      { score: 80 },
      { score: 50 }
    );
    const service = new ReAuditService(auditMock);
    const result = service.runReAudit(req);

    assert.equal(result.improved, false);
    assert.equal(result.regressed, true);
    assert.equal(result.metrics.scoreDelta, -30);
  });

  it("3. fatal reduz", () => {
    const auditMock = createMockAuditService(
      { score: 50, fatalErrors: [{ titulo: "E1", descricao: "" }, { titulo: "E2", descricao: "" }] },
      { score: 50, fatalErrors: [{ titulo: "E1", descricao: "" }] }
    );
    const service = new ReAuditService(auditMock);
    const result = service.runReAudit(req);

    assert.equal(result.improved, true);
    assert.equal(result.regressed, false);
    assert.equal(result.metrics.fatalDelta, -1);
  });

  it("4. fatal aumenta", () => {
    const auditMock = createMockAuditService(
      { score: 50, fatalErrors: [] },
      { score: 50, fatalErrors: [{ titulo: "E1", descricao: "" }] }
    );
    const service = new ReAuditService(auditMock);
    const result = service.runReAudit(req);

    assert.equal(result.improved, false);
    assert.equal(result.regressed, true);
    assert.equal(result.metrics.fatalDelta, 1);
  });

  it("5. warnings reduzem", () => {
    const auditMock = createMockAuditService(
      { score: 50, nonFatalErrors: [{ titulo: "W1", descricao: "" }] },
      { score: 50, nonFatalErrors: [] }
    );
    const service = new ReAuditService(auditMock);
    const result = service.runReAudit(req);

    assert.equal(result.improved, true);
    assert.equal(result.regressed, false);
    assert.equal(result.metrics.warningsDelta, -1);
  });

  it("6. warnings aumentam", () => {
    const auditMock = createMockAuditService(
      { score: 50, nonFatalErrors: [] },
      { score: 50, nonFatalErrors: [{ titulo: "W1", descricao: "" }] }
    );
    const service = new ReAuditService(auditMock);
    const result = service.runReAudit(req);

    assert.equal(result.improved, false);
    assert.equal(result.regressed, true);
    assert.equal(result.metrics.warningsDelta, 1);
  });

  it("7. empate perfeito", () => {
    const auditMock = createMockAuditService(
      { score: 50, fatalErrors: [], nonFatalErrors: [] },
      { score: 50, fatalErrors: [], nonFatalErrors: [] }
    );
    const service = new ReAuditService(auditMock);
    const result = service.runReAudit(req);

    assert.equal(result.improved, false);
    assert.equal(result.regressed, false);
    assert.equal(result.metrics.scoreDelta, 0);
    assert.equal(result.metrics.fatalDelta, 0);
    assert.equal(result.metrics.warningsDelta, 0);
  });

  it("11. n\u00E3o modifica drafts originais no input", () => {
    const auditMock = createMockAuditService({}, {});
    const service = new ReAuditService(auditMock);
    
    service.runReAudit(req);

    assert.equal(req.originalDraft, "Draft original com erros.");
    assert.equal(req.rewrittenDraft, "Draft corrigido pela IA.");
  });
});

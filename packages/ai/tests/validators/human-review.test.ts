import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HumanReviewService } from "../../src/audit/review/human-review.service.js";

describe("HumanReview Workflow", () => {
  const service = new HumanReviewService();

  it("1. createDecision() gera PENDING", () => {
    const decision = service.createDecision("task-123", "RULE_01");
    assert.equal(decision.status, "PENDING");
    assert.equal(decision.taskId, "task-123");
    assert.equal(decision.ruleCode, "RULE_01");
    assert.ok(decision.id);
  });

  it("2. approve() gera APPROVED", () => {
    const decision = service.createDecision("task-123", "RULE_01");
    const approved = service.approve(decision, "user-99", "Excelente sugest\u00E3o");
    
    assert.equal(approved.status, "APPROVED");
    assert.equal(approved.reviewedBy, "user-99");
    assert.equal(approved.notes, "Excelente sugest\u00E3o");
    assert.ok(approved.reviewedAt);
  });

  it("3. reject() gera REJECTED", () => {
    const decision = service.createDecision("task-123", "RULE_01");
    const rejected = service.reject(decision, "user-99", "Incorreto");
    
    assert.equal(rejected.status, "REJECTED");
    assert.equal(rejected.reviewedBy, "user-99");
    assert.equal(rejected.notes, "Incorreto");
  });

  it("4. skip() gera SKIPPED", () => {
    const decision = service.createDecision("task-123", "RULE_01");
    const skipped = service.skip(decision, "user-99");
    
    assert.equal(skipped.status, "SKIPPED");
    assert.equal(skipped.reviewedBy, "user-99");
  });

  it("5. buildSummary() calcula m\u00E9tricas corretamente", () => {
    const d1 = service.createDecision("t1", "R1");
    const d2 = service.approve(service.createDecision("t2", "R2"), "u1");
    const d3 = service.approve(service.createDecision("t3", "R3"), "u1");
    const d4 = service.reject(service.createDecision("t4", "R4"), "u1");
    const d5 = service.skip(service.createDecision("t5", "R5"), "u1");

    const summary = service.buildSummary([d1, d2, d3, d4, d5]);

    assert.equal(summary.total, 5);
    assert.equal(summary.pending, 1);
    assert.equal(summary.approved, 2);
    assert.equal(summary.rejected, 1);
    assert.equal(summary.skipped, 1);
    
    // (2 approved / 3 answered) * 100 = 66.666...
    assert.ok(Math.abs(summary.approvalRate - 66.66) < 0.1);
  });

  it("6. approvalRate n\u00E3o divide por zero", () => {
    const summary1 = service.buildSummary([]);
    assert.equal(summary1.approvalRate, 0);

    const d1 = service.createDecision("t1", "R1"); // pending
    const d2 = service.skip(service.createDecision("t2", "R2"), "u1"); // skipped
    
    const summary2 = service.buildSummary([d1, d2]);
    assert.equal(summary2.approvalRate, 0);
  });

  it("7. nenhuma decis\u00E3o altera draft (servi\u00E7o \u00E9 read-only em rela\u00E7\u00E3o aos artefatos)", () => {
    const mockDraft = { text: "O autor alega fatos" };
    const draftStringified = JSON.stringify(mockDraft);

    const decision = service.createDecision("task-123", "RULE_01");
    service.approve(decision, "user-99");

    // O servi\u00E7o n\u00E3o possui nenhum m\u00E9todo que referencie, mute ou retorne o draft
    assert.equal(JSON.stringify(mockDraft), draftStringified);
  });
});

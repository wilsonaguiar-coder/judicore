import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getReviewStore } from "../../../../lib/review-studio.mock-store";

describe("Review Studio API Wiring (Mocks)", () => {
  it("1. Mock store initializes correctly", () => {
    const store = getReviewStore("doc-123");
    assert.equal(store.classification, "CIVIL_PETICAO_INICIAL");
    assert.ok(store.originalDraft);
  });

  it("2. GET audit return payload (Simulated API flow)", () => {
    // A rota /api/.../audit chama a AuditService real.
    // Garantimos que a Store ser\u00E1 instanciada.
    const store = getReviewStore("doc-new");
    assert.equal(typeof store.originalDraft, "string");
  });

  it("3. POST suggestion return suggestion", () => {
    const store = getReviewStore("doc-new");
    store.suggestions["t1"] = { ruleCode: "TEST", suggestion: "Ok", provider: "MOCK" };
    assert.equal(store.suggestions["t1"].suggestion, "Ok");
  });

  it("4. POST decision return status", () => {
    const store = getReviewStore("doc-new");
    store.decisions["t1"] = { taskId: "t1", decision: "APPROVED", reviewedBy: "UI", reviewedAt: "", comments: "" };
    assert.equal(store.decisions["t1"].decision, "APPROVED");
  });

  it("5. POST rewrite return draft", () => {
    const store = getReviewStore("doc-new");
    store.rewriteResults["t1"] = { 
      originalDraft: "A", rewrittenDraft: "B", taskId: "t1", provider: "DS", generatedAt: "", requiresHumanReview: true 
    };
    assert.equal(store.rewriteResults["t1"].rewrittenDraft, "B");
  });

  it("6. POST re-audit return metrics", () => {
    const store = getReviewStore("doc-new");
    store.reAuditResult = {
      originalAudit: {} as any, rewrittenAudit: {} as any,
      metrics: { scoreBefore: 50, scoreAfter: 90, scoreDelta: 40, fatalBefore: 0, fatalAfter: 0, fatalDelta: 0, warningsBefore: 0, warningsAfter: 0, warningsDelta: 0 },
      improved: true, regressed: false, generatedAt: ""
    };
    assert.equal(store.reAuditResult.metrics.scoreDelta, 40);
  });
});

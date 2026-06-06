import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RevisionDecisionAnalyticsService } from "../../src/audit/review/revision-decision-analytics.service.js";
import type { AnalyticsDecisionRecord } from "../../src/audit/review/revision-decision-analytics.types.js";

describe("Revision Decision Analytics", () => {
  const service = new RevisionDecisionAnalyticsService();

  const mockDecisions: AnalyticsDecisionRecord[] = [
    { id: "1", taskId: "t1", ruleCode: "R1", status: "APPROVED", provider: "DEEPSEEK", affectedArea: "M\u00C9RITO" },
    { id: "2", taskId: "t2", ruleCode: "R1", status: "APPROVED", provider: "DEEPSEEK", affectedArea: "M\u00C9RITO" },
    { id: "3", taskId: "t3", ruleCode: "R1", status: "REJECTED", provider: "OPENAI", affectedArea: "M\u00C9RITO" },
    { id: "4", taskId: "t4", ruleCode: "R2", status: "SKIPPED", provider: "GEMINI", affectedArea: "DISPOSITIVO" },
    { id: "5", taskId: "t5", ruleCode: "R2", status: "APPROVED", provider: "OPENAI", affectedArea: "DISPOSITIVO" }
  ];

  it("1. analytics vazio n\u00E3o quebra (prote\u00E7\u00E3o contra divis\u00E3o por zero)", () => {
    const result = service.buildAnalytics([]);
    assert.equal(result.totalReviews, 0);
    assert.equal(result.approvalRate, 0);
    assert.equal(result.rejectionRate, 0);
    assert.equal(result.skipRate, 0);
    assert.equal(result.topRules.length, 0);
    assert.equal(result.topProviders.length, 0);
    assert.equal(result.topAreas.length, 0);
  });

  it("2, 3, 4. m\u00E9tricas gerais corretas (approvalRate, rejectionRate, skipRate)", () => {
    const result = service.buildAnalytics(mockDecisions);
    
    assert.equal(result.totalReviews, 5);
    assert.equal(result.approved, 3);
    assert.equal(result.rejected, 1);
    assert.equal(result.skipped, 1);
    
    assert.equal(result.approvalRate, 60); // 3/5 = 60%
    assert.equal(result.rejectionRate, 20); // 1/5 = 20%
    assert.equal(result.skipRate, 20); // 1/5 = 20%
  });

  it("5. rule effectiveness correto e ordenado (8)", () => {
    const rules = service.buildRuleEffectiveness(mockDecisions);
    
    assert.equal(rules.length, 2);
    // R1: 3 total (2 approved, 1 rejected, 0 skipped) = 66.66%
    // R2: 2 total (1 approved, 0 rejected, 1 skipped) = 50.00%
    
    assert.equal(rules[0].ruleCode, "R1");
    assert.ok(Math.abs(rules[0].approvalRate - 66.66) < 0.1);
    
    assert.equal(rules[1].ruleCode, "R2");
    assert.equal(rules[1].approvalRate, 50);
  });

  it("6. provider effectiveness correto e ordenado (8)", () => {
    const providers = service.buildProviderEffectiveness(mockDecisions);
    
    assert.equal(providers.length, 3);
    // DEEPSEEK: 2 total (2 approved) = 100%
    // OPENAI: 2 total (1 approved, 1 rejected) = 50%
    // GEMINI: 1 total (1 skipped) = 0%
    
    assert.equal(providers[0].provider, "DEEPSEEK");
    assert.equal(providers[0].approvalRate, 100);
    
    assert.equal(providers[1].provider, "OPENAI");
    assert.equal(providers[1].approvalRate, 50);
    
    assert.equal(providers[2].provider, "GEMINI");
    assert.equal(providers[2].approvalRate, 0);
  });

  it("7. area effectiveness correto e ordenado (8)", () => {
    const areas = service.buildAreaEffectiveness(mockDecisions);
    
    assert.equal(areas.length, 2);
    // M\u00C9RITO: 3 total (2 approved, 1 rejected) = 66.66%
    // DISPOSITIVO: 2 total (1 approved, 1 skipped) = 50%
    
    assert.equal(areas[0].affectedArea, "M\u00C9RITO");
    assert.ok(Math.abs(areas[0].approvalRate - 66.66) < 0.1);
    
    assert.equal(areas[1].affectedArea, "DISPOSITIVO");
    assert.equal(areas[1].approvalRate, 50);
  });

  it("9. prote\u00E7\u00E3o contra divis\u00E3o por zero em helper interno", () => {
    // Already covered implicitly by test 1, but explicitly testing internal safePercentage mapping on edge cases
    const singleDecision: AnalyticsDecisionRecord[] = [{ id: "1", taskId: "t1", ruleCode: "R1", status: "PENDING" }];
    const rules = service.buildRuleEffectiveness(singleDecision);
    assert.equal(rules[0].approvalRate, 0); // 0 approved / 1 total
    // Se fosse empty, rule length is 0.
  });

  it("10. isEligibleForFutureAutomation()", () => {
    const result1 = service.isEligibleForFutureAutomation({ approvalRate: 95, rejectionRate: 5, totalReviews: 20 });
    assert.equal(result1, true);

    const result2 = service.isEligibleForFutureAutomation({ approvalRate: 94, rejectionRate: 5, totalReviews: 20 });
    assert.equal(result2, false); // approval < 95

    const result3 = service.isEligibleForFutureAutomation({ approvalRate: 95, rejectionRate: 6, totalReviews: 20 });
    assert.equal(result3, false); // rejection > 5

    const result4 = service.isEligibleForFutureAutomation({ approvalRate: 100, rejectionRate: 0, totalReviews: 19 });
    assert.equal(result4, false); // amostra < 20
  });
});

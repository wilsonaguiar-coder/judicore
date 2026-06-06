import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AuditAnalyticsService } from "../../src/audit/analytics/audit-analytics.service.js";
import type { IntegratedAuditResponse } from "../../src/audit/audit.service.js";

describe("AuditAnalyticsService", () => {
  const analyticsService = new AuditAnalyticsService();

  const mockApproved: IntegratedAuditResponse = {
    pieceId: "1",
    audit: {
      status: "APROVADA",
      score: 100,
      classification: "VIAVEL",
      fatalErrors: [],
      nonFatalErrors: [],
      strengths: [],
    },
    correctionPlan: { items: [] }
  };

  const mockApprovedWithWarnings: IntegratedAuditResponse = {
    pieceId: "2",
    audit: {
      status: "APROVADA_COM_RESSALVAS",
      score: 85,
      classification: "ATENCAO",
      fatalErrors: [],
      nonFatalErrors: [
        { titulo: "A", descricao: "A", code: "WARN_1" },
        { titulo: "B", descricao: "B", code: "WARN_2" },
        { titulo: "C", descricao: "C", code: "WARN_1" }
      ],
      strengths: [],
    },
    correctionPlan: { 
      items: [
        { code: "WARN_1", priority: "MEDIUM", area: "FUNDAMENTA\u00C7\u00C3O", instruction: "X" },
        { code: "WARN_2", priority: "LOW", area: "ESTRUTURA", instruction: "Y" },
        { code: "WARN_1", priority: "MEDIUM", area: "FUNDAMENTA\u00C7\u00C3O", instruction: "X" }
      ] 
    }
  };

  const mockRejected: IntegratedAuditResponse = {
    pieceId: "3",
    audit: {
      status: "REPROVADA",
      score: 40,
      classification: "CRITICA",
      fatalErrors: [
        { titulo: "F", descricao: "F", code: "FATAL_1" }
      ],
      nonFatalErrors: [
        { titulo: "A", descricao: "A", code: "WARN_1" }
      ],
      strengths: [],
    },
    correctionPlan: { 
      items: [
        { code: "FATAL_1", priority: "HIGH", area: "PROVAS", instruction: "Z" },
        { code: "WARN_1", priority: "MEDIUM", area: "FUNDAMENTA\u00C7\u00C3O", instruction: "X" }
      ] 
    }
  };

  it("1. Lista vazia -> Resultado zerado", () => {
    const analytics = analyticsService.buildAuditAnalytics([]);
    
    assert.equal(analytics.totalAudits, 0);
    assert.equal(analytics.approved, 0);
    assert.equal(analytics.approvalRate, 0);
    assert.equal(analytics.topWarnings.length, 0);
  });

  it("2. Apenas aprovadas -> M\u00E9tricas corretas", () => {
    const analytics = analyticsService.buildAuditAnalytics([mockApproved, mockApproved]);
    
    assert.equal(analytics.totalAudits, 2);
    assert.equal(analytics.approved, 2);
    assert.equal(analytics.approvalRate, 100);
    assert.equal(analytics.rejectionRate, 0);
  });

  it("3. Mistura -> Percentuais corretos", () => {
    const analytics = analyticsService.buildAuditAnalytics([
      mockApproved, 
      mockApprovedWithWarnings, 
      mockRejected, 
      mockRejected
    ]);
    
    assert.equal(analytics.totalAudits, 4);
    assert.equal(analytics.approved, 1);
    assert.equal(analytics.approvedWithWarnings, 1);
    assert.equal(analytics.rejected, 2);
    assert.equal(analytics.approvalRate, 25); // 1/4 * 100
    assert.equal(analytics.rejectionRate, 50); // 2/4 * 100
  });

  it("4. TopWarnings -> Ordena\u00E7\u00E3o correta", () => {
    const analytics = analyticsService.buildAuditAnalytics([
      mockApprovedWithWarnings, 
      mockRejected
    ]);
    
    assert.equal(analytics.topWarnings.length, 2);
    assert.equal(analytics.topWarnings[0]!.code, "WARN_1");
    assert.equal(analytics.topWarnings[0]!.count, 3); // 2 in mockApprovedWithWarnings + 1 in mockRejected
    assert.equal(analytics.topWarnings[1]!.code, "WARN_2");
    assert.equal(analytics.topWarnings[1]!.count, 1);
  });

  it("5. TopFatalErrors -> Ordena\u00E7\u00E3o correta", () => {
    const analytics = analyticsService.buildAuditAnalytics([
      mockRejected,
      {
        ...mockRejected,
        audit: {
          ...mockRejected.audit,
          fatalErrors: [
            { titulo: "F", descricao: "F", code: "FATAL_2" },
            { titulo: "F", descricao: "F", code: "FATAL_1" }
          ]
        }
      }
    ]);
    
    assert.equal(analytics.topFatalErrors.length, 2);
    assert.equal(analytics.topFatalErrors[0]!.code, "FATAL_1");
    assert.equal(analytics.topFatalErrors[0]!.count, 2);
    assert.equal(analytics.topFatalErrors[1]!.code, "FATAL_2");
    assert.equal(analytics.topFatalErrors[1]!.count, 1);
  });

  it("6. TopCorrectionAreas -> Ordena\u00E7\u00E3o correta", () => {
    const analytics = analyticsService.buildAuditAnalytics([
      mockApprovedWithWarnings, 
      mockRejected
    ]);
    
    assert.equal(analytics.topCorrectionAreas.length, 3);
    assert.equal(analytics.topCorrectionAreas[0]!.code, "FUNDAMENTA\u00C7\u00C3O");
    assert.equal(analytics.topCorrectionAreas[0]!.count, 3);
    assert.equal(analytics.topCorrectionAreas[1]!.code, "ESTRUTURA");
    assert.equal(analytics.topCorrectionAreas[1]!.count, 1);
  });
});

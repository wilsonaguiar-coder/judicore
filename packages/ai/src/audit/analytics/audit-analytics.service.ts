import type { IntegratedAuditResponse } from "../audit.service.js";
import type { AuditAnalytics, AnalyticsCount } from "./audit-analytics.types.js";

export class AuditAnalyticsService {
  public buildAuditAnalytics(audits: IntegratedAuditResponse[]): AuditAnalytics {
    const totalAudits = audits.length;
    let approved = 0;
    let approvedWithWarnings = 0;
    let rejected = 0;

    const warningsCount: Record<string, number> = {};
    const fatalErrorsCount: Record<string, number> = {};
    const areasCount: Record<string, number> = {};

    for (const auditResponse of audits) {
      // Contagem de status
      if (auditResponse.audit.status === "APROVADA") {
        approved++;
      } else if (auditResponse.audit.status === "APROVADA_COM_RESSALVAS") {
        approvedWithWarnings++;
      } else if (auditResponse.audit.status === "REPROVADA") {
        rejected++;
      }

      // Top Warnings
      if (auditResponse.audit.nonFatalErrors) {
        for (const warning of auditResponse.audit.nonFatalErrors) {
          const code = warning.code ?? "UNKNOWN_WARNING";
          warningsCount[code] = (warningsCount[code] ?? 0) + 1;
        }
      }

      // Top Fatal Errors
      if (auditResponse.audit.fatalErrors) {
        for (const error of auditResponse.audit.fatalErrors) {
          const code = error.code ?? "UNKNOWN_FATAL";
          fatalErrorsCount[code] = (fatalErrorsCount[code] ?? 0) + 1;
        }
      }

      // Top Correction Areas
      if (auditResponse.correctionPlan && auditResponse.correctionPlan.items) {
        for (const item of auditResponse.correctionPlan.items) {
          const area = item.area ?? "UNKNOWN_AREA";
          areasCount[area] = (areasCount[area] ?? 0) + 1;
        }
      }
    }

    const approvalRate = totalAudits > 0 ? (approved / totalAudits) * 100 : 0;
    const rejectionRate = totalAudits > 0 ? (rejected / totalAudits) * 100 : 0;

    return {
      totalAudits,
      approved,
      approvedWithWarnings,
      rejected,
      approvalRate,
      rejectionRate,
      topWarnings: this.getTopCounts(warningsCount, 10),
      topFatalErrors: this.getTopCounts(fatalErrorsCount, 10),
      topCorrectionAreas: this.getTopCounts(areasCount, 10), // A estrutura de testes pede todas as \u00E1reas, ent\u00E3o sem limite restrito, ou top 10 se for o m\u00E1ximo
    };
  }

  // Helper puro para ordena\u00E7\u00E3o desc
  private getTopCounts(countsMap: Record<string, number>, limit: number): AnalyticsCount[] {
    const countsArray: AnalyticsCount[] = Object.keys(countsMap).map((code) => ({
      code,
      count: countsMap[code] ?? 0,
    }));

    countsArray.sort((a, b) => b.count - a.count);

    return countsArray.slice(0, limit);
  }
}

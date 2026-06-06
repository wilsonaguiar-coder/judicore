import type {
  AnalyticsDecisionRecord,
  AreaEffectiveness,
  ProviderEffectiveness,
  RevisionDecisionAnalytics,
  RuleEffectiveness
} from "./revision-decision-analytics.types.js";

export class RevisionDecisionAnalyticsService {
  public buildAnalytics(decisions: AnalyticsDecisionRecord[]): RevisionDecisionAnalytics {
    const totalReviews = decisions.length;
    const pending = decisions.filter(d => d.status === "PENDING").length;
    const approved = decisions.filter(d => d.status === "APPROVED").length;
    const rejected = decisions.filter(d => d.status === "REJECTED").length;
    const skipped = decisions.filter(d => d.status === "SKIPPED").length;

    const answered = approved + rejected;

    const approvalRate = this.safePercentage(approved, totalReviews);
    const rejectionRate = this.safePercentage(rejected, totalReviews);
    const skipRate = this.safePercentage(skipped, totalReviews);

    return {
      totalReviews,
      approved,
      rejected,
      skipped,
      approvalRate,
      rejectionRate,
      skipRate,
      topRules: this.buildRuleEffectiveness(decisions),
      topProviders: this.buildProviderEffectiveness(decisions),
      topAreas: this.buildAreaEffectiveness(decisions)
    };
  }

  public buildRuleEffectiveness(decisions: AnalyticsDecisionRecord[]): RuleEffectiveness[] {
    const map = new Map<string, RuleEffectiveness>();

    for (const d of decisions) {
      const code = d.ruleCode;
      if (!map.has(code)) {
        map.set(code, {
          ruleCode: code,
          totalReviews: 0,
          approved: 0,
          rejected: 0,
          skipped: 0,
          approvalRate: 0,
          rejectionRate: 0,
          skipRate: 0
        });
      }
      const stats = map.get(code)!;
      stats.totalReviews++;
      if (d.status === "APPROVED") stats.approved++;
      else if (d.status === "REJECTED") stats.rejected++;
      else if (d.status === "SKIPPED") stats.skipped++;
    }

    const result = Array.from(map.values()).map(stats => {
      stats.approvalRate = this.safePercentage(stats.approved, stats.totalReviews);
      stats.rejectionRate = this.safePercentage(stats.rejected, stats.totalReviews);
      stats.skipRate = this.safePercentage(stats.skipped, stats.totalReviews);
      return stats;
    });

    return result.sort((a, b) => b.approvalRate - a.approvalRate);
  }

  public buildProviderEffectiveness(decisions: AnalyticsDecisionRecord[]): ProviderEffectiveness[] {
    const map = new Map<string, ProviderEffectiveness>();

    for (const d of decisions) {
      if (!d.provider) continue;
      const prov = d.provider;
      if (!map.has(prov)) {
        map.set(prov, {
          provider: prov,
          totalReviews: 0,
          approved: 0,
          rejected: 0,
          skipped: 0,
          approvalRate: 0
        });
      }
      const stats = map.get(prov)!;
      stats.totalReviews++;
      if (d.status === "APPROVED") stats.approved++;
      else if (d.status === "REJECTED") stats.rejected++;
      else if (d.status === "SKIPPED") stats.skipped++;
    }

    const result = Array.from(map.values()).map(stats => {
      stats.approvalRate = this.safePercentage(stats.approved, stats.totalReviews);
      return stats;
    });

    return result.sort((a, b) => b.approvalRate - a.approvalRate);
  }

  public buildAreaEffectiveness(decisions: AnalyticsDecisionRecord[]): AreaEffectiveness[] {
    const map = new Map<string, AreaEffectiveness>();

    for (const d of decisions) {
      if (!d.affectedArea) continue;
      const area = d.affectedArea;
      if (!map.has(area)) {
        map.set(area, {
          affectedArea: area,
          totalReviews: 0,
          approved: 0,
          rejected: 0,
          skipped: 0,
          approvalRate: 0
        });
      }
      const stats = map.get(area)!;
      stats.totalReviews++;
      if (d.status === "APPROVED") stats.approved++;
      else if (d.status === "REJECTED") stats.rejected++;
      else if (d.status === "SKIPPED") stats.skipped++;
    }

    const result = Array.from(map.values()).map(stats => {
      stats.approvalRate = this.safePercentage(stats.approved, stats.totalReviews);
      return stats;
    });

    return result.sort((a, b) => b.approvalRate - a.approvalRate);
  }

  public isEligibleForFutureAutomation(stats: { approvalRate: number; rejectionRate: number; totalReviews: number }): boolean {
    return stats.approvalRate >= 95 && stats.rejectionRate <= 5 && stats.totalReviews >= 20;
  }

  private safePercentage(part: number, total: number): number {
    if (total === 0) return 0;
    return (part / total) * 100;
  }
}

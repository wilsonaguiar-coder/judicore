import { ReviewStudioRepository } from "./review-studio.repository";

export type TimelineEvent = {
  id: string;
  type: "AUDIT_CREATED" | "SUGGESTION_CREATED" | "DECISION_CREATED" | "REWRITE_CREATED" | "RE_AUDIT_CREATED" | "VERSION_RECOMMENDED";
  timestamp: Date;
  details: any;
};

export type ReviewTimeline = {
  sessionId: string;
  versions: any[];
  events: TimelineEvent[];
  recommendedVersionId?: string;
};

export class ReviewStudioTimelineService {
  private repo = new ReviewStudioRepository();

  public async buildTimeline(sessionId: string): Promise<ReviewTimeline> {
    const session = await this.repo.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    const events: TimelineEvent[] = [];

    // Audits
    session.audits.forEach((a: any) => {
      events.push({
        id: a.id,
        type: "AUDIT_CREATED",
        timestamp: a.createdAt,
        details: { score: (a.auditJson as any)?.score }
      });
    });

    // Suggestions
    session.suggestions.forEach((s: any) => {
      events.push({
        id: s.id,
        type: "SUGGESTION_CREATED",
        timestamp: s.createdAt,
        details: { ruleCode: s.ruleCode, provider: s.provider }
      });
    });

    // Decisions
    session.decisions.forEach((d: any) => {
      events.push({
        id: d.id,
        type: "DECISION_CREATED",
        timestamp: d.createdAt,
        details: { ruleCode: d.ruleCode, status: d.status, reviewedBy: d.reviewedBy }
      });
    });

    // Rewrites
    session.rewrites.forEach((r: any) => {
      events.push({
        id: r.id,
        type: "REWRITE_CREATED",
        timestamp: r.createdAt,
        details: { provider: r.provider, taskId: r.taskId }
      });
    });

    // Re-Audits
    session.reAudits.forEach((ra: any) => {
      events.push({
        id: ra.id,
        type: "RE_AUDIT_CREATED",
        timestamp: ra.createdAt,
        details: { improved: ra.improved, regressed: ra.regressed, metrics: ra.metricsJson }
      });
    });

    // Recommended Version
    const recommendedVersion = session.versions.find((v: any) => v.isRecommended);
    if (recommendedVersion) {
      events.push({
        id: `rec-${recommendedVersion.id}`,
        type: "VERSION_RECOMMENDED",
        timestamp: recommendedVersion.updatedAt || recommendedVersion.createdAt,
        details: { versionNumber: recommendedVersion.versionNumber }
      });
    }

    // Sort events by timestamp ascending
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      sessionId,
      versions: session.versions,
      events,
      recommendedVersionId: recommendedVersion?.id
    };
  }
}

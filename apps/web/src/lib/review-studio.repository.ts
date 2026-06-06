import { PrismaClient, Prisma } from "@prisma/client";

export type ReviewSessionWithRelations = Prisma.ReviewSessionGetPayload<{
  include: {
    audits: true;
    suggestions: true;
    decisions: true;
    rewrites: true;
    reAudits: true;
    versions: {
      orderBy: { versionNumber: "asc" }
    };
  };
}>;

// Global instance to prevent multiple connections in dev
const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export class ReviewStudioRepository {
  public async createSession(pieceId: string, userId: string, domain: string, originalDraft: string): Promise<ReviewSessionWithRelations> {
    const session = await prisma.reviewSession.create({
      data: {
        pieceId,
        userId,
        domain,
        originalDraft,
      },
    });

    // Create ORIGINAL version snapshot
    await this.createDraftVersion(session.id, "ORIGINAL", null, 1, originalDraft, { createdVia: "session_init" });

    // Return the full session with include to match getSession return type
    const refreshedSession = await this.getSession(session.id);
    if (!refreshedSession) {
      throw new Error("Failed to retrieve created session");
    }
    return refreshedSession;
  }

  public async getSession(sessionId: string): Promise<ReviewSessionWithRelations | null> {
    return prisma.reviewSession.findUnique({
      where: { id: sessionId },
      include: {
        audits: true,
        suggestions: true,
        decisions: true,
        rewrites: true,
        reAudits: true,
        versions: {
          orderBy: { versionNumber: "asc" }
        }
      },
    });
  }

  public async saveAudit(sessionId: string, auditJson: any, feedbackJson: any, correctionPlanJson: any, guidedRevisionJson: any) {
    return prisma.reviewAudit.create({
      data: {
        sessionId,
        auditJson,
        feedbackJson,
        correctionPlanJson,
        guidedRevisionJson,
      },
    });
  }

  public async saveSuggestion(sessionId: string, taskId: string, ruleCode: string, provider: string, suggestionJson: any) {
    return prisma.reviewSuggestion.create({
      data: {
        sessionId,
        taskId,
        ruleCode,
        provider,
        suggestionJson,
      },
    });
  }

  public async saveDecision(sessionId: string, taskId: string, ruleCode: string, status: string, reviewedBy: string, notes?: string | null) {
    return prisma.reviewDecision.create({
      data: {
        sessionId,
        taskId,
        ruleCode,
        status,
        reviewedBy,
        notes: notes || null,
      },
    });
  }

  public async saveRewrite(sessionId: string, taskId: string, provider: string, originalDraftSnapshot: string, rewrittenDraft: string) {
    const rewrite = await prisma.reviewRewrite.create({
      data: {
        sessionId,
        taskId,
        provider,
        originalDraftSnapshot,
        rewrittenDraft,
        requiresHumanReview: true,
      },
    });

    const lastVersion = await prisma.reviewDraftVersion.findFirst({
      where: { sessionId },
      orderBy: { versionNumber: "desc" },
    });
    const nextVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 2;

    await this.createDraftVersion(
      sessionId,
      "REWRITE",
      rewrite.id,
      nextVersionNumber,
      rewrittenDraft,
      { taskId, provider }
    );

    return rewrite;
  }

  public async saveReAudit(sessionId: string, rewriteId: string, originalAuditJson: any, rewrittenAuditJson: any, metricsJson: any, improved: boolean, regressed: boolean) {
    return prisma.reviewReAudit.create({
      data: {
        sessionId,
        rewriteId,
        originalAuditJson,
        rewrittenAuditJson,
        metricsJson,
        improved,
        regressed,
      },
    });
  }

  public async listHistory(pieceId: string) {
    return prisma.reviewSession.findMany({
      where: { pieceId },
      orderBy: { createdAt: "desc" },
    });
  }

  public async createDraftVersion(
    sessionId: string,
    sourceType: string,
    rewriteId: string | null,
    versionNumber: number,
    content: string,
    metadataJson: any,
    score?: number | null,
    status?: string | null
  ) {
    return prisma.reviewDraftVersion.create({
      data: {
        sessionId,
        sourceType,
        rewriteId,
        versionNumber,
        content,
        metadataJson,
        score: score || null,
        status: status || null
      }
    });
  }

  public async listDraftVersions(sessionId: string) {
    return prisma.reviewDraftVersion.findMany({
      where: { sessionId },
      orderBy: { versionNumber: "asc" }
    });
  }

  public async getDraftVersion(versionId: string) {
    return prisma.reviewDraftVersion.findUnique({
      where: { id: versionId }
    });
  }

  public async markRecommendedVersion(versionId: string) {
    const version = await this.getDraftVersion(versionId);
    if (!version) throw new Error("Version not found");

    // Clear recommended flag for all versions in the session
    await prisma.reviewDraftVersion.updateMany({
      where: { sessionId: version.sessionId },
      data: { isRecommended: false }
    });

    // Set recommended flag
    return prisma.reviewDraftVersion.update({
      where: { id: versionId },
      data: { isRecommended: true }
    });
  }

  public async compareVersions(versionAId: string, versionBId: string) {
    const vA = await this.getDraftVersion(versionAId);
    const vB = await this.getDraftVersion(versionBId);
    if (!vA || !vB) throw new Error("Versions not found");

    return {
      versionA: {
        number: vA.versionNumber,
        score: vA.score,
        status: vA.status,
        createdAt: vA.createdAt
      },
      versionB: {
        number: vB.versionNumber,
        score: vB.score,
        status: vB.status,
        createdAt: vB.createdAt
      }
    };
  }
}

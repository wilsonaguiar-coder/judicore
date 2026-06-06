import { NextResponse } from "next/server";
import { ReviewStudioRepository } from "@/lib/review-studio.repository";
import { getReviewStore } from "@/lib/review-studio.mock-store";
import { AuditService } from "@judicore/ai";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const repo = new ReviewStudioRepository();
  let session = await repo.getSession(params.id);

  if (!session) {
    const fallbackStore = getReviewStore(params.id);
    session = await repo.createSession(
      params.id,
      "user-1",
      "CIVIL_PETICAO_INICIAL",
      fallbackStore.originalDraft || "Documento teste"
    );

    const auditService = new AuditService();
    const auditResult = auditService.auditGeneratedDocument(params.id, session.originalDraft, "CIVIL_PETICAO_INICIAL" as any);

    await repo.saveAudit(
      session.id,
      auditResult as any,
      auditResult.feedback as any,
      auditResult.correctionPlan as any,
      (auditResult as any).guidedRevision
    );

    session = await repo.getSession(session.id);
  }

  const latestAudit = session?.audits?.[session.audits.length - 1];

  return NextResponse.json({
    audit: latestAudit?.auditJson || null,
    correctionPlan: latestAudit?.correctionPlanJson || null,
    session
  });
}

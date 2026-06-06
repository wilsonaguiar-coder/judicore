import { NextResponse } from "next/server";
import { getReviewStore } from "@/lib/review-studio.mock-store";
import { AuditService } from "@judicore/ai";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const store = getReviewStore(params.id);

  if (!store.audit) {
    // Generate audit using real service
    const auditService = new AuditService();
    store.audit = auditService.auditGeneratedDocument(params.id, store.originalDraft, store.classification);
    store.correctionPlan = store.audit.correctionPlan; // Simulated connection
  }

  return NextResponse.json({
    audit: store.audit,
    correctionPlan: store.correctionPlan
  });
}

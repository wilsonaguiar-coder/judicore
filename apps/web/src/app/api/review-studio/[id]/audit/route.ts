import { NextResponse } from "next/server";
import { ReviewStudioRepository } from "@/lib/review-studio.repository";
import { getReviewStore } from "@/lib/review-studio.mock-store";
import { AuditService } from "@judicore/ai";
import type { LegalClassification } from "@judicore/ai";

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
    const classification: LegalClassification = {
      tipo_justica: "ESTADUAL",
      tipo_peca: "PETICAO_INICIAL",
      regime_juridico: "CIVIL",
      grau: "PRIMEIRO",
      tribunal_competente: "TJSP",
      rito: null,
      assunto_principal: "Mock Assunto",
      partes: { autor: "Mock Autor", reu: "Mock Reu" },
      confianca: 1
    };
    const auditResult = await auditService.auditGeneratedDocument(params.id, session.originalDraft, classification);

    await repo.saveAudit(
      session.id,
      auditResult.audit,
      auditResult.feedback || null,
      auditResult.correctionPlan || null,
      null
    );

    const refreshedSession = await repo.getSession(session.id);
    if (!refreshedSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    session = refreshedSession;
  }

  const latestAudit = session?.audits?.[session.audits.length - 1];

  return NextResponse.json({
    audit: latestAudit?.auditJson || null,
    correctionPlan: latestAudit?.correctionPlanJson || null,
    session
  });
}

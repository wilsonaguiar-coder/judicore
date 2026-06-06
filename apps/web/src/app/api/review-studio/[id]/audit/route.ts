import { NextResponse } from "next/server";
import { ReviewStudioRepository } from "@/lib/review-studio.repository";
import { getReviewStore } from "@/lib/review-studio.mock-store";
import { AuditService } from "@judicore/ai";
import type { LegalClassification } from "@judicore/ai";
import { DEMO_DOCUMENT_ID, DEMO_DRAFT } from "@/lib/review-studio.demo";

// ─── Default classification for demo/unknown docs ────────────────────────────
const DEFAULT_CLASSIFICATION: LegalClassification = {
  tipo_justica: "ESTADUAL",
  tipo_peca: "PETICAO_INICIAL",
  regime_juridico: "CIVIL",
  grau: "PRIMEIRO",
  tribunal_competente: "TJSP",
  rito: null,
  assunto_principal: "Indenização por Danos",
  partes: { autor: "Autor", reu: "Réu" },
  confianca: 0.9,
};

async function runAuditForSession(
  repo: ReviewStudioRepository,
  docId: string,
  draft: string
) {
  let session = await repo.getSessionByPieceId(docId);

  if (!session) {
    session = await repo.createSession(docId, "user-1", "CIVIL_PETICAO_INICIAL", draft);
  }

  const auditService = new AuditService();
  const auditResult = await auditService.auditGeneratedDocument(
    session.id,
    session.originalDraft,
    DEFAULT_CLASSIFICATION
  );

  await repo.saveAudit(
    session.id,
    auditResult.audit,
    auditResult.feedback || null,
    auditResult.correctionPlan || null,
    null
  );

  return await repo.getSession(session.id);
}

// ─── GET — return existing audit without triggering a new one ────────────────
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const repo = new ReviewStudioRepository();
  const session = await repo.getSessionByPieceId(params.id);

  if (!session) {
    return NextResponse.json({ audit: null, correctionPlan: null, session: null });
  }

  const latestAudit = session?.audits?.[session.audits.length - 1];

  return NextResponse.json({
    audit: latestAudit?.auditJson ?? null,
    correctionPlan: latestAudit?.correctionPlanJson ?? null,
    session,
  });
}

// ─── POST — trigger a new audit (demo mode: uses DEMO_DRAFT for teste-1) ─────
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const repo = new ReviewStudioRepository();

  // Try to parse draft from request body
  let draft = "";
  try {
    const body = await req.json().catch(() => ({}));
    draft = (body as any)?.draft ?? "";
  } catch {
    draft = "";
  }

  // Demo mode / fallback
  if (!draft || params.id === DEMO_DOCUMENT_ID) {
    const store = getReviewStore(params.id);
    draft = store.originalDraft || DEMO_DRAFT;
  }

  try {
    const session = await runAuditForSession(repo, params.id, draft);

    if (!session) {
      return NextResponse.json({ error: "Session not found after audit" }, { status: 500 });
    }

    const latestAudit = session?.audits?.[session.audits.length - 1];

    return NextResponse.json({
      audit: latestAudit?.auditJson ?? null,
      correctionPlan: latestAudit?.correctionPlanJson ?? null,
      session,
    });
  } catch (err: any) {
    console.error("[audit POST] Error:", err);
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
  }
}

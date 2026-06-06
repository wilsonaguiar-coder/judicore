import { NextResponse } from "next/server";
import { ReviewStudioRepository } from "@/lib/review-studio.repository";
import { ReAuditService } from "@judicore/ai";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const repo = new ReviewStudioRepository();
  const session = await repo.getSessionByPieceId(params.id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await req.json();
  const { originalDraft, rewrittenDraft, classification } = body;

  if (!originalDraft || !rewrittenDraft || !classification) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const service = new ReAuditService();
  const result = service.runReAudit({
    originalDraft,
    rewrittenDraft,
    classification
  });

  await repo.saveReAudit(
    session.id,
    "rewrite-fallback-id",
    result.originalAudit,
    result.rewrittenAudit,
    result.metrics,
    result.improved,
    result.regressed
  );

  return NextResponse.json(result);
}

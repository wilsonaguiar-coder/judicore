import { NextResponse } from "next/server";
import { getReviewStore } from "@/lib/review-studio.mock-store";
import { ReAuditService } from "@judicore/ai";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const store = getReviewStore(params.id);
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

  store.reAuditResult = result;

  return NextResponse.json(result);
}

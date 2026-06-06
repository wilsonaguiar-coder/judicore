import { NextResponse } from "next/server";
import { ReviewStudioRepository } from "@/lib/review-studio.repository";
import { HumanReviewService } from "@judicore/ai";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const repo = new ReviewStudioRepository();
  const session = await repo.getSessionByPieceId(params.id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await req.json();
  const { taskId, ruleCode, decision, status } = body;

  // Accept both `decision` and `status` field names
  const resolvedDecision: string | undefined = decision ?? status;
  const resolvedRuleCode: string = ruleCode ?? "UNKNOWN";

  if (!taskId || !resolvedDecision) {
    return NextResponse.json({ error: "taskId and decision are required" }, { status: 400 });
  }

  const service = new HumanReviewService();
  const baseDecision = service.createDecision(taskId, resolvedRuleCode);

  let result;
  if (resolvedDecision === "APPROVED") {
    result = service.approve(baseDecision, "usuario-mock-ui", "Aprovado pela UI");
  } else if (resolvedDecision === "REJECTED") {
    result = service.reject(baseDecision, "usuario-mock-ui", "Rejeitado pela UI");
  } else {
    result = service.skip(baseDecision, "usuario-mock-ui", "Pulado pela UI");
  }

  await repo.saveDecision(
    session.id,
    taskId,
    result.ruleCode ?? resolvedRuleCode,
    result.status ?? resolvedDecision,
    result.reviewedBy ?? "system",
    result.notes ?? undefined
  );

  return NextResponse.json({
    decision: {
      status: result.status ?? resolvedDecision,
      taskId,
      ruleCode: result.ruleCode ?? resolvedRuleCode,
      reviewedAt: new Date().toISOString(),
    },
  });
}

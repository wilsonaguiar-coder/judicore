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
  const { taskId, decision } = body;

  if (!taskId || !decision) {
    return NextResponse.json({ error: "taskId and decision are required" }, { status: 400 });
  }

  const service = new HumanReviewService();
  let baseDecision = service.createDecision(taskId, "UNKNOWN");
  
  let result;
  if (decision === "APPROVED") {
    result = service.approve(baseDecision, "usuario-mock-ui", "Aprovado pela UI");
  } else if (decision === "REJECTED") {
    result = service.reject(baseDecision, "usuario-mock-ui", "Rejeitado pela UI");
  } else {
    result = service.skip(baseDecision, "usuario-mock-ui", "Pulado pela UI");
  }

  await repo.saveDecision(
    session.id,
    taskId,
    result.ruleCode,
    result.status || "APPROVED",
    result.reviewedBy || "system",
    result.notes || undefined
  );

  return NextResponse.json(result);
}

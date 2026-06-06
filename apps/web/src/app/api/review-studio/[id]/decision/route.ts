import { NextResponse } from "next/server";
import { getReviewStore } from "@/lib/review-studio.mock-store";
import { HumanReviewService } from "@judicore/ai";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const store = getReviewStore(params.id);
  const body = await req.json();
  const { taskId, decision } = body;

  if (!taskId || !decision) {
    return NextResponse.json({ error: "taskId and decision are required" }, { status: 400 });
  }

  const suggestion = store.suggestions[taskId];
  if (!suggestion) {
    return NextResponse.json({ error: "No suggestion found for this task" }, { status: 404 });
  }

  const service = new HumanReviewService();
  let baseDecision = service.createDecision(taskId, suggestion.ruleCode);
  
  let result;
  if (decision === "APPROVED") {
    result = service.approve(baseDecision, "usuario-mock-ui", "Aprovado pela UI");
  } else if (decision === "REJECTED") {
    result = service.reject(baseDecision, "usuario-mock-ui", "Rejeitado pela UI");
  } else {
    result = service.skip(baseDecision, "usuario-mock-ui", "Pulado pela UI");
  }

  store.decisions[taskId] = result;

  return NextResponse.json(result);
}

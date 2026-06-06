import { NextResponse } from "next/server";
import { ReviewStudioRepository } from "@/lib/review-studio.repository";
import { AssistedRevisionService } from "@judicore/ai";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const repo = new ReviewStudioRepository();
  const session = await repo.getSession(params.id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await req.json();
  const { taskId } = body;

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const taskMock = {
    id: taskId,
    code: "UNADDRESSED_MAIN_REQUEST",
    priority: "HIGH" as any,
    area: "M\u00C9RITO" as any,
    instruction: "Resolver a contradi\u00E7\u00E3o",
    completed: false
  };

  const service = new AssistedRevisionService();
  const suggestion = service.createDeterministicSuggestion(taskMock);

  await repo.saveSuggestion(
    session.id,
    taskId,
    (suggestion as any).ruleCode,
    (suggestion as any).provider,
    suggestion as any
  );

  return NextResponse.json(suggestion);
}

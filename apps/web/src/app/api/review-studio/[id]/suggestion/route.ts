import { NextResponse } from "next/server";
import { getReviewStore } from "@/lib/review-studio.mock-store";
import { AssistedRevisionService } from "@judicore/ai";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const store = getReviewStore(params.id);
  const body = await req.json();
  const { taskId } = body;

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  // Hardcode a fake task just to satisfy the GuidedRevision interface for now, 
  // since the mock store might not have full task population in this phase.
  const taskMock = {
    id: taskId,
    code: "UNADDRESSED_MAIN_REQUEST",
    priority: "HIGH" as const,
    area: "M\u00C9RITO" as const,
    instruction: "Resolver a contradi\u00E7\u00E3o",
    completed: false
  };

  const service = new AssistedRevisionService();
  const suggestion = service.createDeterministicSuggestion(taskMock);

  store.suggestions[taskId] = suggestion;

  return NextResponse.json(suggestion);
}

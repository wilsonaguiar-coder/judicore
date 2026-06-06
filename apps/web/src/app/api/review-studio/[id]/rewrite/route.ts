import { NextResponse } from "next/server";
import { getReviewStore } from "@/lib/review-studio.mock-store";
import { RewriteService } from "@judicore/ai";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const store = getReviewStore(params.id);
  const body = await req.json();
  const { taskId, suggestionStr } = body;

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const taskMock = {
    id: taskId,
    code: "UNADDRESSED_MAIN_REQUEST",
    priority: "HIGH" as const,
    area: "M\u00C9RITO" as const,
    instruction: "Resolver a contradi\u00E7\u00E3o",
    completed: false
  };

  const service = new RewriteService();
  const result = await service.generateRewrittenDraft({
    draft: store.originalDraft,
    task: taskMock,
    suggestion: suggestionStr || "Corrigir os defeitos detectados.",
    provider: "DEEPSEEK"
  });

  store.rewriteResults[taskId] = result;

  return NextResponse.json(result);
}

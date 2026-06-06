import { NextResponse } from "next/server";
import { ReviewStudioRepository } from "@/lib/review-studio.repository";
import { RewriteService } from "@judicore/ai";
import { RevisionTask } from "@judicore/ai";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const repo = new ReviewStudioRepository();
  const session = await repo.getSessionByPieceId(params.id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await req.json();
  const { taskId, suggestionStr } = body;

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const taskMock: RevisionTask = {
    id: taskId,
    code: "UNADDRESSED_MAIN_REQUEST",
    priority: "HIGH",
    area: "M\u00C9RITO",
    instruction: "Resolver a contradi\u00E7\u00E3o",
    completed: false
  };

  const service = new RewriteService();
  const result = await service.generateRewrittenDraft({
    draft: session.originalDraft,
    task: taskMock,
    suggestion: suggestionStr || "Corrigir os defeitos detectados.",
    provider: "DEEPSEEK"
  });

  await repo.saveRewrite(
    session.id,
    taskId,
    result.provider,
    result.originalDraft,
    result.rewrittenDraft
  );

  return NextResponse.json(result);
}

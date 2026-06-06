import { NextResponse } from "next/server";
import { ReviewStudioRepository } from "@/lib/review-studio.repository";
import { RewriteService } from "@judicore/ai";
import type { RevisionTask } from "@judicore/ai";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const repo = new ReviewStudioRepository();
  const session = await repo.getSessionByPieceId(params.id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!session.originalDraft) {
    return NextResponse.json({ error: "Session has no original draft" }, { status: 400 });
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { taskId, provider, task: taskBody, suggestion: suggestionBody, suggestionStr } = body;

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  if (!taskBody && !suggestionBody && !suggestionStr) {
    return NextResponse.json({ error: "task and suggestion are required" }, { status: 400 });
  }

  const task: RevisionTask = taskBody
    ? {
        id: taskBody.id ?? taskId,
        code: taskBody.code ?? "UNADDRESSED_MAIN_REQUEST",
        priority: taskBody.priority ?? "HIGH",
        area: taskBody.area ?? "MÉRITO",
        instruction: taskBody.instruction ?? "Resolver a contradição",
        completed: false,
      }
    : {
        id: taskId,
        code: suggestionBody?.code ?? "UNADDRESSED_MAIN_REQUEST",
        priority: "HIGH",
        area: "MÉRITO",
        instruction: suggestionBody?.instruction ?? "Resolver a contradição",
        completed: false,
      };

  const suggestionText: string =
    suggestionBody?.suggestion ?? suggestionStr ?? "Corrigir os defeitos detectados.";

  const resolvedProvider = provider ?? "DEEPSEEK";

  const service = new RewriteService();
  try {
    const result = await service.generateRewrittenDraft({
      draft: session.originalDraft,
      task,
      suggestion: suggestionText,
      provider: resolvedProvider,
    });

    await repo.saveRewrite(
      session.id,
      taskId,
      result.provider,
      result.originalDraft,
      result.rewrittenDraft
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Rewrite service failed";
    console.error("[rewrite/route] service error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

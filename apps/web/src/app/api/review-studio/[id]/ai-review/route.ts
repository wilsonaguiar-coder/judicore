import { NextResponse } from "next/server";
import { AiLegalStrengthReviewerService } from "@judicore/ai";
import type { AiLegalStrengthReviewRequest } from "@judicore/ai";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json() as Partial<AiLegalStrengthReviewRequest>;

    if (!body.draft || !body.audit) {
      return NextResponse.json(
        { error: "draft e audit são obrigatórios" },
        { status: 400 }
      );
    }

    const service = new AiLegalStrengthReviewerService(
      process.env["DEEPSEEK_API_KEY"],
      process.env["OPENAI_API_KEY"],
    );

    const result = await service.review({
      draft: body.draft,
      classification: body.classification ?? "CIVIL_PETICAO_INICIAL",
      audit: body.audit,
      ...(body.domain            !== undefined && { domain:             body.domain }),
      ...(body.pieceType         !== undefined && { pieceType:          body.pieceType }),
      ...(body.correctionPlan    !== undefined && { correctionPlan:     body.correctionPlan }),
      ...(body.provider          !== undefined && { provider:           body.provider }),
      ...(body.availableDocuments !== undefined && { availableDocuments: body.availableDocuments }),
      ...(body.extractedEntities  !== undefined && { extractedEntities:  body.extractedEntities }),
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[ai-review POST] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

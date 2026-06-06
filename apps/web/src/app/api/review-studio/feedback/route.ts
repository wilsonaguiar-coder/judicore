import { NextResponse } from "next/server";
import { StrengthReviewTelemetryService } from "@judicore/ai";
import type { FeedbackValue } from "@judicore/ai";

interface FeedbackBody {
  findingId: string;
  findingType: string;
  opportunityLevel: string;
  domain?: string;
  feedback: FeedbackValue;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Partial<FeedbackBody>;

    if (!body.findingId || !body.findingType || !body.opportunityLevel || !body.feedback) {
      return NextResponse.json(
        { error: "findingId, findingType, opportunityLevel e feedback são obrigatórios" },
        { status: 400 },
      );
    }

    if (body.feedback !== "USEFUL" && body.feedback !== "NOT_USEFUL") {
      return NextResponse.json(
        { error: "feedback deve ser USEFUL ou NOT_USEFUL" },
        { status: 400 },
      );
    }

    const telemetry = new StrengthReviewTelemetryService();
    telemetry.recordFeedback({
      findingId: body.findingId,
      findingType: body.findingType,
      opportunityLevel: body.opportunityLevel,
      domain: body.domain,
      feedback: body.feedback,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[feedback POST] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

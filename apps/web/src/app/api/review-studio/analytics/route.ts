import { NextResponse } from "next/server";
import { StrengthReviewTelemetryService } from "@judicore/ai";

export async function GET() {
  try {
    const telemetry = new StrengthReviewTelemetryService();
    const analytics = telemetry.getAnalytics();
    return NextResponse.json(analytics);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[analytics GET] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

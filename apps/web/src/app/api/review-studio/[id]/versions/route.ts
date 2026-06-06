import { NextResponse } from "next/server";
import { ReviewStudioTimelineService } from "@/lib/review-studio.timeline";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const timelineSvc = new ReviewStudioTimelineService();
    const timeline = await timelineSvc.buildTimeline(params.id);
    return NextResponse.json(timeline);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}

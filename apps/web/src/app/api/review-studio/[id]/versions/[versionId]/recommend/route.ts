import { NextResponse } from "next/server";
import { ReviewStudioRepository } from "@/lib/review-studio.repository";

export async function POST(req: Request, { params }: { params: { id: string, versionId: string } }) {
  try {
    const repo = new ReviewStudioRepository();
    const version = await repo.markRecommendedVersion(params.versionId);
    return NextResponse.json(version);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

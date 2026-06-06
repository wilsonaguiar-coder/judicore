import { NextResponse } from "next/server";
import { ReviewStudioRepository } from "@/lib/review-studio.repository";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { versionAId, versionBId } = body;
    
    if (!versionAId || !versionBId) {
      return NextResponse.json({ error: "Missing version IDs" }, { status: 400 });
    }

    const repo = new ReviewStudioRepository();
    const comparison = await repo.compareVersions(versionAId, versionBId);
    
    return NextResponse.json(comparison);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

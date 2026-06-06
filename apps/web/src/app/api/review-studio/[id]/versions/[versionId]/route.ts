import { NextResponse } from "next/server";
import { ReviewStudioRepository } from "@/lib/review-studio.repository";

export async function GET(req: Request, { params }: { params: { id: string, versionId: string } }) {
  try {
    const repo = new ReviewStudioRepository();
    const version = await repo.getDraftVersion(params.versionId);
    if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });
    return NextResponse.json(version);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

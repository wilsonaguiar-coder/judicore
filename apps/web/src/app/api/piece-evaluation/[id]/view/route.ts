import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@judicore/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const generation = await prisma.pieceGeneration.findUnique({
      where: { id }
    });

    if (!generation) {
      return NextResponse.json({ error: "Geração não encontrada." }, { status: 404 });
    }

    if (!generation.viewedAt) {
      await prisma.pieceGeneration.update({
        where: { id },
        data: { viewedAt: new Date() }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro no track view:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

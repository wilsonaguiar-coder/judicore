import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@judicore/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { rating, category, feedback } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Nota inválida." }, { status: 400 });
    }

    const generation = await prisma.pieceGeneration.findUnique({
      where: { id }
    });

    if (!generation) {
      return NextResponse.json({ error: "Geração não encontrada." }, { status: 404 });
    }

    // Marca o horário da avaliação na geração
    await prisma.pieceGeneration.update({
      where: { id },
      data: { evaluatedAt: new Date() }
    });

    const evaluation = await prisma.pieceEvaluation.create({
      data: {
        generationId: id,
        userId: generation.userId,
        rating,
        category: category || null,
        feedback: feedback || null
      }
    });

    return NextResponse.json({ success: true, evaluation });
  } catch (error: any) {
    console.error("Erro na avaliação:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

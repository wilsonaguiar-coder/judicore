import { NextRequest, NextResponse } from "next/server";
import { GenerationPipeline } from "@judicore/ai/src/generation-pipeline/generation.pipeline.js";

// Limite de timeout da API (Vercel maxDuration) - 60s em Hobby, maior em Pro
export const maxDuration = 300; 

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    // Obter campos de texto
    const userId = formData.get("userId") as string;
    const pieceType = formData.get("pieceType") as string;
    const userOrientation = formData.get("userOrientation") as string;
    
    if (!userId || !pieceType) {
      return NextResponse.json({ error: "Parâmetros obrigatórios ausentes." }, { status: 400 });
    }

    // Obter arquivos
    const files: { buffer: Buffer; mimeType: string; category: string }[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file_") && value instanceof File) {
        const category = formData.get(`category_${key.split("_")[1]}`) as string || "Outros";
        const arrayBuffer = await value.arrayBuffer();
        files.push({
          buffer: Buffer.from(arrayBuffer),
          mimeType: value.type,
          category
        });
      }
    }

    // Executar Pipeline Síncrono
    const { draft, generationId } = await GenerationPipeline.execute({
      userId,
      pieceType,
      userOrientation,
      files
    });

    return NextResponse.json({ success: true, draft, generationId });
  } catch (error: any) {
    console.error("Erro na geração da peça:", error);
    return NextResponse.json({ error: error.message || "Erro interno do servidor" }, { status: 500 });
  }
}

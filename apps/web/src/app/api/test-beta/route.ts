import { NextResponse } from "next/server";
import { GenerationPipeline } from "@judicore/ai";
import { prisma } from "@judicore/db";

export async function GET() {
  try {
    const input = {
      userId: "user_teste_123",
      pieceType: "Petição Inicial",
      userOrientation: "peticionar pela procedência de pedido de paridade de pensão de ex-servidora federal, falecida após a ec 41/2003. O autor é João da Silva, marido da falecida Maria da Silva. CPF 123.456.789-00, residente na Rua das Flores, 123, Brasília, DF, CEP 70000-000.",
      files: [
        {
          buffer: Buffer.from("Documento de identificação: João da Silva, CPF 123.456.789-00. Endereço: Rua das Flores, 123, Brasília, DF, CEP 70000-000. Fatos: Sua esposa Maria da Silva, servidora pública federal, faleceu em 2005. O Ministério Público negou a paridade da pensão."),
          mimeType: "text/plain",
          category: "Documentos Pessoais"
        }
      ]
    };

    const result = await GenerationPipeline.execute(input);
    
    const snapshot = await prisma.pieceGenerationSnapshot.findUnique({
      where: { generationId: result.generationId }
    });

    const gen = await prisma.pieceGeneration.findUnique({
      where: { id: result.generationId }
    });

    return NextResponse.json({
      success: true,
      draft: result.draft,
      generationId: result.generationId,
      snapshot,
      gen
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

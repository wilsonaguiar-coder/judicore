import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@judicore/db";

const AUDIT_SYSTEM_PROMPT = `DOCUMENTO GERADO PELO WRITER.

Sua função NÃO é reescrever.

Você é um auditor técnico jurídico.

Indique exclusivamente:

1. Fatos afirmados sem suporte documental.
2. Precedentes utilizados de forma inadequada.
3. Dispositivos legais incompatíveis.
4. Pedidos sem amparo na narrativa.
5. Lacunas probatórias relevantes.
6. Teses contrárias relevantes omitidas.
7. Grau de risco processual.
8. Checklist processual: competência, legitimidade ativa/passiva, valor da causa adequado, gratuidade de justiça (se requerida).

Para cada item encontrado, indique o grau de risco:
🔴 ALTO — compromete a ação
🟡 MÉDIO — requer atenção
🟢 BAIXO — observação técnica

NÃO suavize a tese.
NÃO transforme a peça em parecer.
NÃO reescreva o documento.`;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const generation = await prisma.pieceGeneration.findUnique({
      where: { id: params.id },
      include: { snapshot: true },
    });

    if (!generation?.generatedText) {
      return NextResponse.json({ error: "Geração não encontrada" }, { status: 404 });
    }

    const snap = generation.snapshot;

    const userContent = [
      `TIPO DE PEÇA: ${generation.pieceType}`,
      `ORIENTAÇÃO DO USUÁRIO: ${generation.userOrientation ?? "Não informada"}`,
      "",
      "--- RESUMO FÁTICO (PieceBrief) ---",
      JSON.stringify(snap?.pieceBriefJson ?? {}, null, 2),
      "",
      "--- DADOS EXTRAÍDOS DOS DOCUMENTOS ---",
      JSON.stringify(snap?.qualificationJson ?? {}, null, 2),
      "",
      "--- MATRIZ JURÍDICA UTILIZADA ---",
      JSON.stringify(snap?.legalMatrixJson ?? {}, null, 2),
      "",
      "--- PEÇA GERADA ---",
      generation.generatedText,
    ].join("\n");

    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("OPENAI_API_KEY não definida");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.5",
        max_completion_tokens: 4096,
        messages: [
          { role: "system", content: AUDIT_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI Audit Error: ${response.status} — ${err}`);
    }

    const data = (await response.json()) as any;
    const auditText: string = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!auditText) throw new Error("GPT-5.5 não retornou relatório de auditoria.");

    const auditResult = {
      text: auditText,
      model: "gpt-5.5",
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      auditedAt: new Date().toISOString(),
    };

    if (snap) {
      await prisma.pieceGenerationSnapshot.update({
        where: { id: snap.id },
        data: { legalAuditJson: auditResult as any },
      });
    }

    return NextResponse.json({ audit: auditResult });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Erro na auditoria" },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const snap = await prisma.pieceGenerationSnapshot.findUnique({
    where: { generationId: params.id },
    select: { legalAuditJson: true },
  });

  if (!snap?.legalAuditJson) {
    return NextResponse.json({ audit: null });
  }

  return NextResponse.json({ audit: snap.legalAuditJson });
}

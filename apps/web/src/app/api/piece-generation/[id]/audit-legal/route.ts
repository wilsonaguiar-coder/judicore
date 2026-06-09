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

    // Extrai fatos-chave do brief sem enviar JSON completo (reduz tokens)
    const brief = snap?.pieceBriefJson as any;
    const briefResumo = brief
      ? [
          brief.resumoFatico ?? brief.resumo ?? "",
          Array.isArray(brief.fatosRelevantes) ? brief.fatosRelevantes.join("; ") : "",
          Array.isArray(brief.pedidosIdentificados) ? brief.pedidosIdentificados.join("; ") : "",
        ].filter(Boolean).join("\n")
      : "Não disponível";

    const qual = snap?.qualificationJson as any;
    const qualResumo = qual
      ? Object.entries(qual)
          .filter(([, v]: any) => v?.value)
          .map(([k, v]: any) => `${k}: ${v.value}`)
          .join(", ")
      : "Não disponível";

    const userContent = [
      `TIPO DE PEÇA: ${generation.pieceType}`,
      `ORIENTAÇÃO DO USUÁRIO: ${generation.userOrientation ?? "Não informada"}`,
      "",
      "--- DADOS DO CLIENTE EXTRAÍDOS DOS DOCUMENTOS ---",
      qualResumo,
      "",
      "--- RESUMO FÁTICO ---",
      briefResumo,
      "",
      "--- PEÇA GERADA PELO WRITER ---",
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
        max_completion_tokens: 16000,
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
    const msg = data.choices?.[0]?.message;
    // GPT-5.5 (reasoning model) pode retornar conteúdo em reasoning_content quando content é null
    const auditText: string =
      msg?.content?.trim() || msg?.reasoning_content?.trim() || "";
    const finishReason: string = data.choices?.[0]?.finish_reason ?? "UNKNOWN";
    if (!auditText) {
      throw new Error(
        `GPT-5.5 não retornou relatório (finish_reason=${finishReason}, tokens=${data.usage?.completion_tokens ?? 0}).`
      );
    }

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

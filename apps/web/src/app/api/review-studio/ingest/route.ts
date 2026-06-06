import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ReviewStudioRepository } from "@/lib/review-studio.repository";
import { extractText, isSupportedFormat, SUPPORTED_EXTENSIONS } from "@/lib/document-extractor";
import { DocumentNormalizerService } from "@/lib/document-normalizer";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  let buffer: Buffer | null = null;
  let mimeType = "text/plain";
  let filename = "";
  let pastedText: string | null = null;

  // ── Parse input ─────────────────────────────────────────────────────────────

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "FormData inválida." }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    const text = formData.get("text") as string | null;

    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `Arquivo muito grande. Limite: 20 MB. Recebido: ${(file.size / 1024 / 1024).toFixed(1)} MB.` },
          { status: 413 }
        );
      }
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!isSupportedFormat(file.type, file.name)) {
        return NextResponse.json(
          { error: `Formato não suportado: .${ext}. Formatos aceitos: ${SUPPORTED_EXTENSIONS.join(", ")}.` },
          { status: 415 }
        );
      }
      buffer = Buffer.from(await file.arrayBuffer());
      mimeType = file.type || `application/octet-stream`;
      filename = file.name;
    } else if (text && text.trim()) {
      pastedText = text;
    } else {
      return NextResponse.json({ error: "Nenhum arquivo ou texto fornecido." }, { status: 400 });
    }
  } else {
    // JSON body
    let body: Record<string, any>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }
    const text = body.text as string | undefined;
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Nenhum texto fornecido." }, { status: 400 });
    }
    pastedText = text;
  }

  // ── Extract text ────────────────────────────────────────────────────────────

  let rawText: string;
  let format: string;

  if (pastedText !== null) {
    rawText = pastedText;
    format = "TEXT_PASTE";
  } else if (buffer) {
    let extractResult;
    try {
      extractResult = await extractText(buffer, mimeType, filename);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha na extração do arquivo.";
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    if (extractResult.isScanned) {
      return NextResponse.json(
        { error: "Este PDF parece conter apenas imagens. OCR ainda não está habilitado." },
        { status: 422 }
      );
    }

    if (!extractResult.text.trim()) {
      return NextResponse.json(
        { error: "Nenhum texto encontrado no arquivo." },
        { status: 422 }
      );
    }

    rawText = extractResult.text;
    format = extractResult.format;
  } else {
    return NextResponse.json({ error: "Erro interno de parsing." }, { status: 500 });
  }

  // ── Normalize ───────────────────────────────────────────────────────────────

  const normalizer = new DocumentNormalizerService();
  const normalizedText = normalizer.normalize(rawText);

  if (!normalizedText.trim()) {
    return NextResponse.json({ error: "Nenhum texto encontrado após normalização." }, { status: 422 });
  }

  // ── Create ReviewSession ─────────────────────────────────────────────────────

  const pieceId = randomUUID();
  const repo = new ReviewStudioRepository();

  let session;
  try {
    session = await repo.createSession(
      pieceId,
      "user-1",
      "CIVIL_PETICAO_INICIAL",
      normalizedText
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao criar sessão.";
    console.error("[ingest] createSession error:", msg);
    return NextResponse.json({ error: "Erro ao criar sessão de auditoria." }, { status: 500 });
  }

  return NextResponse.json({
    sessionId: session.id,
    pieceId,
    format,
    textLength: normalizedText.length,
    originalFileName: filename || null,
    fileSize: buffer?.length ?? null,
  });
}

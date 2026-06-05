import { extractPdfText } from "./pdf-extract.js";

export interface ExtractResult {
  text: string;
  format: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function stripRtf(rtf: string): string {
  return rtf
    .replace(/\{[^{}]*\}/g, " ")      // remove groups
    .replace(/\\[a-z]+\d*\s?/g, " ")  // remove control words
    .replace(/[\\{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractText(
  buffer: Buffer,
  mimetype: string,
  filename?: string,
): Promise<ExtractResult> {
  const mt = mimetype.toLowerCase();
  const ext = (filename ?? "").split(".").pop()?.toLowerCase() ?? "";

  // PDF
  if (mt.includes("pdf") || ext === "pdf") {
    const text = await extractPdfText(buffer, filename ?? "documento.pdf");
    return { text, format: "PDF" };
  }

  // HTML / HTM
  if (mt.includes("html") || ext === "html" || ext === "htm") {
    return { text: stripHtml(buffer.toString("utf8")), format: "HTML" };
  }

  // RTF
  if (mt.includes("rtf") || ext === "rtf") {
    const raw = buffer.toString("latin1");
    return { text: stripRtf(raw).slice(0, 150_000), format: "RTF" };
  }

  // DOCX / DOC — ZIP-compressed XML: requer biblioteca externa.
  // Orientação: exporte como PDF ou cole o texto manualmente.
  if (
    mt.includes("wordprocessingml") || mt.includes("officedocument") ||
    mt.includes("msword") || ext === "docx" || ext === "doc"
  ) {
    throw new Error(
      "Formato DOCX/DOC não suportado para extração direta. " +
      "Exporte o documento como PDF (Arquivo → Salvar como PDF) ou " +
      "cole o texto no campo \"Colar Texto\" abaixo.",
    );
  }

  // Plain text / fallback
  return { text: buffer.toString("utf8"), format: "TXT" };
}

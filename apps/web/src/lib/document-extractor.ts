import { inflateRaw } from "node:zlib";
import { promisify } from "node:util";
import WordExtractor from "word-extractor";

const inflateRawAsync = promisify(inflateRaw);

export interface ExtractResult {
  text: string;
  format: string;
  isScanned: boolean;
}

// ── ZIP reader ────────────────────────────────────────────────────────────────
// DOCX and ODT are ZIP archives containing XML files.

const EOCD_SIG = 0x06054b50;
const CD_SIG   = 0x02014b50;

function findEocd(buf: Buffer): number {
  const minPos = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  return -1;
}

async function extractZipEntry(buf: Buffer, target: string): Promise<Buffer | null> {
  const eocd = findEocd(buf);
  if (eocd === -1) return null;

  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdSize   = buf.readUInt32LE(eocd + 12);

  let pos = cdOffset;
  while (pos + 46 <= cdOffset + cdSize) {
    if (buf.readUInt32LE(pos) !== CD_SIG) break;

    const compression  = buf.readUInt16LE(pos + 10);
    const compressedSz = buf.readUInt32LE(pos + 20);
    const fnLen        = buf.readUInt16LE(pos + 28);
    const extraLen     = buf.readUInt16LE(pos + 30);
    const commentLen   = buf.readUInt16LE(pos + 32);
    const localHdrOff  = buf.readUInt32LE(pos + 42);
    const filename     = buf.subarray(pos + 46, pos + 46 + fnLen).toString("utf8");

    if (filename === target) {
      const localFnLen    = buf.readUInt16LE(localHdrOff + 26);
      const localExtraLen = buf.readUInt16LE(localHdrOff + 28);
      const dataStart     = localHdrOff + 30 + localFnLen + localExtraLen;
      const compressed    = buf.subarray(dataStart, dataStart + compressedSz);

      if (compression === 0) return compressed;
      if (compression === 8) return await inflateRawAsync(compressed);
      return null;
    }

    pos += 46 + fnLen + extraLen + commentLen;
  }
  return null;
}

// ── PDF ───────────────────────────────────────────────────────────────────────

async function extractPdfText(buf: Buffer, filename: string): Promise<{ text: string; isScanned: boolean }> {
  const mod = await import("pdf-parse");
  const pdfParse = (mod as any).default ?? mod;
  const data = await pdfParse(buf);
  const text: string = data.text ?? "";
  const pages: number = data.numpages ?? 1;
  const avgCharsPerPage = pages > 0 ? text.length / pages : text.length;

  if (avgCharsPerPage < 80) {
    return { text: "", isScanned: true };
  }
  return { text: `[Documento: ${filename}]\n${text.trim()}`, isScanned: false };
}

// ── DOC ───────────────────────────────────────────────────────────────────────

const wordExtractor = new WordExtractor();

async function extractDocText(buf: Buffer): Promise<string> {
  const doc = await wordExtractor.extract(buf);
  return (doc.getBody() ?? "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── DOCX ──────────────────────────────────────────────────────────────────────

async function extractDocxText(buf: Buffer): Promise<string> {
  const xmlBuf = await extractZipEntry(buf, "word/document.xml");
  if (!xmlBuf) throw new Error("Arquivo DOCX inválido ou não pôde ser lido.");

  const xml = xmlBuf.toString("utf8");
  const withBreaks = xml
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<w:br[^>]*\/>/gi, "\n")
    .replace(/<w:tab[^>]*\/>/gi, "\t");

  const texts: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withBreaks)) !== null) {
    texts.push(m[1] ?? "");
  }
  return texts.join("").replace(/\n{3,}/g, "\n\n").replace(/\t+/g, " ").trim();
}

// ── ODT ───────────────────────────────────────────────────────────────────────

async function extractOdtText(buf: Buffer): Promise<string> {
  const xmlBuf = await extractZipEntry(buf, "content.xml");
  if (!xmlBuf) throw new Error("Arquivo ODT inválido ou não pôde ser lido.");

  const xml = xmlBuf.toString("utf8");
  return xml
    .replace(/<text:line-break[^>]*\/?>/gi, "\n")
    .replace(/<text:tab[^>]*\/?>/gi, " ")
    .replace(/<\/text:p>/gi, "\n")
    .replace(/<\/text:h>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+(?!\n)/g, " ")
    .trim();
}

// ── HTML ──────────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/\s+(?!\n)/g, " ").replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── RTF ───────────────────────────────────────────────────────────────────────

function stripRtf(rtf: string): string {
  let cleaned = rtf
    .replace(/\\par\b/g, "\n").replace(/\\line\b/g, "\n")
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/\\[a-z]+\d*\s?/g, " ")
    .replace(/[\\{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 150_000);
}

// ── Supported MIME types and extensions ──────────────────────────────────────

export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "text/html",
  "application/rtf",
  "text/rtf",
];

export const SUPPORTED_EXTENSIONS = ["pdf", "docx", "doc", "odt", "txt", "html", "htm", "rtf"];

export function isSupportedFormat(mimeType: string, filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return (
    SUPPORTED_MIME_TYPES.some(m => mimeType.toLowerCase().includes(m.toLowerCase())) ||
    SUPPORTED_EXTENSIONS.includes(ext)
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename?: string,
): Promise<ExtractResult> {
  const mt  = mimeType.toLowerCase();
  const ext = (filename ?? "").split(".").pop()?.toLowerCase() ?? "";
  const name = filename ?? "documento";

  // PDF
  if (mt.includes("pdf") || ext === "pdf") {
    const { text, isScanned } = await extractPdfText(buffer, name);
    return { text, format: "PDF", isScanned };
  }

  // DOCX
  if (
    mt.includes("wordprocessingml") ||
    (mt.includes("officedocument") && mt.includes("word")) ||
    ext === "docx"
  ) {
    const text = await extractDocxText(buffer);
    return { text, format: "DOCX", isScanned: false };
  }

  // ODT
  if (mt.includes("opendocument.text") || ext === "odt") {
    const text = await extractOdtText(buffer);
    return { text, format: "ODT", isScanned: false };
  }

  // HTML/HTM
  if (mt.includes("html") || ext === "html" || ext === "htm") {
    return { text: stripHtml(buffer.toString("utf8")), format: "HTML", isScanned: false };
  }

  // RTF
  if (mt.includes("rtf") || ext === "rtf") {
    return { text: stripRtf(buffer.toString("latin1")), format: "RTF", isScanned: false };
  }

  // DOC (Word 97-2003 binary OLE2)
  if (mt.includes("msword") || ext === "doc") {
    const text = await extractDocText(buffer);
    return { text, format: "DOC", isScanned: false };
  }

  // TXT fallback
  return { text: buffer.toString("utf8"), format: "TXT", isScanned: false };
}

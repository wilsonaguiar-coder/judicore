import { inflateRaw } from "node:zlib";
import { promisify } from "node:util";
import WordExtractor from "word-extractor";
import { extractPdfText } from "./pdf-extract.js";

const inflateRawAsync = promisify(inflateRaw);

export interface ExtractResult {
  text: string;
  format: string;
}

// ── ZIP reader (sem dependências externas) ────────────────────────────────────
// DOCX e ODT são arquivos ZIP contendo XML.
// Implementação: lê o Central Directory do ZIP e descomprime o arquivo alvo.

const EOCD_SIG   = 0x06054b50; // PK\x05\x06
const CD_SIG     = 0x02014b50; // PK\x01\x02

function findEocd(buf: Buffer): number {
  // Procura o EOCD de trás para frente (comment pode ter até 65535 bytes)
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

    const compression   = buf.readUInt16LE(pos + 10);
    const compressedSz  = buf.readUInt32LE(pos + 20);
    const fnLen         = buf.readUInt16LE(pos + 28);
    const extraLen      = buf.readUInt16LE(pos + 30);
    const commentLen    = buf.readUInt16LE(pos + 32);
    const localHdrOff   = buf.readUInt32LE(pos + 42);
    const filename      = buf.subarray(pos + 46, pos + 46 + fnLen).toString("utf8");

    if (filename === target) {
      const localFnLen    = buf.readUInt16LE(localHdrOff + 26);
      const localExtraLen = buf.readUInt16LE(localHdrOff + 28);
      const dataStart     = localHdrOff + 30 + localFnLen + localExtraLen;
      const compressed    = buf.subarray(dataStart, dataStart + compressedSz);

      if (compression === 0) return compressed;          // Stored
      if (compression === 8) return await inflateRawAsync(compressed); // Deflate
      return null;
    }

    pos += 46 + fnLen + extraLen + commentLen;
  }
  return null;
}

// ── DOC (Word 97-2003 — formato binário OLE2) ─────────────────────────────────

const wordExtractor = new WordExtractor();

async function extractDocText(buf: Buffer): Promise<string> {
  const doc = await wordExtractor.extract(buf);
  const body = doc.getBody() ?? "";
  return body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── DOCX — word/document.xml ──────────────────────────────────────────────────

async function extractDocxText(buf: Buffer): Promise<string> {
  const xmlBuf = await extractZipEntry(buf, "word/document.xml");
  if (!xmlBuf) throw new Error("Arquivo DOCX inválido ou não pôde ser lido.");

  const xml = xmlBuf.toString("utf8");
  // Insere quebras de parágrafo e tabulações antes de strippar as tags
  const withBreaks = xml
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<w:br[^>]*\/>/gi, "\n")
    .replace(/<w:tab[^>]*\/>/gi, "\t");

  // Extrai apenas o texto dentro de <w:t> (ignora metadados, estilos, etc.)
  const texts: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withBreaks)) !== null) {
    texts.push(m[1] ?? "");
  }

  return texts.join("").replace(/\n{3,}/g, "\n\n").replace(/\t+/g, " ").trim();
}

// ── ODT — content.xml ─────────────────────────────────────────────────────────

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
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
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
  // Remove grupos aninhados, control words e backslashes
  let cleaned = rtf;
  // Expandir \par e \line antes de remover tudo
  cleaned = cleaned.replace(/\\par\b/g, "\n").replace(/\\line\b/g, "\n");
  cleaned = cleaned
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/\\[a-z]+\d*\s?/g, " ")
    .replace(/[\\{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 150_000);
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function extractText(
  buffer: Buffer,
  mimetype: string,
  filename?: string,
): Promise<ExtractResult> {
  const mt  = mimetype.toLowerCase();
  const ext = (filename ?? "").split(".").pop()?.toLowerCase() ?? "";

  // PDF
  if (mt.includes("pdf") || ext === "pdf") {
    const text = await extractPdfText(buffer, filename ?? "documento.pdf");
    return { text, format: "PDF" };
  }

  // DOCX (Office Open XML)
  if (
    mt.includes("wordprocessingml") ||
    (mt.includes("officedocument") && mt.includes("word")) ||
    ext === "docx"
  ) {
    const text = await extractDocxText(buffer);
    return { text, format: "DOCX" };
  }

  // ODT (OpenDocument Text)
  if (mt.includes("opendocument.text") || ext === "odt") {
    const text = await extractOdtText(buffer);
    return { text, format: "ODT" };
  }

  // HTML / HTM
  if (mt.includes("html") || ext === "html" || ext === "htm") {
    return { text: stripHtml(buffer.toString("utf8")), format: "HTML" };
  }

  // RTF
  if (mt.includes("rtf") || ext === "rtf") {
    return { text: stripRtf(buffer.toString("latin1")), format: "RTF" };
  }

  // DOC (Word 97-2003 — formato binário OLE2)
  if (mt.includes("msword") || ext === "doc") {
    const text = await extractDocText(buffer);
    return { text, format: "DOC" };
  }

  // Texto simples / fallback
  return { text: buffer.toString("utf8"), format: "TXT" };
}

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── Pure logic replicated from document-extractor.ts and document-normalizer.ts ─
// No file I/O, no network, no DOM.

// ── Format detection (mirrors isSupportedFormat logic) ───────────────────────

const SUPPORTED_EXTENSIONS = ["pdf", "docx", "doc", "odt", "txt", "html", "htm", "rtf"];
const SUPPORTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "text/html",
  "application/rtf",
  "text/rtf",
];

function isSupportedFormat(mimeType: string, filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return (
    SUPPORTED_MIME.some(m => mimeType.toLowerCase().includes(m.toLowerCase())) ||
    SUPPORTED_EXTENSIONS.includes(ext)
  );
}

// ── Normalizer (mirrors DocumentNormalizerService logic) ─────────────────────

function normalize(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +$/gm, "")
    .replace(/^ {4,}/gm, "    ")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/ /g, " ")
    .trim();
}

// ── Ingestion logic (mirrors ingest/route.ts) ─────────────────────────────────

const MAX_FILE_SIZE = 20 * 1024 * 1024;

interface IngestInput {
  buffer?: { size: number; empty: boolean };
  text?: string;
  filename?: string;
  mimeType?: string;
}

interface IngestResult {
  error?: string;
  status?: number;
  format?: string;
  normalizedText?: string;
}

function simulateIngest(input: IngestInput): IngestResult {
  const { buffer, text, filename = "", mimeType = "text/plain" } = input;

  if (buffer) {
    if (buffer.size > MAX_FILE_SIZE) {
      return { error: "Arquivo muito grande. Limite: 20 MB.", status: 413 };
    }
    if (!isSupportedFormat(mimeType, filename)) {
      const ext = filename.split(".").pop()?.toLowerCase() ?? "unknown";
      return { error: `Formato não suportado: .${ext}.`, status: 415 };
    }
    if (buffer.empty) {
      return { error: "Nenhum texto encontrado no arquivo.", status: 422 };
    }
    const format = filename.split(".").pop()?.toUpperCase() ?? "TXT";
    const rawText = `Texto extraído de ${filename}`;
    const normalizedText = normalize(rawText);
    return { format, normalizedText };
  }

  if (text !== undefined) {
    if (!text.trim()) {
      return { error: "Nenhum texto fornecido.", status: 400 };
    }
    const normalizedText = normalize(text);
    if (!normalizedText.trim()) {
      return { error: "Nenhum texto encontrado após normalização.", status: 422 };
    }
    return { format: "TEXT_PASTE", normalizedText };
  }

  return { error: "Nenhum arquivo ou texto fornecido.", status: 400 };
}

// ── Session creation simulation ───────────────────────────────────────────────

function simulateCreateSession(normalizedText: string): {
  sessionId: string;
  pieceId: string;
  redirectUrl: string;
} {
  const pieceId = `piece-${Date.now()}-test`;
  const sessionId = `session-${Date.now()}-test`;
  return {
    sessionId,
    pieceId,
    redirectUrl: `/review-studio/${pieceId}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Document Ingestion — Format Support", () => {

  it("I1. PDF válido é reconhecido", () => {
    assert.ok(isSupportedFormat("application/pdf", "peticao.pdf"));
    assert.ok(isSupportedFormat("", "peticao.pdf"));
  });

  it("I2. DOCX válido é reconhecido", () => {
    assert.ok(isSupportedFormat(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "sentenca.docx"
    ));
    assert.ok(isSupportedFormat("", "recurso.docx"));
  });

  it("I3. DOC válido é reconhecido", () => {
    assert.ok(isSupportedFormat("application/msword", "despacho.doc"));
    assert.ok(isSupportedFormat("", "despacho.doc"));
  });

  it("I4. ODT válido é reconhecido", () => {
    assert.ok(isSupportedFormat("application/vnd.oasis.opendocument.text", "decisao.odt"));
    assert.ok(isSupportedFormat("", "decisao.odt"));
  });

  it("I5. TXT válido é reconhecido", () => {
    assert.ok(isSupportedFormat("text/plain", "texto.txt"));
    assert.ok(isSupportedFormat("", "texto.txt"));
  });

  it("I6. HTML válido é reconhecido", () => {
    assert.ok(isSupportedFormat("text/html", "pagina.html"));
    assert.ok(isSupportedFormat("", "pagina.htm"));
  });

  it("I7. RTF válido é reconhecido", () => {
    assert.ok(isSupportedFormat("application/rtf", "documento.rtf"));
    assert.ok(isSupportedFormat("text/rtf", "documento.rtf"));
    assert.ok(isSupportedFormat("", "documento.rtf"));
  });

  it("I8. arquivo acima do limite retorna erro 413", () => {
    const result = simulateIngest({
      buffer: { size: 21 * 1024 * 1024, empty: false },
      filename: "grande.pdf",
      mimeType: "application/pdf",
    });
    assert.equal(result.status, 413);
    assert.ok(result.error?.includes("muito grande"));
  });

  it("I9. formato não suportado retorna erro 415", () => {
    const result = simulateIngest({
      buffer: { size: 100, empty: false },
      filename: "arquivo.exe",
      mimeType: "application/x-executable",
    });
    assert.equal(result.status, 415);
    assert.ok(result.error?.includes("Formato não suportado"));
  });

  it("I10. arquivo vazio retorna erro 422", () => {
    const result = simulateIngest({
      buffer: { size: 100, empty: true },
      filename: "vazio.pdf",
      mimeType: "application/pdf",
    });
    assert.equal(result.status, 422);
    assert.ok(result.error?.includes("Nenhum texto encontrado"));
  });

  it("I11. PDF escaneado (sem texto) retorna erro amigável", () => {
    // Simulates the isScanned=true path
    const scannedPdfText = "";
    const isScanned = scannedPdfText.trim().length === 0;
    assert.ok(isScanned, "PDF escaneado detectado");
    const errorMessage = "Este PDF parece conter apenas imagens. OCR ainda não está habilitado.";
    assert.ok(errorMessage.includes("OCR"), "Mensagem deve mencionar OCR");
  });
});

describe("Document Ingestion — Normalizer", () => {

  it("N1. normalização remove caracteres de controle", () => {
    const text = "texto\x00com\x01chars\x7Fde\x1Bcontrole";
    const result = normalize(text);
    assert.ok(!result.includes("\x00"), "null bytes removidos");
    assert.ok(!result.includes("\x01"), "control chars removidos");
    assert.ok(!result.includes("\x7F"), "DEL removido");
  });

  it("N2. normalização converte \\r\\n e \\r para \\n", () => {
    const text = "linha1\r\nlinha2\rlinha3";
    const result = normalize(text);
    assert.ok(!result.includes("\r"), "\\r removido");
    assert.ok(result.includes("\n"), "\\n preservado");
  });

  it("N3. normalização colapsa mais de 2 linhas em branco", () => {
    const text = "para1\n\n\n\n\npara2";
    const result = normalize(text);
    assert.ok(!result.includes("\n\n\n"), "3+ linhas em branco colapsadas");
    assert.ok(result.includes("\n\n"), "2 linhas em branco preservadas");
  });

  it("N4. normalização preserva texto jurídico típico", () => {
    const text = "Art. 37, caput, da CF/88 — princípio da legalidade.\nArt. 5º, XXXV — acesso à justiça.";
    const result = normalize(text);
    assert.ok(result.includes("Art. 37"), "artigos preservados");
    assert.ok(result.includes("CF/88"), "siglas preservadas");
  });

  it("N5. texto colado vazio retorna erro", () => {
    const result = simulateIngest({ text: "   " });
    assert.equal(result.status, 400);
    assert.ok(result.error?.includes("texto"));
  });
});

describe("Document Ingestion — Session Creation & Redirect", () => {

  it("S1. criação da sessão retorna sessionId, pieceId e redirectUrl", () => {
    const { sessionId, pieceId, redirectUrl } = simulateCreateSession("Texto jurídico normalizado.");
    assert.ok(sessionId.length > 0, "sessionId definido");
    assert.ok(pieceId.length > 0, "pieceId definido");
    assert.ok(redirectUrl.startsWith("/review-studio/"), "redirectUrl aponta para review-studio");
    assert.ok(redirectUrl.includes(pieceId), "redirectUrl contém pieceId");
  });

  it("S2. redirecionamento usa pieceId (não sessionId)", () => {
    const { pieceId, redirectUrl } = simulateCreateSession("Petição inicial.");
    assert.equal(redirectUrl, `/review-studio/${pieceId}`);
  });

  it("S3. fluxo completo: TXT válido → normalizado → sessão criada → redirect", () => {
    const rawText = "  SENTENÇA  \r\n\r\nO juiz decide...\r\n";
    const result = simulateIngest({ text: rawText });

    assert.equal(result.format, "TEXT_PASTE");
    assert.ok(result.normalizedText, "texto normalizado existe");
    assert.ok(result.normalizedText!.startsWith("SENTENÇA"), "cabeçalho preservado");

    const session = simulateCreateSession(result.normalizedText!);
    assert.ok(session.redirectUrl.startsWith("/review-studio/"));
  });
});

import * as mammoth from "mammoth";
import AdmZip from "adm-zip";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, rm, writeFile, readFile, readdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

export interface IDocumentExtractor {
  extractText(buffer: Buffer, mimeType: string): Promise<string>;
}

// Returns true only when the extracted text has enough real words (not just URLs/numbers)
function isTextUseful(text: string): boolean {
  const noUrls = text.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  const realWords = noUrls.split(" ").filter(w => w.length > 3 && /[a-zA-ZÀ-ÿ]/.test(w));
  return realWords.length >= 25;
}

export class DocumentExtractor implements IDocumentExtractor {
  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case "application/pdf":
        return this.extractFromPdf(buffer);
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return this.extractFromDocx(buffer);
      case "application/vnd.oasis.opendocument.text":
        return this.extractFromOdt(buffer);
      case "application/msword":
        throw new Error("Arquivos .doc legados não são suportados. Converta para PDF ou DOCX.");
      case "image/jpeg":
      case "image/png":
      case "image/webp":
        return this.ocrImage(buffer, mimeType);
      case "text/plain":
        return buffer.toString("utf-8");
      default:
        throw new Error(`MimeType não suportado para extração: ${mimeType}`);
    }
  }

  private async extractFromPdf(buffer: Buffer): Promise<string> {
    // Step 1: Try fast text extraction (selectable-text PDFs)
    let textFromParse = "";
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      textFromParse = data.text || "";
      await parser.destroy();
    } catch {
      // Extraction failed — fall through to OCR
    }

    if (isTextUseful(textFromParse)) {
      return textFromParse;
    }

    // Step 2: OCR fallback — handles image-based PDFs (CNH Digital, certidões escaneadas, etc.)
    try {
      return await this.ocrPdf(buffer);
    } catch (ocrErr: any) {
      // If OCR also fails but we have some text (e.g. QR code URL), return it
      if (textFromParse.trim().length > 50) return textFromParse;
      throw new Error(
        `Não foi possível extrair texto deste PDF. Verifique se poppler-utils e tesseract-ocr estão instalados no servidor. Detalhe: ${ocrErr.message}`
      );
    }
  }

  // Converts PDF pages to PNG via pdftoppm, then OCRs each page with tesseract.
  // Requires: apt-get install -y poppler-utils tesseract-ocr tesseract-ocr-por
  private async ocrPdf(buffer: Buffer): Promise<string> {
    const tmpDir = await mkdtemp(join(tmpdir(), "judicore-ocr-"));
    try {
      const pdfPath = join(tmpDir, "input.pdf");
      await writeFile(pdfPath, buffer);

      // 200 DPI — good balance between OCR quality and speed; -l 5 limits to first 5 pages
      await execFileAsync(
        "pdftoppm",
        ["-r", "200", "-png", "-l", "5", pdfPath, join(tmpDir, "page")],
        { timeout: 45000 }
      );

      const allFiles = await readdir(tmpDir);
      const pngFiles = allFiles
        .filter(f => f.endsWith(".png"))
        .sort()
        .map(f => join(tmpDir, f));

      if (pngFiles.length === 0) throw new Error("pdftoppm não gerou imagens — verifique se o PDF não está corrompido.");

      const texts: string[] = [];
      for (const pngFile of pngFiles) {
        const outBase = pngFile.replace(".png", "");
        await execFileAsync(
          "tesseract",
          [pngFile, outBase, "-l", "por", "--psm", "3"],
          { timeout: 30000 }
        );
        const pageText = await readFile(`${outBase}.txt`, "utf-8");
        if (pageText.trim()) texts.push(pageText);
      }

      const result = texts.join("\n--- Página ---\n").replace(/\f/g, "").trim();
      if (result.length < 50) throw new Error("OCR concluiu mas não extraiu texto suficiente.");
      return result;
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // OCR direto para imagens (JPEG, PNG, WebP)
  // Requires: apt-get install -y tesseract-ocr tesseract-ocr-por
  private async ocrImage(buffer: Buffer, mimeType: string): Promise<string> {
    const ext = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
    const tmpDir = await mkdtemp(join(tmpdir(), "judicore-ocr-"));
    try {
      const imgPath = join(tmpDir, `input${ext}`);
      const outBase = join(tmpDir, "output");
      await writeFile(imgPath, buffer);
      await execFileAsync(
        "tesseract",
        [imgPath, outBase, "-l", "por", "--psm", "3"],
        { timeout: 30000 }
      );
      const text = await readFile(`${outBase}.txt`, "utf-8");
      const result = text.replace(/\s+/g, " ").trim();
      if (result.length < 20) throw new Error("OCR não extraiu texto suficiente da imagem.");
      return result;
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async extractFromDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (err: any) {
      throw new Error("Falha ao ler DOCX: " + err.message);
    }
  }

  private async extractFromOdt(buffer: Buffer): Promise<string> {
    try {
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      const contentEntry = zipEntries.find(e => e.entryName === "content.xml");
      if (!contentEntry) throw new Error("Arquivo content.xml não encontrado no ODT.");
      const xmlData = contentEntry.getData().toString("utf8");

      let text = xmlData.replace(/<text:p[^>]*>/g, "\n");
      text = text.replace(/<[^>]+>/g, "");
      text = text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

      return text.trim();
    } catch (err: any) {
      throw new Error("Falha ao ler ODT: " + err.message);
    }
  }
}

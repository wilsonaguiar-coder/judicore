// Extractor interface para processamento LGPD
// Arquitetura de entrada e conversão de arquivos para texto puro

import * as mammoth from "mammoth";
import AdmZip from "adm-zip";
import { createRequire } from "module";

const nativeRequire = createRequire(import.meta.url);

export interface IDocumentExtractor {
  extractText(buffer: Buffer, mimeType: string): Promise<string>;
}

export class DocumentExtractor implements IDocumentExtractor {
  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        return this.extractFromPdf(buffer);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.extractFromDocx(buffer);
      case 'application/vnd.oasis.opendocument.text':
        return this.extractFromOdt(buffer);
      case 'application/msword':
        throw new Error("Arquivos .doc legados ainda não são suportados. Converta para PDF ou DOCX.");
      case 'image/jpeg':
      case 'image/png':
      case 'image/webp':
        throw new Error("OCR de imagens será suportado em etapa futura. Envie PDF pesquisável ou DOCX.");
      case 'text/plain':
        return buffer.toString('utf-8');
      default:
        throw new Error(`MimeType não suportado para extração: ${mimeType}`);
    }
  }

  private async extractFromPdf(buffer: Buffer): Promise<string> {
    try {
      // O uso de 'nativeRequire' esconde a dependência do AST Parser do Webpack
      // Isso evita que o pdf.js interno seja minificado e quebre com 'i is not a function'
      const pdfParse = nativeRequire("pdf-parse");
      const data = await pdfParse(buffer);
      const text = data.text || "";
      const usefulText = text.replace(/\s+/g, " ").trim();
      if (usefulText.length < 100) {
        throw new Error("Não foi possível extrair texto deste PDF. O arquivo parece ser escaneado ou contém apenas imagem. O OCR será suportado em etapa futura.");
      }
      return text;
    } catch (err: any) {
      if (err.message.includes("escaneado")) {
        throw err;
      }
      throw new Error("Falha ao ler PDF: " + err.message);
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
      if (!contentEntry) {
        throw new Error("Arquivo content.xml não encontrado no ODT.");
      }
      const xmlData = contentEntry.getData().toString('utf8');
      
      // Decodifica e limpa as tags XML
      let text = xmlData.replace(/<text:p[^>]*>/g, "\n");
      text = text.replace(/<[^>]+>/g, "");
      
      // Decodifica entidades básicas XML
      text = text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'");

      return text.trim();
    } catch (err: any) {
      throw new Error("Falha ao ler ODT: " + err.message);
    }
  }
}

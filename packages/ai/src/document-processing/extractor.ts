// Extractor interface para processamento LGPD
// Arquitetura de entrada e conversão de arquivos para texto puro

import * as mammoth from "mammoth";
import AdmZip from "adm-zip";

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
      // O módulo pdf-parse v2.4.5 expõe a classe PDFParse, diferente da v1.1.1.
      // O Next.js agrupa perfeitamente módulos modernos, então um import comum funciona.
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      const text = data.text || "";
      await parser.destroy();
      
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

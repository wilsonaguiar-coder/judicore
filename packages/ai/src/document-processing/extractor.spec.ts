import { DocumentExtractor } from "./extractor.js";
import pdfParse from "pdf-parse";
import AdmZip from "adm-zip";
import * as mammoth from "mammoth";

// Mocks
jest.mock("pdf-parse");
jest.mock("adm-zip");
jest.mock("mammoth", () => ({
  extractRawText: jest.fn()
}));

describe("DocumentExtractor", () => {
  let extractor: DocumentExtractor;

  beforeEach(() => {
    extractor = new DocumentExtractor();
    jest.clearAllMocks();
  });

  it("deve extrair texto de PDF pesquisável", async () => {
    (pdfParse as jest.Mock).mockResolvedValue({ text: "Texto longo o suficiente para passar do limite de cem caracteres que é exigido pelo fallback do sistema para pdf não escaneado." });
    
    const text = await extractor.extractText(Buffer.from("fake-pdf"), "application/pdf");
    expect(text).toContain("Texto longo");
  });

  it("deve lançar erro amigável para PDF escaneado (pouco texto)", async () => {
    (pdfParse as jest.Mock).mockResolvedValue({ text: "Pouco texto" });
    
    await expect(extractor.extractText(Buffer.from("fake-pdf"), "application/pdf"))
      .rejects.toThrow("O arquivo parece ser escaneado ou contém apenas imagem");
  });

  it("deve lançar erro claro para imagens (OCR futuro)", async () => {
    await expect(extractor.extractText(Buffer.from("img"), "image/png"))
      .rejects.toThrow("OCR de imagens será suportado em etapa futura");
  });

  it("deve lançar erro claro para DOC legado", async () => {
    await expect(extractor.extractText(Buffer.from("doc"), "application/msword"))
      .rejects.toThrow("Arquivos .doc legados ainda não são suportados");
  });

  it("deve extrair texto de DOCX usando mammoth", async () => {
    (mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: "Texto do DOCX" });
    
    const text = await extractor.extractText(Buffer.from("fake-docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(text).toBe("Texto do DOCX");
  });

  it("deve extrair texto de ODT validando XML e decodificando entidades", async () => {
    const mockZip = {
      getEntries: jest.fn().mockReturnValue([{
        entryName: "content.xml",
        getData: jest.fn().mockReturnValue(Buffer.from("<text:p>Olá, &quot;Mundo&quot; &amp; cia</text:p>"))
      }])
    };
    (AdmZip as unknown as jest.Mock).mockImplementation(() => mockZip);

    const text = await extractor.extractText(Buffer.from("fake-odt"), "application/vnd.oasis.opendocument.text");
    expect(text).toBe("Olá, \"Mundo\" & cia");
  });
});

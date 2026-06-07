// Contratos para o Pipeline de Geração (Writer) da Fase 12.3.0
// Define a arquitetura do processo de elaboração de peças

export interface IWriterContext {
  userId: string;
  generationId: string;
  docType: string;
  userOrientation: string;
  processedText: string; // Texto reduzido originado dos documentos base
}

export interface IPieceDraft {
  content: string;
  tokensUsed: number;
  provider: string; // ex: 'gpt-5.5-turbo'
}

export interface IWriterService {
  generateDraft(context: IWriterContext): Promise<IPieceDraft>;
}

export interface IDocumentGenerationPipeline {
  execute(
    userId: string, 
    generationId: string, 
    docType: string, 
    rawFiles: { buffer: Buffer; mimeType: string; category: string }[],
    userOrientation: string
  ): Promise<IPieceDraft>;
}

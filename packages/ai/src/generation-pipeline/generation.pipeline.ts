import { prisma, QuotaService } from "@judicore/db";
import { PieceBriefService } from "./piece-brief.service.js";
import { LegalResearchService } from "../legal-research/legal-research.service.js";
import { WriterService } from "./writer.service.js";
import { DocumentExtractor } from "../document-processing/extractor.js";
import { ContextReducer } from "../document-processing/reducer.js";

export interface GenerationInput {
  userId: string;
  pieceType: string;
  userOrientation: string;
  files: { buffer: Buffer; mimeType: string; category: string }[];
}

export class GenerationPipeline {
  static async execute(input: GenerationInput): Promise<{ draft: string, generationId: string }> {
    const { userId, pieceType, userOrientation, files } = input;
    const startMs = Date.now();

    // 1. Inicia o registro no banco
    const generation = await prisma.pieceGeneration.create({
      data: {
        userId,
        pieceType,
        userOrientation,
        status: "PROCESSING"
      }
    });

    try {
      // 2. Extração e Redução LGPD
      const extractor = new DocumentExtractor();
      const reducer = new ContextReducer();
      let combinedText = "";

      for (const file of files) {
        const rawText = await extractor.extractText(file.buffer, file.mimeType);
        const reducedText = reducer.process(rawText, file.category);
        combinedText += `\n[Documento: ${file.category}]\n${reducedText}\n`;
      }

      // Os arquivos originais (buffers) saem de escopo após este bloco (garantia LGPD).

      // 3. PieceBrief (Gemini)
      const t0 = Date.now();
      const brief = await PieceBriefService.generateBrief(combinedText, pieceType, userOrientation);
      const timeGeminiMs = Date.now() - t0;

      // 4. Pesquisa Jurídica (ES/LanceDB + LexML)
      const isTrabalhista = userOrientation.toLowerCase().includes("trabalho") || pieceType.toLowerCase().includes("trabalho");
      const research = await LegalResearchService.executeResearch(brief.palavrasChave, userOrientation, isTrabalhista);
      const researchResultsCount = research.jurisprudenciaLocal.length + research.jurisprudenciaLexML.length + research.legislacaoLexML.length;

      // 5. Redação Final (Writer GPT-5.5)
      const t1 = Date.now();
      const writerRes = await WriterService.generatePiece(pieceType, userOrientation, brief, research);
      const timeGptMs = Date.now() - t1;

      // 6. Atualizar BD com Sucesso
      await prisma.pieceGeneration.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          generatedText: writerRes.draft,
          inputTokensGemini: brief._metadata.inputTokens,
          outputTokensGemini: brief._metadata.outputTokens,
          inputTokensGpt: writerRes.inputTokens,
          outputTokensGpt: writerRes.outputTokens,
          processingTimeMs: Date.now() - startMs,
          timeGeminiMs,
          timeLanceDbMs: research.timeLanceDbMs,
          timeLexMlMs: research.timeLexMlMs,
          timeGptMs,
          researchResultsCount,
          completedAt: new Date()
        }
      });

      // 7. Consumir Cota
      await QuotaService.consumePieceQuota(userId, generation.id);

      return { draft: writerRes.draft, generationId: generation.id };
    } catch (error: any) {
      // Falha ou Timeout
      await prisma.pieceGeneration.update({
        where: { id: generation.id },
        data: {
          status: "FAILED",
          errorMessage: error.message || "Erro desconhecido",
          processingTimeMs: Date.now() - startMs,
          completedAt: new Date()
        }
      });
      throw error;
    }
  }
}

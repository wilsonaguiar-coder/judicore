import { execSync } from "child_process";
import { prisma, QuotaService } from "@judicore/db";
import { PieceBriefService } from "./piece-brief.service.js";
import { LegalResearchService } from "../legal-research/legal-research.service.js";
import { WriterService } from "./writer.service.js";
import { DocumentExtractor } from "../document-processing/extractor.js";
import { ContextReducer } from "../document-processing/reducer.js";
import { QualificationExtractor } from "../document-processing/qualification-extractor.js";
import { LegalMatrixBuilderService } from "./legal-matrix-builder.service.js";
import { buildPremiumDocumentPrompt } from "../prompts.js";

function getCommitHash(): string {
  try { return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(); } catch { return "unknown"; }
}

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

    if (files.length > 5) {
      throw new Error("Limite excedido: máximo de 5 arquivos por requisição.");
    }
    const totalSize = files.reduce((acc, f) => acc + f.buffer.length, 0);
    if (totalSize > 15 * 1024 * 1024) {
      throw new Error("Limite excedido: tamanho máximo total de arquivos é 15MB.");
    }

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
        const reducedText = reducer.process(rawText, file.category, 80000); // 80k max por arquivo
        combinedText += `\n[Documento: ${file.category}]\n${reducedText}\n`;
      }

      if (combinedText.length > 150000) {
        combinedText = combinedText.substring(0, 150000) + "\n...[TRUNCADO PELO SISTEMA]";
      }

      // Extração de Qualificação
      const qualData = QualificationExtractor.extract(combinedText);
      const qualBlock = QualificationExtractor.formatToPrompt(qualData);
      
      combinedText = qualBlock + "\n\n" + combinedText;

      // Os arquivos originais (buffers) saem de escopo após este bloco (garantia LGPD).

      // 3. PieceBrief (Gemini)
      const t0 = Date.now();
      const brief = await PieceBriefService.generateBrief(combinedText, pieceType, userOrientation);
      const timeGeminiMs = Date.now() - t0;

      // 4. Pesquisa Jurídica (ES/LanceDB + LexML)
      const isTrabalhista = userOrientation.toLowerCase().includes("trabalho") || pieceType.toLowerCase().includes("trabalho");
      const research = await LegalResearchService.executeResearch(brief, userOrientation, isTrabalhista, "CIVIL");
      const researchResultsCount = research.teses.reduce((acc, t) => acc + t.jurisprudencia.length + t.legislacao.length, 0);

      // 4.5. Legal Matrix Builder (Determinístico - Fase 12.5.2)
      const legalMatrix = await LegalMatrixBuilderService.buildMatrix(brief, research);

      // 5. Redação Final (Writer GPT-5.5)
      const t1 = Date.now();
      const writerRes = await WriterService.generatePiece(pieceType, userOrientation, brief, research, qualData, legalMatrix);
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

      // 6.5. Salvar Snapshot de Observabilidade
      const legalMatrixFormattedForSnap = LegalMatrixBuilderService.formatToMarkdown(legalMatrix);
      const systemPromptFull = buildPremiumDocumentPrompt(
        pieceType as any,
        [],
        legalMatrixFormattedForSnap,
        JSON.stringify(brief),
        userOrientation,
        qualData
      );
      const userPromptFull = "Redija a peça final completa agora. ATENÇÃO MÁXIMA: É ESTRITAMENTE PROIBIDO escrever 'vem à presença', 'vem perante', 'Diante do exposto, requer', 'Ante o exposto, requer' ou 'Termos em que, Pede deferimento'. Vá direto ao ponto, use redação institucional e direta.";
      const gptPayloadFull = {
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPromptFull },
          { role: "user", content: userPromptFull }
        ],
        temperature: 0.2,
        max_tokens: 4096
      };

      await prisma.pieceGenerationSnapshot.create({
        data: {
          generationId: generation.id,
          pieceBriefJson: brief as any,
          qualificationJson: qualData as any,
          researchSummaryJson: {
            stfStjTotal: research.teses.reduce((acc, t) => acc + t.jurisprudencia.filter(j => j.fonte.includes("LanceDB")).length, 0),
            lexmlJuriTotal: research.teses.reduce((acc, t) => acc + t.jurisprudencia.filter(j => j.fonte.includes("LexML")).length, 0),
            lexmlLegisTotal: research.teses.reduce((acc, t) => acc + t.legislacao.length, 0),
            fontesSelecionadas: [
              ...legalMatrix.teses.flatMap(t => t.jurisprudenciaAplicavel),
              ...legalMatrix.teses.flatMap(t => t.fundamentosLegais)
            ]
          },
          legalMatrixJson: legalMatrix as any,
          promptSnapshotJson: {
            hash: "v13.13.1-gemini25flash",
            versao: "1.0",
            tamanho: writerRes.inputTokens,
            resumoInicial: writerRes.promptSnapshot,
            systemPromptFull,
            userPromptFull,
            gptPayloadFull,
            commitHash: getCommitHash()
          }
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


import { getOpenAIClient } from "../client.js";
import type { PieceBrief } from "./piece-brief.service.js";
import type { LegalResearchPack } from "../legal-research/legal-research.service.js";
import { LegalMatrixBuilderService, LegalMatrix } from "./legal-matrix-builder.service.js";
import { buildPremiumDocumentPrompt } from "../prompts.js";

export interface WriterResponse {
  draft: string;
  inputTokens: number;
  outputTokens: number;
  promptSnapshot: string;
}

export class WriterService {
  static async generatePiece(
    pieceType: string,
    userOrientation: string,
    brief: PieceBrief,
    research: LegalResearchPack,
    qualificationData: any,
    legalMatrix: LegalMatrix
  ): Promise<WriterResponse> {
    const client = getOpenAIClient();

    // LegalMatrix já contém a legislação do LegisDB e a Jurisprudência com Ementas (após Fase 13)
    const systemPrompt = buildPremiumDocumentPrompt(
      pieceType as any,
      [], // Documentos reais em texto (não usados no MVP atual diretamente aqui)
      legalMatrix.jurisprudenciaSelecionada,
      legalMatrix.legislacaoSelecionada.reduce((acc, curr) => ({ ...acc, [curr.titulo]: curr.textoLiteral || curr.conteudo }), {}),
      JSON.stringify(brief),
      userOrientation
    );

    const response = await client.chat.completions.create({
      model: "gpt-4-turbo", // Simulação do GPT-5.5 no MVP
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Redija a peça final completa agora, seguindo estritamente a Legal Matrix e a Estrutura Argumentativa Obrigatória." }
      ],
      temperature: 0.2,
      max_tokens: 4096,
    });

    const draft = response.choices[0]?.message.content ?? "";
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    if (!draft) {
      throw new Error("GPT não retornou nenhum rascunho de peça.");
    }

    // Criar um snapshot resumo do prompt (evita salvar +50k tokens se houver)
    const promptSnapshot = systemPrompt.substring(0, 1500) + "\\n...[TRUNCADO PARA SNAPSHOT]";

    return { draft, inputTokens, outputTokens, promptSnapshot };
  }
}

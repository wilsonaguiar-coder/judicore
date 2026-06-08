import { getOpenAIClient } from "../client.js";
import type { PieceBrief } from "./piece-brief.service.js";
import type { LegalResearchPack } from "../legal-research/legal-research.service.js";
import { LegalMatrixBuilderService, LegalMatrix } from "./legal-matrix-builder.service.js";
import { buildPremiumDocumentPrompt } from "../prompts.js";
import { StyleLinter, StyleValidationResult } from "./style-linter.js";

export interface WriterResponse {
  draft: string;
  inputTokens: number;
  outputTokens: number;
  promptSnapshot: string;
  styleValidation?: StyleValidationResult;
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
    const legalMatrixFormatted = LegalMatrixBuilderService.formatToMarkdown(legalMatrix);
    const systemPrompt = buildPremiumDocumentPrompt(
      pieceType as any,
      [], // Documentos reais em texto (não usados no MVP atual diretamente aqui)
      legalMatrixFormatted,
      JSON.stringify(brief),
      userOrientation,
      qualificationData
    );

    let messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Redija a peça final completa agora. Inclua TODAS as seções obrigatórias listadas na tarefa, na ordem indicada. Para petição inicial, recurso e sentença: mínimo de 2.000 palavras — desenvolva cada seção com profundidade, não escreva resumos. ATENÇÃO MÁXIMA: É ESTRITAMENTE PROIBIDO escrever 'vem à presença', 'vem perante', 'Diante do exposto, requer', 'Ante o exposto, requer', 'Termos em que', 'Pede deferimento', '[JUR-1]', '[JUR-2]' ou qualquer '[JUR-N]' literalmente. Vá direto ao ponto, redação institucional e direta." }
    ];

    let draft = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let styleValidation: StyleValidationResult | undefined;
    
    // Loop de auto-correção (Self-Reflection) com máximo de 2 tentativas
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        temperature: 0.2,
        max_tokens: 4096,
      });

      draft = response.choices[0]?.message.content ?? "";
      inputTokens += response.usage?.prompt_tokens ?? 0;
      outputTokens += response.usage?.completion_tokens ?? 0;

      if (!draft) throw new Error("GPT não retornou nenhum rascunho de peça.");

      styleValidation = StyleLinter.validateStyle(draft);

      // Se a nota for 100, ou se for a última tentativa, aceita a peça
      if (styleValidation.score === 100 || attempt === 2) {
        break;
      }

      // Se reprovou no estilo, adiciona a falha e manda consertar
      messages.push({ role: "assistant", content: draft });
      messages.push({ 
        role: "user", 
        content: `[REVISÃO INSTITUCIONAL] Sua peça reprovou no teste de estilo com nota ${styleValidation.score}/100.\nErros detectados:\n- ${styleValidation.warnings.join("\n- ")}\n\nREESCREVA a peça completa, corrigindo OBRIGATORIAMENTE esses erros. Não utilize NENHUMA das palavras proibidas listadas.`
      });
    }

    // Criar um snapshot resumo do prompt (evita salvar +50k tokens se houver)
    const promptSnapshot = systemPrompt.substring(0, 1500) + "\\n...[TRUNCADO PARA SNAPSHOT]";

    return { draft, inputTokens, outputTokens, promptSnapshot, styleValidation };
  }
}

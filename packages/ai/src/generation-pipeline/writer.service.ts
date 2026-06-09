import type { PieceBrief } from "./piece-brief.service.js";
import type { LegalResearchPack } from "../legal-research/legal-research.service.js";
import { LegalMatrixBuilderService, LegalMatrix } from "./legal-matrix-builder.service.js";
import { buildPremiumDocumentPrompt } from "../prompts.js";
import { StyleLinter, StyleValidationResult } from "./style-linter.js";

const WRITER_MODEL = "gemini-3.5-flash";

interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

async function callGemini(
  systemInstruction: string,
  contents: GeminiContent[],
  maxOutputTokens = 8192
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY não definida");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${WRITER_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: { text: systemInstruction } },
      contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini Writer Error: ${response.status} — ${err}`);
  }

  const data = await response.json() as any;
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const inputTokens: number = data.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens: number = data.usageMetadata?.candidatesTokenCount ?? 0;

  if (!text) throw new Error("Gemini não retornou rascunho de peça.");
  return { text, inputTokens, outputTokens };
}

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
    const legalMatrixFormatted = LegalMatrixBuilderService.formatToMarkdown(legalMatrix);
    const systemPrompt = buildPremiumDocumentPrompt(
      pieceType as any,
      [],
      legalMatrixFormatted,
      JSON.stringify(brief),
      userOrientation,
      qualificationData
    );

    const userMessage =
      "Redija a peça final completa agora seguindo RIGOROSAMENTE a estrutura da tarefa.\n\n" +
      "PARA PETIÇÃO INICIAL — REQUISITOS INVIOLÁVEIS:\n" +
      "• A seção III — DO DIREITO deve ter no mínimo 1.200 palavras. Cada ► TESE deve ter mínimo 4 parágrafos densos (§1 contexto normativo, §2 análise do dispositivo, §3 subsunção ao caso, §4 consequência jurídica). Se uma tese ficou com menos de 4 parágrafos, está incompleta.\n" +
      "• Peça completa: mínimo 2.500 palavras.\n" +
      "• Mínimo 4 teses com fundamentos legais distintos.\n\n" +
      "PARA RECURSO E SENTENÇA: mínimo 2.000 palavras.\n\n" +
      "ATENÇÃO MÁXIMA: É ESTRITAMENTE PROIBIDO escrever 'vem à presença', 'vem perante', " +
      "'Diante do exposto, requer', 'Ante o exposto, requer', 'Termos em que', 'Pede deferimento', " +
      "'[JUR-1]', '[JUR-2]' ou qualquer '[JUR-N]' literalmente. Redação técnica, direta e densa.";

    let contents: GeminiContent[] = [
      { role: "user", parts: [{ text: userMessage }] },
    ];

    let draft = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let styleValidation: StyleValidationResult | undefined;

    // Loop de auto-correção (Self-Reflection) — máximo 2 tentativas
    for (let attempt = 1; attempt <= 2; attempt++) {
      const result = await callGemini(systemPrompt, contents, 8192);
      draft = result.text;
      inputTokens += result.inputTokens;
      outputTokens += result.outputTokens;

      styleValidation = StyleLinter.validateStyle(draft);

      if (styleValidation.score === 100 || attempt === 2) break;

      contents.push({ role: "model", parts: [{ text: draft }] });
      contents.push({
        role: "user",
        parts: [{
          text:
            `[REVISÃO INSTITUCIONAL] Sua peça reprovou no teste de estilo com nota ${styleValidation.score}/100.\n` +
            `Erros detectados:\n- ${styleValidation.warnings.join("\n- ")}\n\n` +
            "REESCREVA a peça completa, corrigindo OBRIGATORIAMENTE esses erros. Não utilize NENHUMA das expressões proibidas listadas.",
        }],
      });
    }

    const promptSnapshot = systemPrompt.substring(0, 1500) + "\\n...[TRUNCADO PARA SNAPSHOT]";
    return { draft, inputTokens, outputTokens, promptSnapshot, styleValidation };
  }
}

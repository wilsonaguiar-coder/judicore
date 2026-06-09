import type { PieceBrief } from "./piece-brief.service.js";
import type { LegalResearchPack } from "../legal-research/legal-research.service.js";
import { LegalMatrixBuilderService, LegalMatrix } from "./legal-matrix-builder.service.js";
import { buildPremiumDocumentPrompt } from "../prompts.js";
import { StyleLinter, StyleValidationResult } from "./style-linter.js";

const WRITER_PROVIDER: "openai" | "deepseek" | "gemini" = "openai";
const WRITER_MODEL = "gpt-5.5";

function brazilianDate(): string {
  return new Date().toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Fortaleza",
  });
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens = 32768
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY não definida");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: WRITER_MODEL,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Writer Error: ${response.status} — ${err}`);
  }

  const data = await response.json() as any;
  const text: string = data.choices?.[0]?.message?.content?.trim() ?? "";
  const inputTokens: number = data.usage?.prompt_tokens ?? 0;
  const outputTokens: number = data.usage?.completion_tokens ?? 0;
  const finishReason: string = data.choices?.[0]?.finish_reason ?? "UNKNOWN";

  if (finishReason === "length") {
    console.warn(`[Writer] OpenAI atingiu max_tokens (outputTokens=${outputTokens}). Peça pode estar truncada.`);
  }
  if (!text) throw new Error("OpenAI não retornou rascunho de peça.");
  return { text, inputTokens, outputTokens };
}

// ─── DeepSeek (OpenAI-compatible) ────────────────────────────────────────────

async function callDeepSeek(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens = 32768
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env["DEEPSEEK_API_KEY"];
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY não definida");

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: WRITER_MODEL,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek Writer Error: ${response.status} — ${err}`);
  }

  const data = await response.json() as any;
  const text: string = data.choices?.[0]?.message?.content?.trim() ?? "";
  const inputTokens: number = data.usage?.prompt_tokens ?? 0;
  const outputTokens: number = data.usage?.completion_tokens ?? 0;
  const finishReason: string = data.choices?.[0]?.finish_reason ?? "UNKNOWN";

  if (finishReason === "length") {
    console.warn(`[Writer] DeepSeek atingiu max_tokens (outputTokens=${outputTokens}). Peça pode estar truncada.`);
  }
  if (!text) throw new Error("DeepSeek não retornou rascunho de peça.");
  return { text, inputTokens, outputTokens };
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

async function callGemini(
  systemInstruction: string,
  contents: GeminiContent[],
  maxOutputTokens = 32768
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY não definida");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: { text: systemInstruction } },
      contents,
      generationConfig: { temperature: 0.2, maxOutputTokens },
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
  const finishReason: string = data.candidates?.[0]?.finishReason ?? "UNKNOWN";

  if (finishReason === "MAX_TOKENS") {
    console.warn(`[Writer] Gemini atingiu MAX_TOKENS (outputTokens=${outputTokens}). Peça pode estar truncada.`);
  }
  if (!text) throw new Error("Gemini não retornou rascunho de peça.");
  return { text, inputTokens, outputTokens };
}

// ─── Writer Service ───────────────────────────────────────────────────────────

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

    const today = brazilianDate();
    const userMessage =
      "Redija a peça final completa agora seguindo RIGOROSAMENTE a estrutura da tarefa.\n\n" +
      "PARA PETIÇÃO INICIAL — REQUISITOS INVIOLÁVEIS:\n" +
      "• A seção III — DO DIREITO deve ter no mínimo 1.200 palavras. Cada ► TESE deve ter mínimo 4 parágrafos densos (§1 contexto normativo, §2 análise do dispositivo, §3 subsunção ao caso, §4 consequência jurídica). Se uma tese ficou com menos de 4 parágrafos, está incompleta.\n" +
      "• Peça completa: mínimo 2.500 palavras.\n" +
      "• Mínimo 4 teses com fundamentos legais distintos.\n\n" +
      "PARA RECURSO E SENTENÇA: mínimo 2.000 palavras.\n\n" +
      `DATA ATUAL: ${today}. No [FECHAMENTO], substitua [data] ou [Data] por: ${today}.\n\n` +
      "ATENÇÃO MÁXIMA: É ESTRITAMENTE PROIBIDO escrever 'vem à presença', 'vem perante', " +
      "'Diante do exposto, requer', 'Ante o exposto, requer', 'Termos em que', 'Pede deferimento', " +
      "'[JUR-1]', '[JUR-2]' ou qualquer '[JUR-N]' literalmente. Redação técnica, direta e densa.";

    let draft = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let styleValidation: StyleValidationResult | undefined;

    if (WRITER_PROVIDER === "openai" || WRITER_PROVIDER === "deepseek") {
      // ── OpenAI / DeepSeek loop (OpenAI-compatible API) ─────────────────────
      const caller = WRITER_PROVIDER === "openai" ? callOpenAI : callDeepSeek;
      let messages: { role: "user" | "assistant"; content: string }[] = [
        { role: "user", content: userMessage },
      ];

      for (let attempt = 1; attempt <= 2; attempt++) {
        const result = await caller(systemPrompt, messages, 32768);
        draft = result.text;
        inputTokens += result.inputTokens;
        outputTokens += result.outputTokens;

        styleValidation = StyleLinter.validateStyle(draft);
        if (styleValidation.score === 100 || attempt === 2) break;

        messages.push({ role: "assistant", content: draft });
        messages.push({
          role: "user",
          content:
            `[REVISÃO INSTITUCIONAL] Sua peça reprovou no teste de estilo com nota ${styleValidation.score}/100.\n` +
            `Erros detectados:\n- ${styleValidation.warnings.join("\n- ")}\n\n` +
            "REESCREVA a peça completa, corrigindo OBRIGATORIAMENTE esses erros.",
        });
      }
    } else {
      // ── Gemini loop ────────────────────────────────────────────────────────
      let contents: GeminiContent[] = [
        { role: "user", parts: [{ text: userMessage }] },
      ];

      for (let attempt = 1; attempt <= 2; attempt++) {
        const result = await callGemini(systemPrompt, contents, 32768);
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
              `[REVISÃO INSTITUCIONAL] Sua peça reprovou com nota ${styleValidation.score}/100.\n` +
              `Erros:\n- ${styleValidation.warnings.join("\n- ")}\n\nREESCREVA a peça completa.`,
          }],
        });
      }
    }

    const promptSnapshot = systemPrompt.substring(0, 1500) + "\\n...[TRUNCADO PARA SNAPSHOT]";
    return { draft, inputTokens, outputTokens, promptSnapshot, styleValidation };
  }
}

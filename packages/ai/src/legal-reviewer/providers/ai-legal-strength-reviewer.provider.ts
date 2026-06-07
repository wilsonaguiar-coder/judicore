import type { AiLegalStrengthReviewRequest } from "../dto/ai-legal-strength-review-request.js";
import type { StrengthFindingType } from "../enums/strength-finding-type.enum.js";
import type { OpportunityLevel } from "../enums/opportunity-level.enum.js";
import { buildStrengthReviewerPrompt } from "../prompts/strength-reviewer.prompt.js";

const DEEPSEEK_MODEL = "deepseek-chat";
const OPENAI_MODEL = "gpt-5.5-pro";

const SYSTEM_MESSAGE =
  "Você é um advogado sênior especializado em fortalecimento de peças jurídicas. " +
  "Retorne exclusivamente JSON válido.";

/** Raw shape returned by the model before service augmentation. */
export interface RawStrengthFinding {
  type: StrengthFindingType;
  opportunity: OpportunityLevel;
  title: string;
  rationale: string;
  evidenceFromText: string[];
  suggestion: string;
  availableSource?: string;
  confidence: number;
}

/**
 * Extrai e parseia um array JSON de uma resposta do modelo que pode conter
 * code fences markdown, texto antes ou depois do JSON.
 * Retorna null em qualquer falha — nunca lança exceção.
 */
export function safeJsonParse(raw: string): RawStrengthFinding[] | null {
  try {
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    const start = stripped.indexOf("[");
    const end = stripped.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) return null;

    const jsonSlice = stripped.slice(start, end + 1);
    const parsed = JSON.parse(jsonSlice);

    if (!Array.isArray(parsed)) return null;
    return parsed as RawStrengthFinding[];
  } catch {
    return null;
  }
}

export class AiLegalStrengthReviewerProvider {
  usedProvider = "DEEPSEEK";
  usedModel = DEEPSEEK_MODEL;

  constructor(
    private readonly deepseekKey: string = process.env["DEEPSEEK_API_KEY"] ?? "",
    private readonly openaiKey: string = process.env["OPENAI_API_KEY"] ?? "",
  ) {}

  public async callWithFallback(request: AiLegalStrengthReviewRequest): Promise<RawStrengthFinding[]> {
    const preferredProvider = request.provider ?? "DEEPSEEK";

    if (preferredProvider === "DEEPSEEK") {
      try {
        return await this.callDeepSeek(request);
      } catch {
        return await this.callOpenAI(request);
      }
    }

    try {
      return await this.callOpenAI(request);
    } catch {
      return await this.callDeepSeek(request);
    }
  }

  private async callDeepSeek(request: AiLegalStrengthReviewRequest): Promise<RawStrengthFinding[]> {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.deepseekKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.1,
        max_tokens: 2000,
        messages: [
          { role: "system", content: SYSTEM_MESSAGE },
          { role: "user", content: buildStrengthReviewerPrompt(request) },
        ],
      }),
    });

    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";

    this.usedProvider = "DEEPSEEK";
    this.usedModel = DEEPSEEK_MODEL;

    return safeJsonParse(content) ?? [];
  }

  private async callOpenAI(request: AiLegalStrengthReviewRequest): Promise<RawStrengthFinding[]> {
    const OPENAI_MODEL = "gpt-4o";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.openaiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.1,
        max_tokens: 2000,
        messages: [
          { role: "system", content: SYSTEM_MESSAGE },
          { role: "user", content: buildStrengthReviewerPrompt(request) },
        ],
      }),
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";

    this.usedProvider = "OPENAI";
    this.usedModel = OPENAI_MODEL;

    return safeJsonParse(content) ?? [];
  }
}

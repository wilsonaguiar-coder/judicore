import type { AiLegalReviewRequest } from "../dto/ai-legal-review-request.js";
import type { FindingType } from "../enums/finding-type.enum.js";
import type { Severity } from "../enums/severity.enum.js";
import { buildLegalReviewerPrompt } from "../prompts/legal-reviewer.prompt.js";

const DEEPSEEK_MODEL = "deepseek-chat";
const OPENAI_MODEL = "gpt-4o";

/** Raw shape returned by the model before service augmentation. */
export interface RawFinding {
  type: FindingType;
  severity: Severity;
  title: string;
  explanation: string;
  evidenceFromText: string[];
  suggestedReview: string;
  confidence: number;
}

/**
 * Extracts and parses a JSON array from a model response that may include
 * markdown code fences, leading text, or trailing text.
 * Returns null on any parse failure — never throws.
 */
export function safeJsonParse(raw: string): RawFinding[] | null {
  try {
    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    // Find the first '[' and last ']' to extract the array
    const start = stripped.indexOf("[");
    const end = stripped.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) return null;

    const jsonSlice = stripped.slice(start, end + 1);
    const parsed = JSON.parse(jsonSlice);

    if (!Array.isArray(parsed)) return null;
    return parsed as RawFinding[];
  } catch {
    return null;
  }
}

export class AiLegalReviewerProvider {
  usedProvider = "DEEPSEEK";
  usedModel = DEEPSEEK_MODEL;

  constructor(
    private readonly deepseekKey: string = process.env["DEEPSEEK_API_KEY"] ?? "",
    private readonly openaiKey: string = process.env["OPENAI_API_KEY"] ?? "",
  ) {}

  public async callWithFallback(request: AiLegalReviewRequest): Promise<RawFinding[]> {
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

  private async callDeepSeek(request: AiLegalReviewRequest): Promise<RawFinding[]> {
    const prompt = buildLegalReviewerPrompt(request);

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
          { role: "system", content: "Você é um revisor jurídico. Retorne exclusivamente JSON válido." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json() as any;
    const content: string = data.choices?.[0]?.message?.content ?? "";

    this.usedProvider = "DEEPSEEK";
    this.usedModel = DEEPSEEK_MODEL;

    return safeJsonParse(content) ?? [];
  }

  private async callOpenAI(request: AiLegalReviewRequest): Promise<RawFinding[]> {
    const prompt = buildLegalReviewerPrompt(request);

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
          { role: "system", content: "Você é um revisor jurídico. Retorne exclusivamente JSON válido." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as any;
    const content: string = data.choices?.[0]?.message?.content ?? "";

    this.usedProvider = "OPENAI";
    this.usedModel = OPENAI_MODEL;

    return safeJsonParse(content) ?? [];
  }
}

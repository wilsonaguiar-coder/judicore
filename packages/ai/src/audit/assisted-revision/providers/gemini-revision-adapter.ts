import type { AssistedRevisionRequest, AssistedRevisionSuggestion } from "../assisted-revision.types.js";
import type { LLMRevisionAdapter } from "../llm-revision-adapter.js";
import type { RevisionProviderConfig } from "./revision-provider.types.js";
import { buildRevisionPrompt, determineRiskLevel } from "./prompt-builder.js";

export class GeminiRevisionAdapter implements LLMRevisionAdapter {
  constructor(
    private apiKey: string,
    private config: RevisionProviderConfig = { provider: "GEMINI", model: "gemini-2.5-pro", temperature: 0.2, maxTokens: 500 }
  ) {}

  public async suggestRevision(request: AssistedRevisionRequest): Promise<AssistedRevisionSuggestion> {
    const prompt = buildRevisionPrompt(request);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        system_instruction: {
          parts: { text: "Voc\u00EA \u00E9 um assistente jur\u00EDdico estrito." }
        },
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const suggestionText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!suggestionText) {
      throw new Error("Resposta vazia da Gemini");
    }

    return {
      taskId: request.task.id,
      code: request.task.code,
      instruction: request.task.instruction,
      suggestion: suggestionText,
      riskLevel: determineRiskLevel(request.task.code),
      requiresHumanReview: true,
    };
  }
}

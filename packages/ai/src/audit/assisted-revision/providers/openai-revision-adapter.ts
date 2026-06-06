import type { AssistedRevisionRequest, AssistedRevisionSuggestion } from "../assisted-revision.types.js";
import type { LLMRevisionAdapter } from "../llm-revision-adapter.js";
import type { RevisionProviderConfig } from "./revision-provider.types.js";
import { buildRevisionPrompt, determineRiskLevel } from "./prompt-builder.js";

export class OpenAIRevisionAdapter implements LLMRevisionAdapter {
  constructor(
    private apiKey: string,
    private config: RevisionProviderConfig = { provider: "OPENAI", model: "gpt-4o", temperature: 0.2, maxTokens: 500 }
  ) {}

  public async suggestRevision(request: AssistedRevisionRequest): Promise<AssistedRevisionSuggestion> {
    const prompt = buildRevisionPrompt(request);

    // Esqueleto de chamada real para OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        messages: [
          { role: "system", content: "Voc\u00EA \u00E9 um assistente jur\u00EDdico estrito." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const suggestionText = data.choices?.[0]?.message?.content?.trim() || "";

    if (!suggestionText) {
      throw new Error("Resposta vazia da OpenAI");
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

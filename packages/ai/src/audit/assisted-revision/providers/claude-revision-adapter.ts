import type { AssistedRevisionRequest, AssistedRevisionSuggestion } from "../assisted-revision.types.js";
import type { LLMRevisionAdapter } from "../llm-revision-adapter.js";
import type { RevisionProviderConfig } from "./revision-provider.types.js";
import { buildRevisionPrompt, determineRiskLevel } from "./prompt-builder.js";

export class ClaudeRevisionAdapter implements LLMRevisionAdapter {
  constructor(
    private apiKey: string,
    private config: RevisionProviderConfig = { provider: "CLAUDE", model: "claude-3-5-sonnet-20241022", temperature: 0.2, maxTokens: 500 }
  ) {}

  public async suggestRevision(request: AssistedRevisionRequest): Promise<AssistedRevisionSuggestion> {
    const prompt = buildRevisionPrompt(request);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: "Voc\u00EA \u00E9 um assistente jur\u00EDdico estrito.",
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const suggestionText = data.content?.[0]?.text?.trim() || "";

    if (!suggestionText) {
      throw new Error("Resposta vazia da Anthropic (Claude)");
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

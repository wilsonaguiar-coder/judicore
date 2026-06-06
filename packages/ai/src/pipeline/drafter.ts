import { getOpenAIClient, MODEL } from "../client.js";
import { buildSystemPrompt } from "../prompts/system.prompt.js";
import { buildDraftPrompt } from "../prompts/drafter.prompt.js";
import type { LegalClassification, LegalExtraction, ArgumentationMatrix, JurisprudenciaAnalyzed, GenerationMode, DecidedOutcome } from "./types.js";

export class LegalDraftService {
  async *draft(
    classification: LegalClassification,
    extraction: LegalExtraction,
    matrix: ArgumentationMatrix,
    jurisprudencias: JurisprudenciaAnalyzed[],
    onUsage?: (input: number, output: number) => void,
    instruction?: string,
    corrections?: string,
    mode: GenerationMode = "FINAL_DRAFT",
    decidedOutcome?: DecidedOutcome,
  ): AsyncGenerator<string> {
    const client = getOpenAIClient();
    const isPostulatorio = classification.tipo_peca === "PETICAO_INICIAL" || classification.tipo_peca === "RECURSO";

    const stream = await client.chat.completions.create({
      model: MODEL,
      max_tokens: isPostulatorio ? 16384 : 8192,
      temperature: mode === "SAFE_SKELETON" ? 0.3 : isPostulatorio ? 0.85 : 0.65,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: buildDraftPrompt(classification, extraction, matrix, jurisprudencias, instruction, corrections, mode, decidedOutcome),
        },
      ],
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      if (chunk.usage && onUsage) {
        onUsage(chunk.usage.prompt_tokens ?? 0, chunk.usage.completion_tokens ?? 0);
      }
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) yield text;
    }
  }
}

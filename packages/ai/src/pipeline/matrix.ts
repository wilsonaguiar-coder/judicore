import { getOpenAIClient } from "../client.js";
import type { LegalClassification, LegalExtraction, ArgumentationMatrix, JurisprudenciaAnalyzed, ServiceUsage } from "./types.js";
import { buildMatrixPrompt } from "../prompts/matrix.prompt.js";

const MATRIX_MODEL = "gpt-4.1";

export class LegalMatrixService {
  async buildMatrix(
    extraction: LegalExtraction,
    classification: LegalClassification,
    jurisprudencias: JurisprudenciaAnalyzed[],
  ): Promise<{ matrix: ArgumentationMatrix; usage: ServiceUsage }> {
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: MATRIX_MODEL,
      temperature: 0.2,
      max_tokens: 3072,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Você é um especialista em construção de argumentação jurídica estruturada. Retorne SOMENTE JSON válido.",
        },
        {
          role: "user",
          content: buildMatrixPrompt(extraction, classification, jurisprudencias),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`Construtor de matriz retornou JSON inválido: ${raw.slice(0, 200)}`);
    }

    const matrix: ArgumentationMatrix = {
      teses: (parsed["teses"] as ArgumentationMatrix["teses"] | undefined) ?? [],
    };

    const validIds = new Set(jurisprudencias.map((j) => j.id));
    matrix.teses = matrix.teses.map((t) => ({
      ...t,
      jurisprudencia_id: t.jurisprudencia_id && validIds.has(t.jurisprudencia_id) ? t.jurisprudencia_id : null,
    }));

    return {
      matrix,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model: MATRIX_MODEL,
      },
    };
  }
}

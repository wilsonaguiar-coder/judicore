import { getOpenAIClient } from "../client.js";
import type { LegalClassification, TipoPeca, JurisprudenciaInput, ServiceUsage } from "./types.js";
import { buildClassificationPrompt } from "../prompts/classifier.prompt.js";

const CLASSIFIER_MODEL = "gpt-4.1";

export class LegalClassifierService {
  async classify(
    caseDescription: string,
    documentTypeHint: TipoPeca,
    jurisprudencias: JurisprudenciaInput[],
  ): Promise<{ classification: LegalClassification; usage: ServiceUsage }> {
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: CLASSIFIER_MODEL,
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Você é um classificador jurídico especializado. Retorne SOMENTE JSON válido conforme o schema solicitado.",
        },
        {
          role: "user",
          content: buildClassificationPrompt(caseDescription, documentTypeHint, jurisprudencias),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`Classificador retornou JSON inválido: ${raw.slice(0, 200)}`);
    }

    const classification = parsed as unknown as LegalClassification;

    if (!classification.tipo_justica || !classification.tipo_peca) {
      throw new Error("Classificação incompleta: tipo_justica e tipo_peca são obrigatórios");
    }

    return {
      classification,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model: CLASSIFIER_MODEL,
      },
    };
  }
}

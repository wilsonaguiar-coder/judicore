import { getOpenAIClient } from "../client.js";
import type { LegalClassification, LegalExtraction, JurisprudenciaInput, ServiceUsage, ExtractionQuality } from "./types.js";
import { buildExtractionPrompt } from "../prompts/extractor.prompt.js";

const EXTRACTOR_MODEL = "gpt-4.1";

export class LegalExtractionService {
  async extract(
    caseDescription: string,
    classification: LegalClassification,
    jurisprudencias: JurisprudenciaInput[],
  ): Promise<{ extraction: LegalExtraction; usage: ServiceUsage }> {
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: EXTRACTOR_MODEL,
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Você é um especialista em extração de informações jurídicas. Retorne SOMENTE JSON válido.",
        },
        {
          role: "user",
          content: buildExtractionPrompt(caseDescription, classification, jurisprudencias),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`Extrator retornou JSON inválido: ${raw.slice(0, 200)}`);
    }

    const qualidade = (parsed["qualidade_extracao"] as ExtractionQuality | undefined) ?? "INSUFICIENTE";

    const extraction: LegalExtraction = {
      fatos: (parsed["fatos"] as string[] | undefined) ?? [],
      pedidos: (parsed["pedidos"] as string[] | undefined) ?? [],
      questoes_juridicas: (parsed["questoes_juridicas"] as string[] | undefined) ?? [],
      artigos_citados: (parsed["artigos_citados"] as string[] | undefined) ?? [],
      jurisprudencias_relevantes: (parsed["jurisprudencias_relevantes"] as string[] | undefined) ?? [],
      qualidade_extracao: qualidade,
      motivo_qualidade: (parsed["motivo_qualidade"] as string | null | undefined) ?? undefined,
    };

    const validIds = new Set(jurisprudencias.map((j) => j.id));
    extraction.jurisprudencias_relevantes = extraction.jurisprudencias_relevantes.filter((id) => validIds.has(id));

    return {
      extraction,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model: EXTRACTOR_MODEL,
      },
    };
  }
}

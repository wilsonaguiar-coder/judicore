import { getOpenAIClient } from "../client.js";
import type { LegalClassification, LegalExtraction, JurisprudenciaInput, ServiceUsage, ExtractionQuality } from "./types.js";

const EXTRACTOR_MODEL = "gpt-4.1";

function buildExtractionPrompt(
  caseDescription: string,
  classification: LegalClassification,
  jurisprudencias: JurisprudenciaInput[],
): string {
  const jurList = jurisprudencias.map((j) => `- ID "${j.id}": ${j.tribunal} | Tema: ${j.tema} | Tese: ${j.tese}`).join("\n");

  return `Extraia informações estruturadas do caso jurídico abaixo.

CLASSIFICAÇÃO JÁ DETERMINADA:
- Justiça: ${classification.tipo_justica}
- Peça: ${classification.tipo_peca}
- Regime: ${classification.regime_juridico ?? "não identificado"}
- Assunto: ${classification.assunto_principal}

CASO:
${caseDescription}

JURISPRUDÊNCIAS DISPONÍVEIS (use apenas os IDs listados abaixo para referenciar):
${jurList || "Nenhuma jurisprudência fornecida"}

Retorne SOMENTE um JSON válido com esta estrutura:
{
  "fatos": ["fato 1", "fato 2", ...],
  "pedidos": ["pedido 1", "pedido 2", ...],
  "questoes_juridicas": ["questão 1", "questão 2", ...],
  "artigos_citados": ["art. X da Lei Y", ...],
  "jurisprudencias_relevantes": ["id_da_jur_relevante", ...],
  "qualidade_extracao": "SUFICIENTE" | "PARCIAL" | "INSUFICIENTE",
  "motivo_qualidade": "razão se PARCIAL ou INSUFICIENTE, caso contrário null"
}

REGRAS:
- fatos: lista os fatos materiais concretos e específicos do caso (mínimo 3)
- pedidos: lista os pedidos inferíveis do caso (mínimo 2)
- questoes_juridicas: questões de direito que precisam ser resolvidas (mínimo 2)
- artigos_citados: artigos mencionados no caso ou evidentemente aplicáveis
- jurisprudencias_relevantes: SOMENTE IDs de jurisprudências TEMATICAMENTE RELEVANTES ao assunto "${classification.assunto_principal}". Se nenhuma for relevante, retorne array vazio.
- qualidade_extracao:
  SUFICIENTE — fatos >= 3 concretos e específicos, pedidos >= 2 identificados, assunto claro
  PARCIAL    — alguns fatos presentes mas incompletos, partes não identificadas, pedidos vagos, ou assunto genérico
  INSUFICIENTE — caso extremamente vago, sem fatos concretos identificáveis (ex: "pesquisa livre", "teste", input genérico)
- motivo_qualidade: obrigatório se PARCIAL ou INSUFICIENTE; null se SUFICIENTE

Retorne SOMENTE o JSON, sem texto adicional.`;
}

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

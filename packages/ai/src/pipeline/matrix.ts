import { getOpenAIClient } from "../client.js";
import type { LegalClassification, LegalExtraction, ArgumentationMatrix, JurisprudenciaInput, ServiceUsage } from "./types.js";

const MATRIX_MODEL = "gpt-4.1";

function buildMatrixPrompt(
  extraction: LegalExtraction,
  classification: LegalClassification,
  jurisprudencias: JurisprudenciaInput[],
): string {
  const relevantJurs = jurisprudencias.filter((j) => extraction.jurisprudencias_relevantes.includes(j.id));
  const jurBlock = relevantJurs.length > 0
    ? relevantJurs.map((j) => `ID "${j.id}": ${j.tribunal} — Tese: ${j.tese}`).join("\n")
    : "Nenhuma jurisprudência relevante identificada";

  return `Monte a matriz de argumentação para a peça ${classification.tipo_peca} na ${classification.tipo_justica}.

PEDIDOS IDENTIFICADOS:
${extraction.pedidos.map((p, i) => `${i + 1}. ${p}`).join("\n")}

QUESTÕES JURÍDICAS:
${extraction.questoes_juridicas.map((q, i) => `${i + 1}. ${q}`).join("\n")}

FATOS RELEVANTES:
${extraction.fatos.map((f, i) => `${i + 1}. ${f}`).join("\n")}

JURISPRUDÊNCIAS DISPONÍVEIS (relevantes já filtradas):
${jurBlock}

Retorne SOMENTE um JSON válido com esta estrutura:
{
  "teses": [
    {
      "id": "tese_001",
      "pedido": "pedido ao qual esta tese corresponde",
      "fato": "fato(s) do caso que sustentam este pedido",
      "norma": "artigo(s) de lei aplicáveis com diploma (ex: art. 7º I CF/88)",
      "jurisprudencia_id": "id_da_jur ou null se não houver relevante",
      "conclusao": "conclusão jurídica desta tese"
    }
  ]
}

REGRAS OBRIGATÓRIAS:
- Cada pedido deve ter ao menos uma tese correspondente
- norma: NUNCA invente artigos. Use apenas diplomas aplicáveis à ${classification.tipo_justica} / regime ${classification.regime_juridico ?? "geral"}
- jurisprudencia_id: use SOMENTE IDs listados acima. Se nenhuma for relevante para esta tese específica, use null
- Mínimo de ${extraction.pedidos.length > 0 ? extraction.pedidos.length : 2} teses

Retorne SOMENTE o JSON, sem texto adicional.`;
}

export class LegalMatrixService {
  async buildMatrix(
    extraction: LegalExtraction,
    classification: LegalClassification,
    jurisprudencias: JurisprudenciaInput[],
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

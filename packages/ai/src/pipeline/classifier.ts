import { getOpenAIClient } from "../client.js";
import type { LegalClassification, TipoPeca, JurisprudenciaInput, ServiceUsage } from "./types.js";

const CLASSIFIER_MODEL = "gpt-4.1";

function buildClassificationPrompt(caseDescription: string, documentTypeHint: TipoPeca, jurisprudencias: JurisprudenciaInput[]): string {
  const jurCtx = jurisprudencias.length > 0
    ? `\nJurisprudências fornecidas (use apenas os tribunais para inferir jurisdição):\n${jurisprudencias.slice(0, 3).map((j) => `- ${j.tribunal}: ${j.tema}`).join("\n")}`
    : "";

  return `Analise o caso jurídico abaixo e retorne um JSON de classificação. O tipo de peça solicitado pelo usuário é "${documentTypeHint}".

CASO:
${caseDescription}
${jurCtx}

Retorne SOMENTE um JSON válido com esta estrutura exata:
{
  "tipo_justica": "TRABALHO" | "FEDERAL" | "ESTADUAL",
  "tipo_peca": "${documentTypeHint}",
  "regime_juridico": "CLT" | "RPPS" | "RGPS" | "ESTATUTARIO" | "CIVIL" | null,
  "grau": "PRIMEIRO" | "SEGUNDO" | "SUPERIOR",
  "tribunal_competente": "nome do tribunal (ex: TRT-15, TRF-3, TJSP)",
  "rito": "ORDINARIO" | "SUMARIO" | "SUMARIISSIMO" | "JEF" | "COMUM" | null,
  "assunto_principal": "descrição em 1 frase do objeto central do caso",
  "partes": {
    "autor": "nome/qualificação do autor ou [NÃO IDENTIFICADO]",
    "reu": "nome/qualificação do réu ou [NÃO IDENTIFICADO]"
  },
  "confianca": 0.0 a 1.0
}

REGRAS DE CLASSIFICAÇÃO:
- Se o caso envolver empregado CLT, empresa privada, FGTS, rescisão, horas extras → TRABALHO + CLT
- Se envolver servidor público federal, INSS, benefício previdenciário RGPS → FEDERAL
- Se envolver servidor público estadual/municipal com regime próprio → ESTADUAL ou FEDERAL + RPPS
- Se envolver aposentadoria de servidor público → RPPS (art. 40 CF) e NÃO RGPS (art. 201 CF)
- Se envolver benefício do INSS (auxílio-doença, aposentadoria por invalidez) → RGPS
- grau PRIMEIRO para ações originárias, SEGUNDO para recursos, SUPERIOR para REsp/RR
- confianca: 0.9+ se o caso é claro, 0.5-0.8 se há ambiguidade

Retorne SOMENTE o JSON, sem texto adicional.`;
}

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

import type { LegalClassification, JurisprudenciaInput } from "../pipeline/types.js";

export function buildExtractionPrompt(
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

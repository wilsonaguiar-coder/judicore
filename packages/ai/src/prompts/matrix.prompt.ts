import type { LegalClassification, LegalExtraction, JurisprudenciaInput } from "../pipeline/types.js";

export function buildMatrixPrompt(
  extraction: LegalExtraction,
  classification: LegalClassification,
  jurisprudencias: JurisprudenciaInput[],
): string {
  // Usa todas as jurisprudências selecionadas pelo usuário.
  // O extrator pode filtrar agressivamente quando o assunto é genérico — nesse caso
  // usa a lista completa, respeitando a seleção manual do usuário.
  const jursParaMatriz = extraction.jurisprudencias_relevantes.length > 0
    ? jurisprudencias.filter((j) => extraction.jurisprudencias_relevantes.includes(j.id))
    : jurisprudencias;
  const jurBlock = jursParaMatriz.length > 0
    ? jursParaMatriz.map((j) => `ID "${j.id}": ${j.tribunal} — Tese: ${j.tese}`).join("\n")
    : "Nenhuma jurisprudência fornecida";

  const minTeses = Math.max((extraction.pedidos.length > 0 ? extraction.pedidos.length : 1) * 2, 2);

  return `Monte a matriz de argumentação para a peça ${classification.tipo_peca} na ${classification.tipo_justica}.

PEDIDOS IDENTIFICADOS:
${extraction.pedidos.map((p, i) => `${i + 1}. ${p}`).join("\n")}

QUESTÕES JURÍDICAS:
${extraction.questoes_juridicas.map((q, i) => `${i + 1}. ${q}`).join("\n")}

FATOS RELEVANTES:
${extraction.fatos.map((f, i) => `${i + 1}. ${f}`).join("\n")}

JURISPRUDÊNCIAS DISPONÍVEIS (selecionadas pelo usuário):
${jurBlock}

Retorne SOMENTE um JSON válido com esta estrutura:
{
  "teses": [
    {
      "id": "tese_001",
      "pedido": "pedido ao qual esta tese corresponde (transcreva com precisão)",
      "tese": "enunciado claro da proposição jurídica desta tese",
      "fato": "fato concreto e específico do caso que sustenta este pedido — NUNCA use 'caso concreto', 'direito alegado', 'fatos narrados'",
      "norma": "artigo específico + diploma legal (ex: art. 7º da EC 41/2003) — NUNCA use 'legislação aplicável' ou 'normas pertinentes'",
      "ratio": "ratio jurídica — por que esta norma garante este direito no contexto do caso",
      "contraponto": "principal objeção ou argumento contrário que pode ser levantado (opcional, use null se não houver)",
      "resposta_contraponto": "resposta jurídica ao contraponto (obrigatório se contraponto não for null)",
      "jurisprudencia_id": "id_da_jur ou null se nenhuma for aplicável a esta tese específica",
      "conclusao": "conclusão jurídica aplicada diretamente ao pedido"
    }
  ]
}

REGRAS OBRIGATÓRIAS:
- Gere no mínimo 2 teses por pedido (salvo pedidos meramente acessórios como honorários e custas)
- Total mínimo de teses: ${minTeses}
- norma: NUNCA invente artigos. Use apenas diplomas aplicáveis à ${classification.tipo_justica} / regime ${classification.regime_juridico ?? "geral"}
- jurisprudencia_id: use SOMENTE IDs listados acima. Se nenhuma for relevante para esta tese específica, use null
- fato: deve ser concreto e específico ao caso — jamais genérico
- ratio: explique o nexo jurídico entre norma, fato e pedido
- contraponto + resposta_contraponto fortalecem a peça — preencha sempre que possível

Retorne SOMENTE o JSON, sem texto adicional.`;
}

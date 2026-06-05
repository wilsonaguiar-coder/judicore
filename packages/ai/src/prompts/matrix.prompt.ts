import type { LegalClassification, LegalExtraction, JurisprudenciaAnalyzed } from "../pipeline/types.js";

export function buildMatrixPrompt(
  extraction: LegalExtraction,
  classification: LegalClassification,
  jurisprudencias: JurisprudenciaAnalyzed[],
): string {
  const jursParaMatriz =
    extraction.jurisprudencias_relevantes.length > 0
      ? jurisprudencias.filter((j) =>
          extraction.jurisprudencias_relevantes.includes(j.id),
        )
      : jurisprudencias;

  const foundation = jursParaMatriz.filter(
    (j) => !j.evidence || j.evidence.use_mode === "FOUNDATION",
  );
  const counterArg = jursParaMatriz.filter(
    (j) => j.evidence?.use_mode === "COUNTER_ARGUMENT",
  );
  const contextOnly = jursParaMatriz.filter(
    (j) =>
      j.evidence?.use_mode === "CONTEXT_ONLY" ||
      j.evidence?.use_mode === "DISCARD",
  );

  const fmt = (j: JurisprudenciaAnalyzed) =>
    `ID "${j.id}": ${j.tribunal} — Tese: ${j.tese}`;

  const blocks: string[] = [];
  if (foundation.length > 0)
    blocks.push(
      `JURISPRUDÊNCIAS FAVORÁVEIS — FOUNDATION (use como fundamento de tese, campo jurisprudencia_id):\n${foundation.map(fmt).join("\n")}`,
    );
  if (counterArg.length > 0)
    blocks.push(
      `JURISPRUDÊNCIAS CONTRÁRIAS — COUNTER_ARGUMENT (NUNCA como fundamento favorável; use apenas em distinguishing/refutação, campo counter_jurisprudencia_id):\n${counterArg.map(fmt).join("\n")}`,
    );
  if (contextOnly.length > 0)
    blocks.push(
      `JURISPRUDÊNCIAS NEUTRAS/DESCARTADAS (não usar como fundamento principal):\n${contextOnly.map(fmt).join("\n")}`,
    );

  const jurBlock = blocks.length > 0 ? blocks.join("\n\n") : "Nenhuma jurisprudência fornecida";

  const minTeses = Math.max(
    (extraction.pedidos.length > 0 ? extraction.pedidos.length : 1) * 2,
    2,
  );

  return `Monte a matriz de argumentação para a peça ${classification.tipo_peca} na ${classification.tipo_justica}.

PEDIDOS IDENTIFICADOS:
${extraction.pedidos.map((p, i) => `${i + 1}. ${p}`).join("\n")}

QUESTÕES JURÍDICAS:
${extraction.questoes_juridicas.map((q, i) => `${i + 1}. ${q}`).join("\n")}

FATOS RELEVANTES:
${extraction.fatos.map((f, i) => `${i + 1}. ${f}`).join("\n")}

${jurBlock}

Retorne SOMENTE um JSON válido com esta estrutura:
{
  "teses": [
    {
      "id": "tese_001",
      "pedido": "pedido ao qual esta tese corresponde (transcreva com precisão)",
      "tese": "enunciado claro da proposição jurídica desta tese",
      "fato": "fato concreto e específico do caso — NUNCA use 'caso concreto', 'direito alegado', 'fatos narrados'",
      "norma": "artigo específico + diploma legal (ex: art. 7º da EC 41/2003) — NUNCA invente artigos",
      "ratio": "ratio jurídica — por que esta norma garante este direito no contexto do caso",
      "contraponto": "principal objeção que pode ser levantada (null se não houver)",
      "resposta_contraponto": "resposta jurídica ao contraponto (obrigatório se contraponto não for null)",
      "jurisprudencia_id": "ID de jurisprudência FOUNDATION ou null — NUNCA use ID de COUNTER_ARGUMENT aqui",
      "counter_jurisprudencia_id": "ID de jurisprudência COUNTER_ARGUMENT para distinguishing (null se não houver)",
      "distinguishing": "argumento de distinguishing para a jurisprudência contrária (null se counter_jurisprudencia_id for null)",
      "conclusao": "conclusão jurídica aplicada diretamente ao pedido"
    }
  ]
}

REGRAS OBRIGATÓRIAS:
- Gere no mínimo 2 teses por pedido (salvo pedidos meramente acessórios como honorários e custas)
- Total mínimo de teses: ${minTeses}
- jurisprudencia_id: use SOMENTE IDs de jurisprudências FOUNDATION. Nunca coloque ID de COUNTER_ARGUMENT neste campo.
- counter_jurisprudencia_id: use apenas IDs de jurisprudências COUNTER_ARGUMENT para distinguishing. null se não houver.
- norma: NUNCA invente artigos. Use apenas diplomas aplicáveis à ${classification.tipo_justica} / regime ${classification.regime_juridico ?? "geral"}
${classification.tipo_justica === "TRABALHO" ? `
TRABALHISTA — teses recorrentes que DEVEM ser geradas quando o contexto indicar:
  • Da ausência de comprovação de falta grave (art. 482 CLT)
  • Da ausência de gradação das penalidades (princípio da proporcionalidade)
  • Da ausência de imediatidade (nexo temporal entre fato e punição)
  • Da nulidade da justa causa e reconhecimento da dispensa imotivada
  • Do direito às verbas rescisórias (art. 477 CLT)
  • Do aviso prévio indenizado (art. 487 CLT)
  • Da multa de 40% do FGTS (art. 18 §1º Lei 8.036/90)
Se a peça tiver seção DO DIREITO com subtítulos numerados (1., 2., 3. ou I, II, III),
CADA subtítulo argumentativo deve gerar pelo menos uma tese na matriz.` : ""}
- fato: deve ser concreto e específico ao caso — jamais genérico
- ratio: explique o nexo jurídico entre norma, fato e pedido
- Se houver jurisprudência CONTRARIA relevante: crie tese de refutação com counter_jurisprudencia_id preenchido e distinguishing explicando por que o caso dos autos difere

Retorne SOMENTE o JSON, sem texto adicional.`;
}

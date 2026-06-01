import type { LegalClassification, LegalExtraction, ArgumentationMatrix, JurisprudenciaAnalyzed, GenerationMode } from "../pipeline/types.js";
import { PIECE_TEMPLATES, APPEAL_RULES, getJurisdicaoRules } from "../rules/legal_rules.js";
import { buildModeBlock } from "./template-mode.prompt.js";

const TUTELA_KEYWORDS_RE = /previdenci|pensão\s+por\s+morte|benefício|servidor\s+públic|alimentar|saúde|remuneratório|salarial|vencimentos|proventos|aposentadori|paridade|reajuste/i;

function requiresTutelaUrgencia(classification: LegalClassification, extraction: LegalExtraction): boolean {
  if (classification.tipo_peca !== "PETICAO_INICIAL") return false;
  return (
    TUTELA_KEYWORDS_RE.test(classification.assunto_principal) ||
    ["RPPS", "RGPS"].includes(classification.regime_juridico ?? "") ||
    extraction.pedidos.some((p) => TUTELA_KEYWORDS_RE.test(p))
  );
}

export function buildDraftPrompt(
  classification: LegalClassification,
  extraction: LegalExtraction,
  matrix: ArgumentationMatrix,
  jurisprudencias: JurisprudenciaAnalyzed[],
  instruction?: string,
  corrections?: string,
  mode: GenerationMode = "FINAL_DRAFT",
): string {
  const rules = getJurisdicaoRules(classification.tipo_justica);
  const template = PIECE_TEMPLATES[classification.tipo_peca];
  const relevantJurs = jurisprudencias.filter((j) =>
    matrix.teses.some(
      (t) => t.jurisprudencia_id === j.id || t.counter_jurisprudencia_id === j.id,
    ),
  );

  const foundationJurs = relevantJurs.filter((j) => !j.evidence || j.evidence.use_mode === "FOUNDATION");
  const counterJurs = relevantJurs.filter((j) => j.evidence?.use_mode === "COUNTER_ARGUMENT");

  const foundationBlock = foundationJurs.length > 0
    ? `\nJURISPRUDÊNCIAS FAVORÁVEIS — FOUNDATION (use como fundamento direto da tese):\n${foundationJurs.map((j) => `[${j.id}] ${j.tribunal} — ${j.numero} — Relator: ${j.relator ?? "N/I"} — Data: ${j.dataJulgamento ?? "N/I"}\nTese: ${j.tese}\nEmenta: ${j.ementa.slice(0, 300)}...`).join("\n\n")}`
    : "";

  const counterBlock = counterJurs.length > 0
    ? `\nJURISPRUDÊNCIAS CONTRÁRIAS — COUNTER_ARGUMENT (NUNCA como fundamento favorável — somente para distinguishing/refutação):\n${counterJurs.map((j) => `[${j.id}] ${j.tribunal} — ${j.numero} — Tese contrária: ${j.tese}`).join("\n\n")}`
    : "";

  const jurBlock = (foundationBlock || counterBlock)
    ? `${foundationBlock}${counterBlock}`
    : "\nNenhuma jurisprudência aprovada para uso. NÃO mencione nenhuma decisão judicial.";

  const matrixBlock = `\nMATRIZ DE ARGUMENTAÇÃO (use como estrutura obrigatória — desenvolva cada tese em 3 a 5 parágrafos):\n${matrix.teses.map((t, i) => {
    const lines = [
      `Tese ${i + 1}: ${t.tese ?? t.pedido}`,
      `  Pedido: ${t.pedido}`,
      `  Fato: ${t.fato}`,
      `  Norma: ${t.norma}`,
      `  Ratio: ${t.ratio ?? ""}`,
      t.contraponto ? `  Contraponto: ${t.contraponto}` : null,
      t.resposta_contraponto ? `  Resposta: ${t.resposta_contraponto}` : null,
      `  Jurisprudência: ${t.jurisprudencia_id ?? "nenhuma"}`,
      t.counter_jurisprudencia_id ? `  Jur. Contrária (distinguishing): ${t.counter_jurisprudencia_id}` : null,
      t.distinguishing ? `  Distinguishing: ${t.distinguishing}` : null,
      `  Conclusão: ${t.conclusao}`,
    ].filter(Boolean);
    return lines.join("\n");
  }).join("\n\n")}`;

  const appealInfo = classification.tipo_peca === "SENTENCA" && classification.tipo_justica in (APPEAL_RULES.SENTENCA as Record<string, unknown>)
    ? `\nRECURSO CABÍVEL: ${(APPEAL_RULES.SENTENCA as Record<string, { recurso: string }>)[classification.tipo_justica]?.recurso ?? "ver legislação"}`
    : "";

  const correctionsBlock = corrections
    ? `\n⚠ CORREÇÕES OBRIGATÓRIAS (aplique estritamente):\n${corrections}\nReescreva corrigindo APENAS estes pontos. Não altere fatos, partes nem pedidos.`
    : "";

  const templateProibicoes = (template as { proibicoes?: readonly string[] }).proibicoes ?? ([] as const);
  const prohibitions = [...templateProibicoes, ...rules.artigos_bloqueados];

  const estruturaInstrucao = (template as unknown as { estrutura?: readonly string[] }).estrutura
    ?.map((s, i) => `${i + 1}. ${s}`)
    .join("\n") ?? "";

  const modeBlock = buildModeBlock(mode);

  const peticaoInicialBlock = (() => {
    if (mode !== "FINAL_DRAFT" || classification.tipo_peca !== "PETICAO_INICIAL") return "";
    const hasTutela = requiresTutelaUrgencia(classification, extraction);
    const tutelaInstrucao = hasTutela
      ? `\n⚖ TUTELA DE URGÊNCIA OBRIGATÓRIA (natureza ${classification.regime_juridico ?? "alimentar/previdenciária"} identificada — art. 300 CPC/2015):\nInclua a seção "DA TUTELA DE URGÊNCIA" com:\n  1. Probabilidade do direito (fumus boni iuris) — cite a norma específica;\n  2. Perigo de dano ou risco ao resultado útil do processo (periculum in mora) — aplique ao caso;\n  3. Reversibilidade da medida;\n  4. Pedido liminar específico com o que deve ser deferido imediatamente.\nAdicione o pedido liminar individualizado na seção DOS PEDIDOS.\n`
      : "";
    return `\n📋 PETICAO_INICIAL FINAL_DRAFT — EXIGÊNCIAS MÍNIMAS:\nA seção DO DIREITO DEVE conter no mínimo 6 subtópicos com numeração romana (I, II, III, IV, V, VI...):\n  I — Competência e fundamento jurisdicional\n  II — Regime jurídico aplicável\n  III — Norma principal do direito pleiteado\n  IV — Requisitos legais e aplicação ao caso concreto\n  V — Resistência administrativa ou lesão ao direito${hasTutela ? "\n  VI — Efeitos financeiros e/ou prescrição\n  VII — Da Tutela de Urgência (obrigatório)" : "\n  VI — Efeitos financeiros e/ou prescrição"}\nCada subtópico: 2-4 parágrafos. Tese → norma → aplicação → objeção → resposta → conclusão.${tutelaInstrucao}`;
  })();

  return `${modeBlock}${peticaoInicialBlock}
Redija a peça jurídica com base na classificação, extração e matriz de argumentação abaixo.

CLASSIFICAÇÃO:
- Tipo: ${classification.tipo_peca}
- Justiça: ${classification.tipo_justica} (${rules.descricao})
- Regime: ${classification.regime_juridico ?? "geral"}
- Tribunal: ${classification.tribunal_competente}
- Grau: ${classification.grau}
- Assunto: ${classification.assunto_principal}
- Partes: Autor: ${classification.partes.autor} × Réu: ${classification.partes.reu}

FATOS DO CASO:
${extraction.fatos.map((f, i) => `${i + 1}. ${f}`).join("\n")}

PEDIDOS:
${extraction.pedidos.map((p, i) => `${i + 1}. ${p}`).join("\n")}
${matrixBlock}
${jurBlock}
${appealInfo}
${correctionsBlock}

ESTRUTURA OBRIGATÓRIA (siga esta ordem — estes são TÍTULOS DE SEÇÃO, NÃO os escreva literalmente no texto):
${estruturaInstrucao}

TOM: ${(template as unknown as { tom?: string }).tom ?? "técnico"}
PROIBIÇÕES ABSOLUTAS: ${prohibitions.join(" | ")}
HONORÁRIOS (se aplicável): ${rules.honorarios_artigo}

REGRA CRÍTICA — POSICIONAMENTO DE JURISPRUDÊNCIAS:
- Use jurisprudências FOUNDATION como fundamento positivo das teses
- Jurisprudências COUNTER_ARGUMENT: NUNCA apresente como se apoiassem a tese do autor
- Se citar precedente COUNTER_ARGUMENT, OBRIGATORIAMENTE use: "Embora exista precedente em sentido contrário (${classification.tribunal_competente}...), o caso dos autos distingue-se porque [argumento do distinguishing]"
- Se não houver distinguishing viável para o precedente contrário, NÃO o cite expressamente
- Jamais escreva "conforme entendimento do [tribunal]" usando decisão classificada como CONTRÁRIA
- Use SOMENTE os dados reais dos tribunais/números/relatores listados acima
- NUNCA escreva "[JUR-1]", "[JUR-N]" ou qualquer rótulo no texto final

${instruction ? `INSTRUÇÃO ADICIONAL DO USUÁRIO: ${instruction}` : ""}`;
}

import type { LegalClassification, LegalExtraction, ArgumentationMatrix, JurisprudenciaInput, GenerationMode } from "../pipeline/types.js";
import { PIECE_TEMPLATES, APPEAL_RULES, getJurisdicaoRules } from "../rules/legal_rules.js";
import { buildModeBlock } from "./template-mode.prompt.js";

export function buildDraftPrompt(
  classification: LegalClassification,
  extraction: LegalExtraction,
  matrix: ArgumentationMatrix,
  jurisprudencias: JurisprudenciaInput[],
  instruction?: string,
  corrections?: string,
  mode: GenerationMode = "FINAL_DRAFT",
): string {
  const rules = getJurisdicaoRules(classification.tipo_justica);
  const template = PIECE_TEMPLATES[classification.tipo_peca];
  const relevantJurs = jurisprudencias.filter((j) =>
    matrix.teses.some((t) => t.jurisprudencia_id === j.id),
  );

  const jurBlock = relevantJurs.length > 0
    ? `\nJURISPRUDÊNCIAS APROVADAS PARA USO (use SOMENTE estas, pelos dados reais abaixo):\n${relevantJurs.map((j) => `[${j.id}] ${j.tribunal} — ${j.numero} — Relator: ${j.relator ?? "N/I"} — Data: ${j.dataJulgamento ?? "N/I"}\nTese: ${j.tese}\nEmenta (resumo): ${j.ementa.slice(0, 300)}...`).join("\n\n")}`
    : "\nNenhuma jurisprudência aprovada para uso. NÃO mencione nenhuma decisão judicial.";

  const matrixBlock = `\nMATRIZ DE ARGUMENTAÇÃO (use como estrutura obrigatória):\n${matrix.teses.map((t, i) => `Tese ${i + 1}: ${t.pedido}\n  Fato: ${t.fato}\n  Norma: ${t.norma}\n  Jurisprudência: ${t.jurisprudencia_id ?? "nenhuma"}\n  Conclusão: ${t.conclusao}`).join("\n\n")}`;

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

  return `${modeBlock}Redija a peça jurídica com base na classificação, extração e matriz de argumentação abaixo.

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

REGRA CRÍTICA PARA JURISPRUDÊNCIAS:
- Use SOMENTE as jurisprudências listadas acima com seus dados reais (tribunal, número, relator, data)
- NUNCA escreva "[JUR-1]", "[JUR-N]" ou qualquer rótulo no texto final
- Se não houver jurisprudência aprovada, não mencione nenhuma decisão judicial

${instruction ? `INSTRUÇÃO ADICIONAL DO USUÁRIO: ${instruction}` : ""}`;
}

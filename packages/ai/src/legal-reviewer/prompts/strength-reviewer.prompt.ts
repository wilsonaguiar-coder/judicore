import type { AiLegalStrengthReviewRequest } from "../dto/ai-legal-strength-review-request.js";
import type { DomainKnowledgePack } from "../domain-knowledge/domain-knowledge.types.js";

export function buildStrengthReviewerPrompt(request: AiLegalStrengthReviewRequest): string {
  const { draft, classification, domain, pieceType, audit, correctionPlan, availableDocuments, extractedEntities, domainKnowledgePack } = request;

  const fatalSummary = (audit.audit.fatalErrors ?? [])
    .map(e => `- ${e.titulo}: ${e.descricao}`)
    .join("\n");

  const planSummary = correctionPlan?.items?.length
    ? correctionPlan.items.map(i => `- [${i.priority}] ${i.area}: ${i.instruction}`).join("\n")
    : "Nenhum item de correção pendente.";

  const documentContext = availableDocuments?.length
    ? availableDocuments
        .map(d => {
          const fields = d.keyFields?.length ? ` — campos extraídos: ${d.keyFields.join(", ")}` : "";
          return `  - ${d.type}: ${d.label}${fields}`;
        })
        .join("\n")
    : "  (nenhum documento disponível)";

  const entityContext = extractedEntities?.length
    ? extractedEntities
        .map(e => `  - ${e.field}: "${e.value}" (fonte: ${e.source})`)
        .join("\n")
    : "  (nenhuma entidade extraída)";

  const domainContext = buildDomainKnowledgeSection(domainKnowledgePack);

  return `Você é um advogado sênior com ampla experiência em elaboração e revisão de peças jurídicas processuais.

Sua função exclusiva nesta análise é FORTALECER esta peça antes do protocolo.
Você NÃO está julgando a peça.
Você NÃO aponta erros de forma punitiva.
Você identifica oportunidades objetivas de fortalecimento, completude e persuasão.
Você sugere o que pode ser adicionado, reforçado ou melhor demonstrado.

═══════════════════════════════════════════════
REGRAS ABSOLUTAS — NÃO VIOLAR
═══════════════════════════════════════════════
1. NÃO invente fatos, documentos, provas, legislação, súmulas, precedentes ou jurisprudência.
2. NÃO sugira alteração do resultado pretendido da peça.
3. NÃO crie pedidos novos não presentes na peça.
4. NÃO repita achados já cobertos pelos erros da auditoria determinística listados abaixo.
5. Somente gere finding quando houver evidência textual clara da oportunidade.
6. Em caso de dúvida sobre a relevância, NÃO gere o finding.

ATENÇÃO ESPECIAL — MISSING_LEGAL_ANCHOR:
Este tipo NÃO autoriza inventar artigos, leis, súmulas ou jurisprudência.
Se não houver fundamento específico no contexto enviado, a sugestão deve ser genérica:
PERMITIDO: "Indicar expressamente o fundamento legal aplicável à tese."
PROIBIDO: "Incluir o art. X da Lei Y" (salvo se esse artigo já aparecer na peça ou no contexto).

═══════════════════════════════════════════════
REGRA SOBRE PLACEHOLDERS — OBRIGATÓRIA
═══════════════════════════════════════════════
Placeholders entre colchetes NÃO são problemas.
Exemplos: [AUTOR], [RÉU], [PROCESSO], [CPF], [NB], [DATA DO ÓBITO], [VALOR DA CAUSA].
Eles representam dados pendentes de OCR, envio de documento ou confirmação humana.
NÃO gere finding apenas porque existe um placeholder na peça.

Exceção: gere finding do tipo UNUSED_EXTRACTED_DATA ou FACTUAL_ENRICHMENT_OPPORTUNITY
SOMENTE quando o dado correspondente ao placeholder estiver disponível em
"DOCUMENTOS DISPONÍVEIS" ou "ENTIDADES EXTRAÍDAS" e não estiver sendo aproveitado.

═══════════════════════════════════════════════
CONTEXTO DA PEÇA
═══════════════════════════════════════════════
Classificação: ${classification}
${domain ? `Domínio: ${domain}` : ""}
${pieceType ? `Tipo: ${pieceType}` : ""}
Status da auditoria: ${audit.audit.status}

ERROS JÁ DETECTADOS PELA AUDITORIA DETERMINÍSTICA (não repita):
${fatalSummary || "Nenhum erro fatal detectado."}

PLANO DE CORREÇÃO EM ANDAMENTO:
${planSummary}

═══════════════════════════════════════════════
DOCUMENTOS DISPONÍVEIS (anexados pelo usuário)
═══════════════════════════════════════════════
${documentContext}

═══════════════════════════════════════════════
ENTIDADES EXTRAÍDAS (via OCR / pipeline)
═══════════════════════════════════════════════
${entityContext}
${domainContext}

═══════════════════════════════════════════════
MINUTA PARA ANÁLISE
═══════════════════════════════════════════════
---
${draft}
---

═══════════════════════════════════════════════
TIPOS DE OPORTUNIDADE DISPONÍVEIS
═══════════════════════════════════════════════
MISSING_DEMONSTRATION:
  Requisito legal afirmado sem demonstração fática suficiente.
  Sugira quadro, período, dado específico que tornaria a demonstração robusta.

MISSING_COMPARATIVE_TABLE:
  Situação em que quadro demonstrativo fortaleceria a tese
  (ex: CNIS com períodos, tabela de contribuições, dosimetria).

MISSING_CALCULATION:
  Pedido de valor sem memória de cálculo, planilha ou demonstrativo numérico.

MISSING_SUPPORTING_DOCUMENT:
  Documento útil à tese que poderia ser referenciado mas não está mencionado.
  Gere apenas quando o documento for naturalmente esperado para a tese apresentada.

MISSING_DATE_ANCHOR:
  Data relevante para a tese sem ancoragem ou referência documental.

MISSING_LEGAL_ANCHOR:
  Tese sem fundamento normativo explícito.
  Sugira incluir fundamento legal — sem inventar artigos não presentes no contexto.

UNUSED_EXTRACTED_DATA:
  Dado disponível em documento anexado que não está sendo aproveitado na peça.
  Use APENAS quando availableDocuments ou extractedEntities contiverem a informação.

FACTUAL_ENRICHMENT_OPPORTUNITY:
  Fato ou dado disponível que tornaria a narrativa mais persuasiva.
  Requer evidência textual + dado disponível no contexto.

STRENGTHEN_ARGUMENT:
  Conexão entre premissa e conclusão que pode ser explicitada ou reforçada
  com um passo intermediário ou maior desenvolvimento.

ANTICIPATE_COUNTERARGUMENT:
  Argumento contrário previsível que poderia ser antecipado e respondido
  construtivamente na própria peça, fortalecendo a tese.

WEAK_FACTUAL_FOUNDATION:
  Base fática que pode ser robustecida com mais detalhes do contexto disponível.

═══════════════════════════════════════════════
NÍVEIS DE OPORTUNIDADE
═══════════════════════════════════════════════
IMPACTFUL:     pode mudar significativamente a força da tese.
COMPLEMENTARY: aumenta a robustez, mas não é essencial.
OPTIONAL:      refinamento útil, mas não prioritário.

═══════════════════════════════════════════════
FORMATO DE SAÍDA — JSON ESTRITO
═══════════════════════════════════════════════
Retorne EXCLUSIVAMENTE um array JSON válido, sem markdown, sem texto fora do JSON.

[
  {
    "type": "TIPO_DA_OPORTUNIDADE",
    "opportunity": "IMPACTFUL|COMPLEMENTARY|OPTIONAL",
    "title": "Título positivo e objetivo da oportunidade",
    "rationale": "Por que este fortalecimento aumenta a robustez ou persuasão da peça.",
    "evidenceFromText": ["trecho literal da peça que motivou este finding"],
    "suggestion": "O que adicionar, reforçar ou melhor demonstrar. NÃO invente fatos, normas ou jurisprudência.",
    "availableSource": "Se baseado em documento disponível: qual campo/documento. Omitir se não aplicável.",
    "confidence": 0.0
  }
]

Se não houver oportunidades identificáveis com evidência textual clara, retorne: []`;
}

// ── Domain knowledge section ──────────────────────────────────────────────────

function bullets(items: string[]): string {
  return items.length ? items.map(i => `  - ${i}`).join("\n") : "  (não especificado)";
}

function buildDomainKnowledgeSection(pack: DomainKnowledgePack | undefined): string {
  if (!pack) return "";

  const sections: string[] = [
    `\n═══════════════════════════════════════════════`,
    `CONTEXTO ESPECIALIZADO: ${pack.label}`,
    `═══════════════════════════════════════════════`,
    `ATENÇÃO — REGRAS OBRIGATÓRIAS DE USO DO CONTEXTO ESPECIALIZADO:`,
    `1. Este contexto é MERAMENTE ORIENTATIVO. Indica temas comuns, documentos frequentes e`,
    `   oportunidades argumentativas típicas do ramo — não uma lista de problemas automáticos.`,
    `2. NÃO autoriza findings automáticos. Toda crítica deve estar fundamentada no texto`,
    `   concreto da peça analisada. Somente gere finding quando houver evidência textual clara.`,
    `3. NÃO presuma ausência de documento, cálculo, prova, tese ou requisito apenas porque`,
    `   o pack menciona que aquele item costuma ser relevante neste domínio.`,
    `   Só aponte problema quando a ausência ou inconsistência for verificável no texto.`,
    `4. NUNCA transporte exigências típicas de um domínio para outro sem pertinência concreta`,
    `   verificável no texto da peça.`,
    `5. Placeholders continuam NÃO sendo problemas mesmo com este contexto ativo.`,
  ];

  if (pack.reviewerGoals.length) {
    sections.push(`\nObjetivos típicos do advogado neste domínio:`);
    sections.push(bullets(pack.reviewerGoals));
  }

  if (pack.commonDocuments.length) {
    sections.push(`\nDocumentos comuns neste domínio (oriente MISSING_SUPPORTING_DOCUMENT):`);
    sections.push(bullets(pack.commonDocuments));
  }

  if (pack.commonDemonstrations.length) {
    sections.push(`\nDemonstrações esperadas neste domínio (oriente MISSING_DEMONSTRATION):`);
    sections.push(bullets(pack.commonDemonstrations));
  }

  if (pack.commonCalculations.length) {
    sections.push(`\nCálculos relevantes neste domínio (oriente MISSING_CALCULATION):`);
    sections.push(bullets(pack.commonCalculations));
  }

  if (pack.commonWeaknesses.length) {
    sections.push(`\nFragilidades comuns — foque sua análise nestas áreas:`);
    sections.push(bullets(pack.commonWeaknesses));
  }

  if (pack.commonCounterArguments.length) {
    sections.push(`\nArgumentos contrários previsíveis (oriente ANTICIPATE_COUNTERARGUMENT):`);
    sections.push(bullets(pack.commonCounterArguments));
  }

  if (pack.strengtheningOpportunities.length) {
    sections.push(`\nOportunidades típicas de fortalecimento neste domínio:`);
    sections.push(bullets(pack.strengtheningOpportunities));
  }

  if (pack.cautionaryNotes?.length) {
    sections.push(`\nALERTAS DE CAUTELA — situações que PARECEM problemas mas NÃO SÃO neste domínio:`);
    sections.push(bullets(pack.cautionaryNotes));
  }

  if (pack.placeholderGuidance) {
    sections.push(`\nPlaceholders típicos neste domínio (NÃO geram findings): ${pack.placeholderGuidance}`);
  }

  return sections.join("\n");
}

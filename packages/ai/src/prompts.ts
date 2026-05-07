import type { Jurisprudencia } from "./types.js";

export function buildSystemPrompt(): string {
  return `Você é um assistente jurídico especializado na redação de peças e atos processuais no âmbito do direito brasileiro.

REGRAS ABSOLUTAS — NUNCA VIOLE:
1. NUNCA cite número de processo que não esteja explicitamente no contexto fornecido.
2. NUNCA mencione tribunal, ministro, desembargador ou relator que não esteja no contexto fornecido.
3. NUNCA invente datas, ementas ou trechos de acórdãos.
4. Se o contexto não contiver jurisprudência suficiente para embasar a resposta, diga exatamente: "Não foram encontradas decisões suficientes no contexto para fundamentar este ponto."
5. Toda citação jurisprudencial deve indicar: tribunal, número do processo e data de julgamento — todos retirados do contexto.

Você pode e deve:
- Redigir minutas de despacho, decisão interlocutória e sentença com linguagem judicial precisa.
- Redigir petições iniciais e recursos com linguagem postulatória adequada.
- Analisar as decisões fornecidas e extrair os fundamentos relevantes ao caso.
- Estruturar a fundamentação com lógica dedutiva clara.
- Adaptar o texto ao estilo formal exigido por cada tipo de peça processual.`;
}

export function buildRagContext(jurisprudencias: Jurisprudencia[]): string {
  if (jurisprudencias.length === 0) {
    return "Nenhuma jurisprudência foi recuperada para este caso.";
  }

  const items = jurisprudencias.map((j, i) => `
[${i + 1}] ${j.tribunal} — Processo nº ${j.numero}
Relator: ${j.relator}
Data de julgamento: ${j.dataJulgamento}
Ementa: ${j.ementa}
Link: ${j.url}
`);

  return `JURISPRUDÊNCIA RECUPERADA (use APENAS estas decisões):
${items.join("\n---")}`;
}

export function buildDocumentPrompt(
  type: "DESPACHO" | "DECISAO" | "SENTENCA" | "PETICAO_INICIAL" | "RECURSO",
  caseDescription: string,
  jurisprudencias: Jurisprudencia[],
  instruction?: string,
): string {
  const typeLabel: Record<string, string> = {
    DESPACHO:        "despacho",
    DECISAO:         "decisão interlocutória",
    SENTENCA:        "sentença",
    PETICAO_INICIAL: "petição inicial",
    RECURSO:         "recurso",
  };

  const instructionBlock = instruction?.trim()
    ? `\n---\nORIENTAÇÃO ADICIONAL:\n${instruction.trim()}\nUse esta orientação como norte para a peça. Fundamente exclusivamente nas decisões acima — não invente precedentes, leis ou fatos não fornecidos.\n`
    : "";

  const tarefaByType: Record<string, string> = {
    DESPACHO:
      "Redija uma minuta de despacho baseada exclusivamente nas decisões acima.\nEstruture o documento com: relatório sumário, fundamentação e dispositivo.",
    DECISAO:
      "Redija uma minuta de decisão interlocutória baseada exclusivamente nas decisões acima.\nEstruture o documento com: relatório, fundamentação jurídica (citando apenas as decisões do contexto) e dispositivo.",
    SENTENCA:
      "Redija uma minuta de sentença completa e fundamentada.\nEstruture o documento com: relatório, fundamentação jurídica (citando apenas as decisões do contexto) e dispositivo.",
    PETICAO_INICIAL: `Redija uma PETIÇÃO INICIAL completa, extensa e tecnicamente fundamentada em favor da parte autora.

ESTRUTURA OBRIGATÓRIA — siga exatamente esta ordem, sem repetir conteúdo entre seções:

EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) [endereçamento conforme competência]

I — DA QUALIFICAÇÃO DAS PARTES
  Qualifique completamente autor e réu com todos os dados disponíveis.

II — DOS FATOS
  Narre os fatos de forma cronológica, detalhada e objetiva. Mencione datas, valores e todos os elementos relevantes.

III — DO DIREITO
  Fundamente EXCLUSIVAMENTE o mérito da pretensão principal: por que o direito existe e por que a parte autora tem razão no mérito.
  NÃO trate aqui de tutela de urgência nem de gratuidade — essas têm seções próprias abaixo.
  Desenvolva subseções numeradas (3.1, 3.2...) para cada argumento jurídico.
  Cite os dispositivos legais aplicáveis e as decisões jurisprudenciais fornecidas para reforçar cada argumento.
  Esta é a seção mais importante — seja extenso e tecnicamente preciso.

IV — DA TUTELA DE URGÊNCIA (omita esta seção se não houver urgência no caso)
  Demonstre fumus boni iuris e periculum in mora com fatos concretos do caso.
  Fundamente no art. 300 do CPC/2015. NÃO repita argumentos já desenvolvidos na seção III.

V — DA GRATUIDADE DA JUSTIÇA (omita se não houver indícios de hipossuficiência)
  Fundamente no art. 98 do CPC/2015 e art. 5º, LXXIV da CF/88.
  Indique os elementos do caso que demonstram a condição econômica da parte. NÃO repita texto de outras seções.

VI — DOS PEDIDOS
  Liste todos os pedidos numerados, cada um com seu fundamento legal direto.
  Inclua: citação do réu, tutela (se cabível), gratuidade (se cabível), mérito principal, condenações acessórias.

VII — DO VALOR DA CAUSA
  Calcule e justifique o valor com base nos pedidos formulados (art. 292 CPC/2015).

ATENÇÃO: produza apenas o texto da peça. Não inclua notas, ressalvas, disclaimers ou comentários sobre ausência de dados no corpo da peça.`,

    RECURSO: `Redija um RECURSO completo, extenso e tecnicamente fundamentado em favor da parte recorrente.

ESTRUTURA OBRIGATÓRIA — não repita conteúdo entre seções:

I — DA TEMPESTIVIDADE
  Comprove que o recurso é tempestivo com base nas datas relevantes.

II — DO CABIMENTO E PREPARO
  Demonstre que o recurso é cabível e que o preparo foi realizado (ou mencione isenção, se aplicável).

III — DOS FATOS E DA DECISÃO RECORRIDA
  Resuma os fatos e transcreva ou descreva com precisão os pontos da decisão recorrida que são impugnados.

IV — DAS RAZÕES RECURSAIS
  Para cada ponto impugnado, abra um subitem numerado (4.1, 4.2...) contendo:
    - O erro específico da decisão
    - O fundamento legal correto
    - A jurisprudência de suporte (cite as decisões fornecidas)
  Esta é a seção mais importante — seja extenso, técnico e preciso.

V — DO PEDIDO
  Requeira o conhecimento e o provimento do recurso, com a reforma ou anulação da decisão nos pontos impugnados.

ATENÇÃO: produza apenas o texto da peça. Não inclua notas, ressalvas ou disclaimers no corpo da peça.`,
  };

  return `${buildRagContext(jurisprudencias)}
${instructionBlock}
---
CASO EM ANÁLISE:
${caseDescription}

---
REGRAS:
1. Cite APENAS jurisprudência explicitamente listada acima.
2. Nunca invente datas, ementas, processos ou fatos não fornecidos.
3. Você PODE citar legislação com base no seu conhecimento jurídico — dispositivos legais são necessários para a completude da peça.
4. Não inclua no texto final notas, ressalvas ou comentários meta sobre o que não foi fornecido.

TAREFA:
${tarefaByType[type]}`;
}

export function buildPremiumDocumentPrompt(
  type: "DESPACHO" | "DECISAO" | "SENTENCA" | "PETICAO_INICIAL" | "RECURSO",
  documents: string[],
  jurisprudencias: Jurisprudencia[],
  legislation: Record<string, string>,
  caseDescription?: string,
  instruction?: string,
): string {
  const typeLabel: Record<string, string> = {
    DESPACHO:        "despacho",
    DECISAO:         "decisão interlocutória",
    SENTENCA:        "sentença",
    PETICAO_INICIAL: "petição inicial",
    RECURSO:         "recurso",
  };

  const docsBlock = documents.length > 0
    ? `DOCUMENTOS DO PROCESSO (leia com atenção — estes são os documentos reais do caso):\n\n${documents.join("\n\n---\n\n")}`
    : "";

  const legBlock = Object.keys(legislation).length > 0
    ? `LEGISLAÇÃO VERIFICADA NA FONTE OFICIAL (Planalto):\n${
        Object.entries(legislation)
          .map(([lei, texto]) => `\n=== ${lei} ===\n${texto}`)
          .join("\n\n")
      }`
    : "";

  const jurBlock = buildRagContext(jurisprudencias);

  const instructionBlock = instruction?.trim()
    ? `\nORIENTAÇÃO ADICIONAL:\n${instruction.trim()}\n`
    : "";

  const caseBlock = caseDescription?.trim()
    ? `\nCONTEXTO ADICIONAL DO CASO:\n${caseDescription.trim()}\n`
    : "";

  const isPostulatorio = type === "PETICAO_INICIAL" || type === "RECURSO";

  const regraLegislacao = isPostulatorio
    ? `2. LEGISLAÇÃO: prefira sempre citar as leis que estão no bloco "LEGISLAÇÃO VERIFICADA" acima (texto conferido no Planalto). Para dispositivos não presentes nesse bloco, você PODE citá-los com base no seu conhecimento jurídico — eles são necessários para a completude da peça — mas sinalize com *(verificar redação atualizada)* apenas se tiver dúvida sobre a redação exata. Nunca invente números de artigos.`
    : `2. Cite APENAS legislação que esteja no bloco "LEGISLAÇÃO VERIFICADA" acima. Se uma lei não estiver nesse bloco, NÃO a cite.`;

  const tarefaByType: Record<string, string> = {
    DESPACHO:
      "Redija um despacho com base nos documentos do processo e na jurisprudência fornecida.\nEstrutura: identificação do processo, decisão fundamentada e dispositivo.",
    DECISAO:
      "Redija uma decisão interlocutória fundamentada.\nAnalise os argumentos das partes nos documentos, confronte com a jurisprudência e decida motivadamente.\nEstrutura: relatório, fundamentação jurídica e dispositivo.",
    SENTENCA:
      "Redija uma sentença completa e fundamentada.\nAnalise a petição inicial, a contestação e demais documentos. Confronte os argumentos com a jurisprudência e a legislação fornecida.\nEstrutura: relatório, fundamentação jurídica (com citação de jurisprudência e legislação do contexto) e dispositivo.",
    PETICAO_INICIAL: `Redija uma PETIÇÃO INICIAL completa, extensa e tecnicamente fundamentada em favor da parte autora.
Extraia dos documentos todos os dados das partes (nome, estado civil, CPF, RG, endereço) para a qualificação.
Analise o processo administrativo ou documentos anexos para reconstituir os fatos com precisão e detalhe.

ESTRUTURA OBRIGATÓRIA — siga exatamente esta ordem, sem repetir conteúdo entre seções:

EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) [endereçamento correto conforme competência]

I — DA QUALIFICAÇÃO DAS PARTES
  Qualifique completamente autor e réu com todos os dados extraídos dos documentos.

II — DOS FATOS
  Narre os fatos de forma cronológica, detalhada e objetiva com base nos documentos do processo.
  Mencione datas, valores, protocolos e todos os elementos relevantes extraídos dos documentos.

III — DO DIREITO
  Fundamente EXCLUSIVAMENTE o mérito da pretensão principal: por que o direito existe e por que a parte autora tem razão.
  NÃO trate aqui de tutela de urgência nem de gratuidade — essas têm seções próprias abaixo.
  Desenvolva subseções numeradas (3.1, 3.2...) para cada argumento jurídico.
  Cite dispositivos legais (Constituição Federal, legislação específica verificada no Planalto) e as decisões jurisprudenciais fornecidas.
  Esta é a seção mais importante — seja extenso e tecnicamente preciso.

IV — DA TUTELA DE URGÊNCIA (omita se não houver urgência no caso)
  Demonstre fumus boni iuris e periculum in mora com fatos concretos extraídos dos documentos.
  Fundamente no art. 300 do CPC/2015. NÃO repita argumentos já desenvolvidos na seção III.

V — DA GRATUIDADE DA JUSTIÇA (omita se não houver indícios de hipossuficiência nos documentos)
  Fundamente no art. 98 do CPC/2015 e art. 5º, LXXIV da CF/88.
  Indique os elementos dos documentos que comprovam a condição econômica da parte. NÃO repita texto de outras seções.

VI — DOS PEDIDOS
  Liste todos os pedidos numerados, cada um com seu fundamento legal direto.
  Inclua: citação do réu, tutela (se cabível), gratuidade (se cabível), mérito principal, condenações acessórias.

VII — DO VALOR DA CAUSA
  Calcule e justifique o valor com base nos pedidos formulados (art. 292 CPC/2015).

ATENÇÃO: produza apenas o texto da peça. Não inclua notas, ressalvas, disclaimers ou comentários sobre ausência de dados.`,

    RECURSO: `Redija um RECURSO completo, extenso e tecnicamente fundamentado em favor da parte recorrente.
Analise detalhadamente a decisão recorrida nos documentos e construa as razões recursais ponto a ponto.

ESTRUTURA OBRIGATÓRIA — não repita conteúdo entre seções:

I — DA TEMPESTIVIDADE
  Comprove que o recurso é tempestivo com base nas datas dos documentos.

II — DO CABIMENTO E PREPARO
  Demonstre que o recurso é cabível e informe sobre o preparo.

III — DOS FATOS E DA DECISÃO RECORRIDA
  Resuma os fatos com base nos documentos e descreva com precisão os pontos impugnados da decisão.

IV — DAS RAZÕES RECURSAIS
  Para cada ponto impugnado, abra um subitem numerado (4.1, 4.2...) contendo:
    - O erro específico da decisão
    - O fundamento legal correto (com base na legislação verificada)
    - A jurisprudência de suporte (cite as decisões fornecidas)
  Esta é a seção mais importante — seja extenso, técnico e preciso.

V — DO PEDIDO
  Requeira o conhecimento e o provimento do recurso com reforma ou anulação da decisão.

ATENÇÃO: produza apenas o texto da peça. Não inclua notas, ressalvas ou disclaimers.`,
  };

  return `${docsBlock}

---

${jurBlock}

---

${legBlock}

---
${caseBlock}${instructionBlock}
---

REGRAS ABSOLUTAS:
1. Cite APENAS jurisprudência que esteja explicitamente listada acima.
${regraLegislacao}
3. Nunca invente processos, nomes, CPF, datas ou fatos não presentes nos documentos.
4. A peça deve ser EXTENSA e COMPLETA — desenvolva cada seção com profundidade técnica. Não resuma onde cabe fundamentar.

TAREFA:
${tarefaByType[type]}`;
}

export function buildAnalysisPrompt(
  caseDescription: string,
  jurisprudencias: Jurisprudencia[]
): string {
  return `${buildRagContext(jurisprudencias)}

---
CASO EM ANÁLISE:
${caseDescription}

---
TAREFA:
1. Identifique quais das decisões acima são mais relevantes para o caso.
2. Extraia os fundamentos jurídicos aplicáveis.
3. Indique a tendência jurisprudencial (favorável, desfavorável ou divergente).
4. Aponte pontos de atenção ou distinções relevantes entre os precedentes e o caso concreto.`;
}

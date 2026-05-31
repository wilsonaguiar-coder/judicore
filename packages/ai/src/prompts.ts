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
- Adaptar o texto ao estilo formal exigido por cada tipo de peça processual.

REGRA DE JURISDIÇÃO — aplique sempre antes de redigir o endereçamento:
A competência é da JUSTIÇA FEDERAL (art. 109, I da CF) quando o réu for: União, autarquia federal (INSS, ANATEL, IBAMA, CADE, ANVISA, Receita Federal, etc.), empresa pública federal (CEF, ECT, BNDES, etc.), fundação pública federal, ou quando envolver matéria de competência federal (crimes federais, disputas tributárias federais, etc.).
Nesses casos use: "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) FEDERAL DA ___ VARA FEDERAL DA SUBSEÇÃO JUDICIÁRIA DE [CIDADE]".
Em todos os demais casos a competência é da JUSTIÇA ESTADUAL: use "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA [ESPECIALIDADE] DA COMARCA DE [CIDADE]".

REGRA DE CITAÇÃO LEGAL — nunca confunda os códigos:
- Arts. 186, 421, 422, 927, 944 etc. são do CÓDIGO CIVIL (CC/2002), não do CPC.
- Arts. 300, 303, 319, 330, 485, 487, 537 etc. são do CPC/2015.
- Sempre cite o diploma correto: "art. X do CC/2002" ou "art. X do CPC/2015".`;
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

  return `JURISPRUDÊNCIA RECUPERADA (use APENAS estas decisões para fundamentar):
${items.join("\n")}`;
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
    ? `\n---\nORIENTAÇÃO ADICIONAL:\n${instruction.trim()}\nUse esta orientação como norte para a peça. Fundamente as decisões jurisprudenciais exclusivamente nas fornecidas acima.\n`
    : "";

  const tarefaByType: Record<string, string> = {
    DESPACHO:
      "Redija uma minuta de despacho com linguagem formal e precisa.\nEstruture o documento com: relatório sumário, fundamentação e dispositivo.",
    DECISAO:
      "Redija uma minuta de decisão interlocutória.\nEstruture o documento com: relatório, fundamentação jurídica persuasiva (citando as decisões do contexto) e dispositivo.",
    SENTENCA:
      "Redija uma minuta de sentença completa, densa e exaustivamente fundamentada.\nEstruture o documento com: relatório, fundamentação jurídica e dispositivo.",
    PETICAO_INICIAL: `Redija uma PETIÇÃO INICIAL completa, extremamente detalhada e tecnicamente sofisticada em favor da parte autora. Adote o tom persuasivo, argumentativo e robusto próprio das maiores e mais prestigiadas bancas de advocacia do país.

ESTRUTURA OBRIGATÓRIA — siga exatamente esta ordem, desenvolvendo cada item com profundidade:

EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) [endereçamento conforme competência]

I — DA QUALIFICAÇÃO DAS PARTES
  Qualifique completamente autor e réu com todos os dados disponíveis.

II — DOS FATOS
  Narre os fatos de forma cronológica, detalhada e persuasiva. Destaque o impacto e a gravidade das ações da parte contrária.

III — DO DIREITO
  Construa uma argumentação jurídica exaustiva, lógica e irrefutável para o mérito da pretensão principal.
  NÃO trate aqui de tutela de urgência nem de gratuidade.
  Desenvolva subseções (ex: 3.1, 3.2...) para cada tese jurídica.
  Para cada argumento jurídico, escreva NO MÍNIMO 3 a 4 parágrafos robustos. Conecte a Teoria Geral do Direito, os Princípios Constitucionais, a Doutrina clássica (que você pode trazer do seu conhecimento interno) e a Legislação aplicável ao caso concreto.
  Corrobore a tese EXCLUSIVAMENTE com as decisões jurisprudenciais fornecidas no contexto.

IV — DA TUTELA DE URGÊNCIA (omita esta seção se não houver urgência no caso)
  Demonstre de forma contundente o fumus boni iuris e o periculum in mora.
  Fundamente no art. 300 do CPC/2015.

V — DA GRATUIDADE DA JUSTIÇA (omita se não houver indícios de hipossuficiência)
  Fundamente no art. 98 do CPC/2015 e art. 5º, LXXIV da CF/88.

VI — DOS PEDIDOS
  Liste todos os pedidos numerados, cada um com seu fundamento legal direto.

VII — DO VALOR DA CAUSA
  Calcule e justifique o valor com base nos pedidos formulados (art. 292 CPC/2015).

ATENÇÃO: produza apenas o texto final da peça jurídica. Não inclua notas, ressalvas, avisos de IA, disclaimers ou comentários sobre ausência de dados no corpo da peça.`,

    RECURSO: `Redija um RECURSO completo, extremamente detalhado e tecnicamente sofisticado em favor da parte recorrente. Adote o tom persuasivo e combativo próprio das grandes bancas de advocacia.

ESTRUTURA OBRIGATÓRIA:

I — DA TEMPESTIVIDADE
  Comprove que o recurso é tempestivo com base nas datas relevantes.

II — DO CABIMENTO E PREPARO
  Demonstre que o recurso é cabível e que o preparo foi realizado (ou isenção).

III — DOS FATOS E DA DECISÃO RECORRIDA
  Resuma os fatos e descreva com precisão os pontos da decisão que causaram prejuízo e devem ser reformados.

IV — DAS RAZÕES RECURSAIS
  Para cada ponto impugnado, abra um subitem contendo:
    - O erro in judicando ou in procedendo específico da decisão.
    - O fundamento doutrinário e principiológico correto (use seu conhecimento jurídico).
    - A legislação aplicável.
    - A jurisprudência de suporte (cite APENAS as decisões fornecidas).
  Esta é a seção principal. Seja prolixo, exaustivo e construa parágrafos densos que destruam os fundamentos da decisão recorrida.

V — DO PEDIDO
  Requeira o conhecimento e o provimento do recurso, com a reforma ou anulação da decisão.

ATENÇÃO: produza apenas o texto da peça. Não inclua notas, ressalvas ou disclaimers no corpo da peça.`,
  };

  return `${buildRagContext(jurisprudencias)}
${instructionBlock}
---
CASO EM ANÁLISE:
${caseDescription}

---
REGRAS FUNDAMENTAIS PARA A REDAÇÃO:
1. JURISPRUDÊNCIA: Cite APENAS a jurisprudência explicitamente listada no contexto acima. Não invente decisões.
2. DOUTRINA E LEGISLAÇÃO: Você TEM PERMISSÃO e DEVE utilizar seu conhecimento jurídico interno para citar legislação (Constituição, Códigos, Leis Especiais), Princípios Gerais do Direito e doutrina pacificada para enriquecer e dar profundidade à argumentação.
3. ESTILO: Seja denso, longo, argumentativo e altamente persuasivo. A peça deve parecer ter sido escrita por um advogado sênior de um escritório de elite.
4. Nunca invente dados pessoais, CPFs ou datas que não estejam no caso.

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
      "Redija uma minuta de despacho com linguagem formal e precisa.\nEstruture o documento com: relatório sumário, fundamentação e dispositivo.",
    DECISAO:
      "Redija uma minuta de decisão interlocutória completa e fundamentada.\nEstruture o documento com: relatório, fundamentação jurídica (citando as decisões do contexto e a legislação verificada) e dispositivo.",
    SENTENCA:
      "Redija uma minuta de sentença completa, densa e exaustivamente fundamentada.\nEstruture o documento com: relatório, fundamentação jurídica e dispositivo.",
    PETICAO_INICIAL: `Redija uma PETIÇÃO INICIAL completa, extremamente detalhada e tecnicamente sofisticada em favor da parte autora, com base nos documentos do processo fornecidos acima. Adote o tom persuasivo, argumentativo e robusto próprio das maiores bancas de advocacia do país.

ESTRUTURA OBRIGATÓRIA:

EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) [endereçamento conforme competência]

I — DA QUALIFICAÇÃO DAS PARTES
II — DOS FATOS (baseie-se nos documentos fornecidos)
III — DO DIREITO (argumentação jurídica exaustiva; subseções 3.1, 3.2...)
IV — DA TUTELA DE URGÊNCIA (somente se aplicável ao caso)
V — DA GRATUIDADE DA JUSTIÇA (somente se aplicável ao caso)
VI — DOS PEDIDOS (numerados com fundamento legal)
VII — DO VALOR DA CAUSA

ATENÇÃO: produza apenas o texto final da peça. Não inclua notas, ressalvas ou disclaimers.`,

    RECURSO: `Redija um RECURSO completo, detalhado e tecnicamente sofisticado, com base nos documentos do processo fornecidos.

ESTRUTURA OBRIGATÓRIA:

I — DA TEMPESTIVIDADE
II — DO CABIMENTO E PREPARO
III — DOS FATOS E DA DECISÃO RECORRIDA
IV — DAS RAZÕES RECURSAIS (subitem por ponto impugnado, com doutrina, legislação e jurisprudência do contexto)
V — DO PEDIDO (conhecimento e provimento com reforma ou anulação)

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

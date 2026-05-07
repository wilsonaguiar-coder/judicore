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
      "Redija uma minuta de sentença baseada exclusivamente nas decisões acima.\nEstruture o documento com: relatório, fundamentação jurídica (citando apenas as decisões do contexto) e dispositivo.",
    PETICAO_INICIAL:
      "Redija uma petição inicial em nome da parte autora, baseada nas decisões jurisprudenciais acima como fundamento.\nEstruture o documento com: endereçamento, qualificação das partes, dos fatos, do direito (citando apenas as decisões do contexto), dos pedidos e do valor da causa.",
    RECURSO:
      "Redija um recurso em nome da parte recorrente, baseado nas decisões jurisprudenciais acima como fundamento.\nEstruture o documento com: endereçamento, tempestividade, cabimento, razões recursais (citando apenas as decisões do contexto) e pedido de provimento.",
  };

  return `${buildRagContext(jurisprudencias)}
${instructionBlock}
---
CASO EM ANÁLISE:
${caseDescription}

---
TAREFA:
${tarefaByType[type]}
Indique no rodapé quais decisões foram utilizadas como fundamento.`;
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

  const tarefaByType: Record<string, string> = {
    DESPACHO:
      "Redija um despacho com base nos documentos do processo e na jurisprudência fornecida.\nEstrutura: identificação do processo, decisão fundamentada e dispositivo.",
    DECISAO:
      "Redija uma decisão interlocutória fundamentada.\nAnalise os argumentos das partes nos documentos, confronte com a jurisprudência e decida motivadamente.\nEstrutura: relatório, fundamentação jurídica e dispositivo.",
    SENTENCA:
      "Redija uma sentença completa e fundamentada.\nAnalise a petição inicial, a contestação e demais documentos. Confronte os argumentos com a jurisprudência e a legislação fornecida.\nEstrutura: relatório, fundamentação jurídica (com citação de jurisprudência e legislação do contexto) e dispositivo.",
    PETICAO_INICIAL:
      "Redija uma petição inicial em favor da parte autora.\nBaseie-se nos fatos descritos nos documentos, fundamente juridicamente com a legislação e jurisprudência fornecidas.\nEstrutura: endereçamento, qualificação das partes, fatos, direito, pedidos e valor da causa.",
    RECURSO:
      "Redija um recurso em favor da parte recorrente.\nAnalise os argumentos da decisão recorrida e confronte-os com a jurisprudência e legislação fornecidas.\nEstrutura: endereçamento, tempestividade, cabimento, razões recursais e pedido de provimento.",
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
2. Cite APENAS legislação que esteja no bloco "LEGISLAÇÃO VERIFICADA" acima. Se uma lei não estiver nesse bloco, NÃO a cite — nem de memória, nem de treinamento.
3. Se a legislação relevante não estiver disponível, fundamente exclusivamente na jurisprudência fornecida e indique: "[base legal não disponível no contexto — verificar legislação aplicável]".
4. Nunca invente processos, nomes, datas ou fatos não presentes nos documentos.

TAREFA:
${tarefaByType[type]}
Indique no rodapé quais decisões e dispositivos legais foram utilizados.`;
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

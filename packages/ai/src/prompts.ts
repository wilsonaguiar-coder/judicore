import type { Jurisprudencia } from "./types.js";

export function buildSystemPrompt(): string {
  return `Você é um assistente jurídico especializado em apoio à decisão judicial no âmbito da Justiça Federal brasileira.

REGRAS ABSOLUTAS — NUNCA VIOLE:
1. NUNCA cite número de processo que não esteja explicitamente no contexto fornecido.
2. NUNCA mencione tribunal, ministro, desembargador ou relator que não esteja no contexto fornecido.
3. NUNCA invente datas, ementas ou trechos de acórdãos.
4. Se o contexto não contiver jurisprudência suficiente para embasar a resposta, diga exatamente: "Não foram encontradas decisões suficientes no contexto para fundamentar este ponto."
5. Toda citação jurisprudencial deve indicar: tribunal, número do processo e data de julgamento — todos retirados do contexto.

Você pode e deve:
- Analisar as decisões fornecidas e extrair os fundamentos relevantes ao caso.
- Redigir minutas de despacho, decisão e sentença com linguagem jurídica precisa.
- Estruturar a fundamentação com lógica dedutiva clara.
- Adaptar o texto ao estilo formal dos atos judiciais brasileiros.`;
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
  type: "DESPACHO" | "DECISAO" | "SENTENCA",
  caseDescription: string,
  jurisprudencias: Jurisprudencia[]
): string {
  const typeLabel: Record<string, string> = {
    DESPACHO: "despacho",
    DECISAO: "decisão interlocutória",
    SENTENCA: "sentença",
  };

  return `${buildRagContext(jurisprudencias)}

---
CASO EM ANÁLISE:
${caseDescription}

---
TAREFA:
Redija uma minuta de ${typeLabel[type] ?? type} baseada exclusivamente nas decisões acima.
Estruture o documento com: relatório, fundamentação jurídica (citando apenas as decisões do contexto) e dispositivo.
Indique no rodapé quais decisões foram utilizadas como fundamento.`;
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

import type { TipoPeca, JurisprudenciaInput } from "../pipeline/types.js";

export function buildClassificationPrompt(
  caseDescription: string,
  documentTypeHint: TipoPeca,
  jurisprudencias: JurisprudenciaInput[],
): string {
  const jurCtx = jurisprudencias.length > 0
    ? `\nJurisprudências fornecidas (use apenas os tribunais para inferir jurisdição):\n${jurisprudencias.slice(0, 3).map((j) => `- ${j.tribunal}: ${j.tema}`).join("\n")}`
    : "";

  return `Analise o caso jurídico abaixo e retorne um JSON de classificação. O tipo de peça solicitado pelo usuário é "${documentTypeHint}".

CASO:
${caseDescription}
${jurCtx}

Retorne SOMENTE um JSON válido com esta estrutura exata:
{
  "tipo_justica": "TRABALHO" | "FEDERAL" | "ESTADUAL" | "JEF" | "JEC" | "CRIMINAL" | "EXECUCAO_FISCAL" | "INDETERMINADA",
  "tipo_peca": "${documentTypeHint}",
  "regime_juridico": "CLT" | "RPPS" | "RGPS" | "ESTATUTARIO" | "CIVIL" | "CRIMINAL" | "TRIBUTARIO" | "INDETERMINADO" | null,
  "grau": "PRIMEIRO" | "SEGUNDO" | "SUPERIOR",
  "tribunal_competente": "nome do tribunal (ex: TRT-15, TRF-3, TJSP) ou [A DETERMINAR]",
  "rito": "ORDINARIO" | "SUMARIO" | "SUMARIISSIMO" | "JEF" | "COMUM" | null,
  "assunto_principal": "descrição em 1 frase do objeto central do caso",
  "partes": {
    "autor": "nome/qualificação do autor ou [NÃO IDENTIFICADO]",
    "reu": "nome/qualificação do réu ou [NÃO IDENTIFICADO]"
  },
  "confianca": 0.0 a 1.0
}

REGRAS DE CLASSIFICAÇÃO:
- Se o caso envolver empregado CLT, empresa privada, FGTS, rescisão, horas extras → TRABALHO + CLT
- Se envolver servidor público federal, INSS, benefício previdenciário RGPS → FEDERAL
- Se envolver servidor público estadual/municipal com regime próprio → ESTADUAL ou FEDERAL + RPPS
- Se envolver aposentadoria de servidor público → RPPS (art. 40 CF) e NÃO RGPS (art. 201 CF)
- Se envolver benefício do INSS (auxílio-doença, aposentadoria por invalidez, auxílio-acidente) → RGPS
- Se envolver matéria previdenciária federal (INSS/RGPS) processada no Juizado Especial Federal → JEF + RGPS
- Se envolver causa cível de até 40 salários mínimos no Juizado Especial Cível estadual → JEC + CIVIL
- Se envolver prisão em flagrante, habeas corpus, crime, delito, CPP, processo penal, denúncia, inquérito policial, réu acusado de crime, preso provisório → CRIMINAL + regime null; tipo_justica: ESTADUAL (ou FEDERAL se crime federal)
- Se envolver execução fiscal (CDA, Certidão de Dívida Ativa, Lei 6.830/80, cobrança de tributo) → EXECUCAO_FISCAL + TRIBUTARIO
- grau PRIMEIRO para ações originárias, SEGUNDO para recursos, SUPERIOR para REsp/RR
- Quando confiança < 0.75 por ambiguidade genuína, jurisdição mista ou caso incompreensível → tipo_justica: "INDETERMINADA"
- regime_juridico "INDETERMINADO" quando não for possível identificar com segurança
- confianca: 0.9+ se o caso é claro e completo; 0.5-0.8 se há ambiguidade; < 0.5 se o caso é vago demais

Retorne SOMENTE o JSON, sem texto adicional.`;
}

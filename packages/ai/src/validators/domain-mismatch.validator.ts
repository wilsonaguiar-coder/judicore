import type { LegalClassification } from "../pipeline/types.js";

export class DomainMismatchValidator {
  /**
   * Constrói as regras para evitar confusão entre regimes jurídicos.
   * Aplica as "Regras por Domínio" (RPPS, RGPS, Trabalhista, etc.).
   */
  static buildPromptRules(classification: LegalClassification): string {
    const regime = classification.regime_juridico;
    const assunto = classification.assunto_principal?.toLowerCase() ?? "";
    const justica = classification.tipo_justica;

    let regrasDominio = "Avaliar de acordo com os princípios do Cível Geral. Evitar fundamentos consumeristas se não houver relação de consumo.";

    if (regime === "RPPS" || assunto.includes("rpps")) {
      regrasDominio = `- Verificar EC 41/2003, EC 47/2005, Tema 396/STF, art. 40 CF.
- Evitar confusão com RGPS/INSS.
- Verificar se EC 70/2012 só aparece quando houver invalidez.
- Verificar se regime militar, estadual ou federal está sendo misturado indevidamente.`;
    } else if (regime === "RGPS" || assunto.includes("rgps") || assunto.includes("inss")) {
      regrasDominio = `- Verificar Lei 8.213/91, carência, qualidade de segurado, DII/DID.
- Verificar aplicabilidade Tema 995/STJ e Tema 709/STF.
- Evitar confusão entre auxílio por incapacidade, aposentadoria por incapacidade e BPC.`;
    } else if (regime === "TRIBUTARIO" || justica === "EXECUCAO_FISCAL" || assunto.includes("tributário")) {
      regrasDominio = `- Verificar CTN, decadência/prescrição, lançamento, CDA, execução fiscal.
- Evitar confusão entre prescrição intercorrente e prescrição originária.`;
    } else if (justica === "JEC" || assunto.includes("consumidor") || assunto.includes("cdc")) {
      regrasDominio = `- Verificar CDC, responsabilidade objetiva, inversão do ônus, vício/fato do produto.
- Evitar dano moral automático sem relação direta com os fatos.`;
    } else if (assunto.includes("família") || assunto.includes("divórcio") || assunto.includes("alimentos") || assunto.includes("guarda")) {
      regrasDominio = `- Verificar CC, CPC, ECA, melhor interesse da criança, guarda, alimentos, convivência.
- Evitar tese patrimonial deslocada em caso puramente existencial.`;
    } else if (regime === "CLT" || justica === "TRABALHO" || assunto.includes("trabalhista")) {
      regrasDominio = `- Verificar CLT e normas constitucionais (vínculo, verbas rescisórias, jornada).
- Evitar confusão com regime estatutário (RPPS).`;
    } else if (regime === "CRIMINAL" || justica === "CRIMINAL" || assunto.includes("crime") || assunto.includes("penal")) {
      regrasDominio = `- Verificar tipo penal, materialidade, autoria, dosimetria.
- Evitar analogia in malam partem.`;
    }

    return `
### REGRAS DO DOMAIN MISMATCH VALIDATOR
1. O domínio detectado é: ${regime ?? "Geral"} / ${justica}.
2. As seguintes regras e verificações são OBRIGATÓRIAS para este domínio:
${regrasDominio}
3. Aponte como erro grave (em \`thesisIssues\`) se houver confusão entre regimes incompatíveis (ex: RPPS e RGPS, Trabalhista e Estatutário) ou citação de diploma estranho ao caso.
`;
  }
}

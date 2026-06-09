import type { ArgumentationMatrix } from "../pipeline/types.js";

export class LegalCitationValidator {
  /**
   * Constrói as regras de prompt para validação de citações legais e jurisprudenciais.
   * Utiliza a LegalMatrix para indicar ao LLM o que é estritamente autorizado.
   */
  static buildPromptRules(matrix: ArgumentationMatrix): string {
    const permitidas = matrix.teses.flatMap(t => [t.norma, t.jurisprudencia_id]).filter(Boolean);
    const contextStr = permitidas.length > 0 
      ? `As seguintes normas e IDs de jurisprudência foram validados e autorizados na matriz: ${permitidas.join(", ")}` 
      : "Nenhuma norma ou jurisprudência específica foi mapeada na matriz.";

    return `
### REGRAS DO LEGAL CITATION VALIDATOR
1. Compare todas as leis, artigos e jurisprudências citadas no texto com a LegalMatrix.
2. ${contextStr}
3. Se a peça citar jurisprudência, Tema, Súmula ou Dispositivo que NÃO está na matriz, você DEVE apontar no campo \`legalCitationIssues\` com a gravidade "ALERTA CRÍTICO — CITAÇÃO FORA DA MATRIZ" e sugerir a remoção ou revisão.
4. Verifique se o precedente citado foi aplicado fora de sua ratio decidendi ou se o dispositivo legal está desatualizado (ex: regras de juros antigas).
`;
  }
}

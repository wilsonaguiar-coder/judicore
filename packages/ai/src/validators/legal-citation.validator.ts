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
### REGRAS DO LEGAL CITATION VALIDATOR (PRIORIDADE 1: COERÊNCIA MATERIAL - 50%)
1. Compare todas as leis, artigos e jurisprudências citadas no texto com a LegalMatrix.
2. ${contextStr}
3. REGRAS PARA CITAÇÕES FORA DA MATRIZ:
   - Se for legislação/jurisprudência MATERIAL fora da matriz, classifique como "CITAÇÃO EXTERNA MATERIAL". Verifique:
     - Se NÃO EXISTE (alucinação): Registre em \`mandatoryChanges\` (ou reprove se for central).
     - Se existe, mas é inadequada/mal aplicada: Registre em \`mandatoryChanges\`.
     - Se existe e está correta: Não penalize, apenas valide.
4. EXCEÇÃO DO CPC (INFRAESTRUTURA PROCESSUAL):
   - Artigos estruturais do CPC (ex: art. 319, 321, 334, 373, 85, 98, 99, 292) NÃO precisam estar na LegalMatrix e NUNCA geram alerta de alucinação. 
   - Se mal usados, geram apenas ajustes técnicos (\`recommendedChanges\`).
`;
  }
}

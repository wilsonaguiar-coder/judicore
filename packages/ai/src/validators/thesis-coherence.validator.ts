import { PieceBrief } from "../generation-pipeline/piece-brief.service.js";

export class ThesisCoherenceValidator {
  /**
   * Constrói as regras para verificar a coerência das teses com os fatos extraídos.
   */
  static buildPromptRules(brief: PieceBrief): string {
    const fatos = brief.fatosRelevantes;
    const fatosArr = Array.isArray(fatos) ? fatos : (fatos ? [String(fatos)] : []);
    const fatosPrincipais = fatosArr.length > 0 ? fatosArr.join("; ") : "Fatos não detalhados no brief.";

    return `
### REGRAS DO THESIS COHERENCE VALIDATOR (PRIORIDADE 2: FATOS INVENTADOS - 30%)
1. Avalie se as teses jurídicas e pedidos defendidos na peça decorrem dos seguintes fatos do caso (PieceBrief):
   - Fatos Base: ${fatosPrincipais}
2. O FOCO é detectar afirmações categóricas sem suporte no PieceBrief (Fatos Inventados). Ex: "houve indeferimento administrativo", "a aposentadoria foi concedida com integralidade", etc., se não constarem nos Fatos Base.
3. DISTINÇÃO CRUCIAL (FALTA DE PROVA ≠ FATO INVENTADO):
   - Se a peça afirma um fato como CERTEZA e ele não está no brief -> FATO INVENTADO (Risco Material).
   - Se a peça não tem documento, mas trata isso adequadamente (ex: "a comprovação será feita por ficha funcional a ser exibida", "requer exibição de documentos") -> NÃO É RISCO MATERIAL. Aponte o documento faltante apenas no \`documentChecklist\`.
4. Se detectar um fato inventado:
   - Apenas aponte: "A peça afirma como fato consolidado informação não presente no PieceBrief: [trecho]."
   - NÃO sugira reescrever a tese, apenas classifique o risco (ALTA ou CRÍTICA se o fato sustenta toda a tese).
   - Registre isso em \`materialRisks\`.
5. Avalie também se há fundamentação materialmente impossível (ex: pedir benefício antes de cumprir requisito temporal óbvio) e registre em \`mandatoryChanges\`.
`;
  }
}

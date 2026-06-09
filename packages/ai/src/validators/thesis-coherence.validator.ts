import { PieceBrief } from "../generation-pipeline/piece-brief.service.js";

export class ThesisCoherenceValidator {
  /**
   * Constrói as regras para verificar a coerência das teses com os fatos extraídos.
   */
  static buildPromptRules(brief: PieceBrief): string {
    const fatosPrincipais = brief.fatosRelevantes?.join("; ") ?? "Fatos não detalhados no brief.";

    return `
### REGRAS DO THESIS COHERENCE VALIDATOR
1. Avalie se as teses jurídicas defendidas na peça realmente decorrem dos seguintes fatos do caso:
   - Fatos Base: ${fatosPrincipais}
2. Verifique se há fundamentação jurídica impossível (ex: pedir benefício antes de cumprir requisito temporal evidente).
3. Verifique se existe tese principal e subsidiária e se elas estão bem separadas ou se há contradição lógica.
4. Identifique se algum precedente vinculante ou objeção jurídica óbvia foi ignorado pela tese construída.
5. Registre os problemas em \`thesisIssues\`.
`;
  }
}

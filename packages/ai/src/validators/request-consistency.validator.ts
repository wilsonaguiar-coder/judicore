export class RequestConsistencyValidator {
  /**
   * Constrói as regras para avaliar a consistência dos pedidos finais.
   */
  static buildPromptRules(): string {
    return `
### REGRAS DO REQUEST CONSISTENCY VALIDATOR
1. Todos os pedidos descritos ao final da peça DEVEM ter sido fundamentados no corpo do texto. 
2. Não é permitido que a petição requeira algo (ex: dano moral, inversão do ônus, tutela antecipada) se não houver um tópico específico argumentando sobre esse direito.
3. Avalie se o valor da causa é compatível com o rito, ou se a expressão "para fins meramente fiscais" foi usada inadequadamente (ela deve ser ajustada).
4. Registre pedidos sem amparo ou pedidos incompatíveis com a fundamentação no campo \`requestIssues\`.
`;
  }
}

import type { ValidationError } from "../pipeline/types.js";

const BANNED_EXPRESSIONS = [
  "direito alegado",
  "matéria cível",
  "pretensão da parte",
  "caso concreto",
  "legislação aplicável",
  "normas pertinentes",
  "reconhecimento do direito",
];

export class RichnessValidator {
  validate(draft: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const lower = draft.toLowerCase();

    for (const expr of BANNED_EXPRESSIONS) {
      if (lower.includes(expr)) {
        errors.push({
          rule: "FINAL_DRAFT_WEAK_ARGUMENTATION",
          message: `Expressão genérica proibida em FINAL_DRAFT: "${expr}"`,
          fatal: false,
        });
      }
    }

    const hasNorms = /\bart\.\s*\d+|\bartigo\s+\d+/i.test(draft);
    if (!hasNorms) {
      errors.push({
        rule: "FINAL_DRAFT_WEAK_ARGUMENTATION",
        message: "Nenhuma norma específica (art. N) encontrada — fundamentação insuficiente",
        fatal: false,
      });
    }

    // Mínimo de 2 teses desenvolvidas (Tese N: ou múltiplos artigos)
    const teseSections = (draft.match(/\bTese\s+\d+/gi) ?? []).length;
    if (teseSections < 2) {
      const normCount = (draft.match(/\bart\.\s*\d+/gi) ?? []).length;
      if (normCount < 3) {
        errors.push({
          rule: "FINAL_DRAFT_WEAK_ARGUMENTATION",
          message: "Fundamentação fraca — menos de 2 teses desenvolvidas ou menos de 3 normas citadas",
          fatal: false,
        });
      }
    }

    return errors;
  }
}

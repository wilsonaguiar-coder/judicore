import type { LegalClassification, TipoPeca, ValidationError, ValidationResult } from "../pipeline/types.js";
import { INCOMPATIBLE_APPEALS } from "../rules/legal_rules.js";

export class AppealValidator {
  validate(draft: string, classification: LegalClassification): ValidationResult {
    const errors: ValidationError[] = [];
    const lowerDraft = draft.toLowerCase();
    const incompatible = INCOMPATIBLE_APPEALS[classification.tipo_justica] ?? [];

    for (const term of incompatible) {
      if (lowerDraft.includes(term)) {
        errors.push({
          rule: "INCOMPATIBLE_APPEAL",
          message: `"${term}" é recurso incompatível com ${classification.tipo_justica}`,
          fatal: true,
        });
      }
    }

    // STJ não é revisional para matéria trabalhista
    if (
      classification.tipo_justica === "TRABALHO" &&
      (lowerDraft.includes("stj") || lowerDraft.includes("superior tribunal de justiça"))
    ) {
      errors.push({
        rule: "WRONG_SUPERIOR_COURT",
        message: "O TST é o tribunal superior trabalhista — STJ não revisa matéria trabalhista",
        fatal: false,
      });
    }

    // JEF/JEC não devem usar apelação
    if (
      (classification.tipo_justica === "JEF" || classification.tipo_justica === "JEC") &&
      /\bapela[cç][aã]o\b/i.test(draft)
    ) {
      errors.push({
        rule: "JEF_JEC_WRONG_APPEAL",
        message: `${classification.tipo_justica} usa Recurso Inominado (art. 42 Lei 9.099/95), não apelação`,
        fatal: true,
      });
    }

    // Criminal: não deve usar art. 895 CLT nem apelação cível
    if (
      (classification.tipo_justica === "CRIMINAL" || classification.regime_juridico === "CRIMINAL") &&
      (lowerDraft.includes("art. 895 clt") || lowerDraft.includes("recurso ordinário trabalhista"))
    ) {
      errors.push({
        rule: "CRIMINAL_WRONG_APPEAL",
        message: "Matéria criminal usa Apelação Criminal (art. 593 CPP) — não recurso ordinário trabalhista",
        fatal: true,
      });
    }

    return { valid: errors.filter((e) => e.fatal).length === 0, errors };
  }

  validateAppealResource(tipoPeca: TipoPeca, tipoJustica: string, resourceMentioned: string): boolean {
    if (tipoJustica === "TRABALHO" && /apela[cç][aã]o/i.test(resourceMentioned)) return false;
    if ((tipoJustica === "JEF" || tipoJustica === "JEC") && /apela[cç][aã]o/i.test(resourceMentioned)) return false;
    return true;
  }
}

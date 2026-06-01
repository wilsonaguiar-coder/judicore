import type { LegalExtraction, ValidationError } from "../pipeline/types.js";
import { GENERIC_EXPRESSIONS } from "../rules/legal_rules.js";

export class GenericityValidator {
  calculateScore(draft: string, extraction: LegalExtraction): number {
    let score = 0;

    // Expressões genéricas no texto (+1 por ocorrência)
    for (const expr of GENERIC_EXPRESSIONS) {
      if (expr.pattern.test(draft)) score += 1;
    }

    // Poucos fatos extraídos
    if (extraction.fatos.length < 2) score += 2;
    if (extraction.fatos.length === 0) score += 3;

    // Poucos pedidos
    if (extraction.pedidos.length < 1) score += 2;

    // Extração insuficiente
    if (extraction.qualidade_extracao === "INSUFICIENTE") score += 3;
    if (extraction.qualidade_extracao === "PARCIAL") score += 1;

    // Placeholders no texto (indica que não foi completado)
    const placeholderCount = (draft.match(/\[(?:INSERIR|A DETERMINAR|PREENCHER|VERIFICAR|DADO NÃO FORNECIDO)[^\]]*\]/gi) ?? []).length;
    score += Math.min(placeholderCount, 5);

    return score;
  }

  detect(draft: string): ValidationError[] {
    const errors: ValidationError[] = [];
    let count = 0;

    for (const expr of GENERIC_EXPRESSIONS) {
      if (expr.pattern.test(draft)) {
        count++;
        errors.push({ rule: "PECA_GENERICA", message: expr.label, fatal: false });
      }
    }

    if (count >= 3) {
      errors.push({
        rule: "PECA_GENERICA",
        message: `Peça com conteúdo excessivamente genérico (${count} expressões detectadas) — pode não corresponder ao caso real`,
        fatal: false,
      });
    }

    return errors;
  }

  isAboveThreshold(score: number, threshold = 4): boolean {
    return score >= threshold;
  }
}

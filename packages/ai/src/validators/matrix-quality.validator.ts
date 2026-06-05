import type { ArgumentationMatrix, LegalExtraction, ValidationError, ValidationResult } from "../pipeline/types.js";

const GENERIC_FATOS = [
  "caso concreto",
  "direito alegado",
  "pretensão da parte",
  "fatos narrados",
];

const GENERIC_NORMAS = [
  "princípios gerais",
  "direito civil vigente",
  "legislação aplicável",
  "normas pertinentes",
];

export class MatrixQualityValidator {
  validate(matrix: ArgumentationMatrix, extraction: LegalExtraction): ValidationResult {
    const errors: ValidationError[] = [];

    if (matrix.teses.length < extraction.pedidos.length) {
      errors.push({
        rule: "MATRIX_INSUFFICIENT_TESES",
        message: `Número de teses insuficiente: ${matrix.teses.length} tese(s) elaboradas para ${extraction.pedidos.length} pedido(s) formulados.`,
        fatal: false,
      });
    }

    for (const tese of matrix.teses) {
      const fatoLower = (tese.fato ?? "").toLowerCase();
      for (const g of GENERIC_FATOS) {
        if (fatoLower.includes(g)) {
          errors.push({ rule: "MATRIX_GENERIC_FATO", message: `Fato genérico na tese: "${g}"`, fatal: false });
          break;
        }
      }

      const normaLower = (tese.norma ?? "").toLowerCase();
      for (const g of GENERIC_NORMAS) {
        if (normaLower.includes(g)) {
          errors.push({ rule: "MATRIX_GENERIC_NORMA", message: `Norma genérica na tese: "${g}"`, fatal: false });
          break;
        }
      }

      if (!tese.pedido?.trim())   errors.push({ rule: "MATRIX_MISSING_FIELD", message: "Tese sem pedido",   fatal: false });
      if (!tese.fato?.trim())     errors.push({ rule: "MATRIX_MISSING_FIELD", message: "Tese sem fato",     fatal: false });
      if (!tese.norma?.trim())    errors.push({ rule: "MATRIX_MISSING_FIELD", message: "Tese sem norma",    fatal: false });
      if (!tese.conclusao?.trim()) errors.push({ rule: "MATRIX_MISSING_FIELD", message: "Tese sem conclusão", fatal: false });
    }

    return { valid: errors.length === 0, errors };
  }
}

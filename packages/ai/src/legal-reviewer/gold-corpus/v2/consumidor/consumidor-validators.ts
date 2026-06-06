/**
 * FASE 9.0.9 — Consumidor Good Case Validators
 */

export interface ValidationError { validator: string; message: string; }
export interface ValidationResult { passed: boolean; errors: ValidationError[]; }

export function validateTemporalConsistency(text: string, caseId: string): ValidationResult {
  const errors: ValidationError[] = [];

  const dateRangeRegex = /de (\d{2})\/(\d{2})\/(\d{4}) [aà] (\d{2})\/(\d{2})\/(\d{4})/;
  const rangeMatch = dateRangeRegex.exec(text);
  if (rangeMatch) {
    const fromYear = parseInt(rangeMatch[3] ?? "0", 10);
    const toYear   = parseInt(rangeMatch[6] ?? "0", 10);
    if (fromYear > toYear) {
      errors.push({ validator: "TemporalConsistency", message: `${caseId}: Inversão temporal na data de início/fim` });
    }
  }

  return { passed: errors.length === 0, errors };
}

export function validateCalculationConsistency(text: string, caseId: string): ValidationResult {
  const errors: ValidationError[] = [];

  function parseBrl(s: string): number {
    return parseFloat(s.replace(/\./g, "").replace(",", "."));
  }

  // Check that any dano moral mentioned is at least R$ 1.000,00
  const valorMatch = /dano moral de (R\$\s*[\d.,]+)/.exec(text) ??
                     /indenização.*de (R\$\s*[\d.,]+)/.exec(text);
  if (valorMatch) {
    const val = parseBrl((valorMatch[1] ?? "").replace("R$", "").trim());
    if (!isNaN(val) && val < 1000) {
      errors.push({ validator: "CalculationConsistency", message: `${caseId}: Valor de dano moral implausível — R$ ${val.toFixed(2)} (mínimo esperado: R$ 1.000,00)` });
    }
  }

  return { passed: errors.length === 0, errors };
}

export function validateLegalReferences(text: string, caseId: string): ValidationResult {
  const errors: ValidationError[] = [];

  // CDC must be referenced in any consumer document
  if (!/CDC|Lei\s+8\.078/.test(text)) {
    errors.push({ validator: "LegalReference", message: `${caseId}: Peça de direito do consumidor sem referência ao CDC (Lei 8.078/1990)` });
  }

  // Dano moral documents should reference CDC art. 6.º VI
  const isDanoMoralPrimary =
    text.includes("DANO MORAL") ||
    text.includes("INDENIZAÇÃO POR DANO");
  if (isDanoMoralPrimary && !/CDC.*art\.?\s*6\.º|art\.?\s*6\.º.*CDC/.test(text)) {
    errors.push({ validator: "LegalReference", message: `${caseId}: Pedido de dano moral consumidor sem referência ao CDC art. 6.º VI` });
  }

  return { passed: errors.length === 0, errors };
}

export function validateGoodDocument(text: string, caseId: string): {
  allPassed: boolean;
  results: { temporal: ValidationResult; calculation: ValidationResult; legal: ValidationResult };
} {
  const temporal    = validateTemporalConsistency(text, caseId);
  const calculation = validateCalculationConsistency(text, caseId);
  const legal       = validateLegalReferences(text, caseId);
  return {
    allPassed: temporal.passed && calculation.passed && legal.passed,
    results: { temporal, calculation, legal },
  };
}

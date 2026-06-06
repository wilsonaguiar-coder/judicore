/**
 * FASE 9.0.9 — Tributário Good Case Validators
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

  // Anos de exercício fiscal não devem ser futuros (>2026)
  const anoMatch = text.matchAll(/exercício (\d{4})/g);
  for (const m of anoMatch) {
    const ano = parseInt(m[1] ?? "0", 10);
    if (ano > 2026) {
      errors.push({ validator: "TemporalConsistency", message: `${caseId}: Ano de exercício fiscal futuro (${ano})` });
      break;
    }
  }

  return { passed: errors.length === 0, errors };
}

export function validateCalculationConsistency(text: string, caseId: string): ValidationResult {
  const errors: ValidationError[] = [];

  function parseBrl(s: string): number {
    return parseFloat(s.replace(/\./g, "").replace(",", "."));
  }

  // Valores de tributo devem ser ≥ R$ 1.000,00
  const valorMatch = /restituição de (R\$\s*[\d.,]+)/.exec(text) ??
                     /no valor de (R\$\s*[\d.,]+)/.exec(text) ??
                     /totalizando (R\$\s*[\d.,]+)/.exec(text);
  if (valorMatch) {
    const val = parseBrl((valorMatch[1] ?? "").replace("R$", "").trim());
    if (!isNaN(val) && val < 1000) {
      errors.push({ validator: "CalculationConsistency", message: `${caseId}: Valor tributário implausível — R$ ${val.toFixed(2)} (mínimo esperado: R$ 1.000,00)` });
    }
  }

  return { passed: errors.length === 0, errors };
}

export function validateLegalReferences(text: string, caseId: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Prescrição tributária deve citar CTN art. 174
  if (text.includes("prescrição") && text.includes("tributár")) {
    if (!/CTN\s+art\.?\s*174|art\.?\s*174.*CTN/.test(text)) {
      errors.push({ validator: "LegalReference", message: `${caseId}: Prescrição tributária sem referência ao CTN art. 174` });
    }
  }

  // Decadência tributária deve citar CTN art. 173
  if (text.includes("decadência") && text.includes("tributár")) {
    if (!/CTN\s+art\.?\s*173|art\.?\s*173.*CTN/.test(text)) {
      errors.push({ validator: "LegalReference", message: `${caseId}: Decadência tributária sem referência ao CTN art. 173` });
    }
  }

  // Mandado de segurança deve citar Lei 12.016
  if (text.includes("MANDADO DE SEGURANÇA") || text.includes("mandado de segurança")) {
    if (!/Lei\s+12\.016|art\.?\s*5\.º\s+LXIX/.test(text)) {
      errors.push({ validator: "LegalReference", message: `${caseId}: Mandado de segurança sem referência à Lei 12.016/2009 ou CF art. 5.º LXIX` });
    }
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

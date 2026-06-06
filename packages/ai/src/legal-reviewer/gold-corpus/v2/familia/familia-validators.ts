/**
 * FASE 9.0.9 — Família Good Case Validators
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

  const anoMatch = text.matchAll(/ano (\d{4})/g);
  for (const m of anoMatch) {
    const ano = parseInt(m[1] ?? "0", 10);
    if (ano > 2026) {
      errors.push({ validator: "TemporalConsistency", message: `${caseId}: Ano futuro encontrado (${ano})` });
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

  // Only validate explicit alimentos/pensão amounts (R$ X/mês pattern)
  const valorMatch = /pensão de (R\$\s*[\d.,]+)\/mês/.exec(text) ??
                     /alimentos de (R\$\s*[\d.,]+)\/mês/.exec(text) ??
                     /alimentos de (R\$\s*[\d.,]+)\/mês/.exec(text);
  if (valorMatch) {
    const val = parseBrl((valorMatch[1] ?? "").replace("R$", "").trim());
    if (!isNaN(val) && val < 100) {
      errors.push({ validator: "CalculationConsistency", message: `${caseId}: Valor de alimentos implausível — R$ ${val.toFixed(2)} (mínimo esperado: R$ 100,00)` });
    }
  }

  return { passed: errors.length === 0, errors };
}

export function validateLegalReferences(text: string, caseId: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Only validate alimentos reference when the document is specifically about alimentos
  const isAlimentosPrimary =
    text.includes("AÇÃO DE ALIMENTOS") ||
    text.includes("REVISÃO DE ALIMENTOS") ||
    text.includes("EXECUÇÃO DE ALIMENTOS") ||
    text.includes("CUMPRIMENTO DE SENTENÇA — EXECUÇÃO DE ALIMENTOS");

  if (isAlimentosPrimary) {
    if (!/art\.?\s*1\.?694|Lei\s+5\.478|art\s+1694|CPC art\.\s*528|Súm\.\s*309|art\.?\s*1\.?699/.test(text)) {
      errors.push({ validator: "LegalReference", message: `${caseId}: Peça de alimentos sem referência ao CC art. 1.694/1.699, Lei 5.478, CPC art. 528 ou Súm. 309 STJ` });
    }
  }

  // Only validate guarda compartilhada reference when it's the primary subject
  const isGuardaPrimary =
    text.includes("RECURSO") && (text.toLowerCase().includes("guarda compartilhada") || text.toLowerCase().includes("guarda"));

  if (isGuardaPrimary && text.toLowerCase().includes("guarda compartilhada")) {
    if (!/Lei\s+13\.058|art\.?\s*1\.?583|art\s+1583/.test(text)) {
      errors.push({ validator: "LegalReference", message: `${caseId}: Guarda compartilhada sem referência à Lei 13.058/2014 ou CC art. 1.583` });
    }
  }

  // Alienação parental must cite Lei 12.318 when primary
  if (text.includes("ALIENAÇÃO PARENTAL") || text.includes("INIBIÇÃO À ALIENAÇÃO PARENTAL")) {
    if (!/Lei\s+12\.318/.test(text)) {
      errors.push({ validator: "LegalReference", message: `${caseId}: Alienação parental sem referência à Lei 12.318/2010` });
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

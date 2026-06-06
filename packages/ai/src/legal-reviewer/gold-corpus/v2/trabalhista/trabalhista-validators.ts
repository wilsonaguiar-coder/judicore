/**
 * FASE 9.0.9 — Trabalhista Good Case Validators
 *
 * Três validadores que operam sobre o texto gerado para detectar inconsistências
 * temporais, de cálculo e de referências jurídicas nos documentos Trabalhista GOOD.
 */

export interface ValidationError {
  validator: string;
  message: string;
}

export interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
}

// ─── 1. Temporal Consistency ───────────────────────────────────────────────────

/**
 * Verifica inconsistências temporais:
 * - Data de admissão deve preceder data de demissão/rescisão
 * - Datas no formato DD/MM/AAAA devem ser válidas
 */
export function validateTemporalConsistency(text: string, caseId: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Extrai pares de data "de DD/MM/AAAA ... a DD/MM/AAAA" ou "desde ... até"
  const dateRangeRegex = /de (\d{2})\/(\d{2})\/(\d{4}) [aà] (\d{2})\/(\d{2})\/(\d{4})/;
  const rangeMatch = dateRangeRegex.exec(text);
  if (rangeMatch) {
    const fromYear = parseInt(rangeMatch[3] ?? "0", 10);
    const toYear   = parseInt(rangeMatch[6] ?? "0", 10);
    const fromMonth = parseInt(rangeMatch[2] ?? "0", 10);
    const toMonth   = parseInt(rangeMatch[5] ?? "0", 10);
    if (fromYear > toYear || (fromYear === toYear && fromMonth > toMonth)) {
      errors.push({
        validator: "TemporalConsistency",
        message: `${caseId}: Data de início posterior à data de fim — inversão temporal detectada`,
      });
    }
  }

  // Verifica meses > 12 em qualquer data DD/MM/AAAA
  const allDates = text.matchAll(/\d{2}\/(\d{2})\/\d{4}/g);
  for (const m of allDates) {
    const month = parseInt(m[1] ?? "0", 10);
    if (month < 1 || month > 12) {
      errors.push({
        validator: "TemporalConsistency",
        message: `${caseId}: Mês inválido (${month}) encontrado em data no texto`,
      });
      break;
    }
  }

  return { passed: errors.length === 0, errors };
}

// ─── 2. Calculation Consistency ───────────────────────────────────────────────

/**
 * Verifica plausibilidade de valores monetários trabalhistas:
 * - Valores de indenização/pedido devem ser ≥ R$ 500,00
 * - Multa de 40% deve ser coerente com FGTS base (40% × base = multa, tolerância ±5%)
 */
export function validateCalculationConsistency(text: string, caseId: string): ValidationResult {
  const errors: ValidationError[] = [];

  function parseBrl(s: string): number {
    return parseFloat(s.replace(/\./g, "").replace(",", "."));
  }

  // Valores de pedido devem ser ≥ R$ 500,00
  const pedidoMatch = /totalizando (R\$\s*[\d.,]+)/.exec(text) ??
                      /no montante de (R\$\s*[\d.,]+)/.exec(text) ??
                      /no valor de (R\$\s*[\d.,]+)/.exec(text);
  if (pedidoMatch) {
    const val = parseBrl((pedidoMatch[1] ?? "").replace("R$", "").trim());
    if (!isNaN(val) && val < 500) {
      errors.push({
        validator: "CalculationConsistency",
        message: `${caseId}: Valor do pedido implausível — R$ ${val.toFixed(2)} (mínimo esperado: R$ 500,00)`,
      });
    }
  }

  // Multa 40% do FGTS: saldo × 0.4 = multa (tolerância ±5%)
  const multaRegex = /saldo de (R\$\s*[\d.,]+).*?totalizando (R\$\s*[\d.,]+)/s;
  const multaMatch = multaRegex.exec(text);
  if (multaMatch && text.includes("multa") && text.includes("40%")) {
    const saldo = parseBrl((multaMatch[1] ?? "").replace("R$", "").trim());
    const multa = parseBrl((multaMatch[2] ?? "").replace("R$", "").trim());
    if (!isNaN(saldo) && !isNaN(multa) && saldo > 0) {
      const esperada = saldo * 0.4;
      const diff = Math.abs(esperada - multa) / esperada;
      if (diff > 0.05) {
        errors.push({
          validator: "CalculationConsistency",
          message: `${caseId}: Multa de 40% inconsistente — saldo ${saldo.toFixed(2)}, multa calculada ${multa.toFixed(2)} (esperado ≈ ${esperada.toFixed(2)}, erro ${(diff * 100).toFixed(1)}%)`,
        });
      }
    }
  }

  return { passed: errors.length === 0, errors };
}

// ─── 3. Legal Reference ────────────────────────────────────────────────────────

/**
 * Verifica referências jurídicas trabalhistas corretas:
 * - Adicional de insalubridade de grau máximo (40%) deve citar art. 192 da CLT ou NR-15
 * - Equiparação salarial deve citar art. 461 da CLT
 * - Dano moral trabalhista deve citar arts. 223-A a 223-G da CLT (Lei 13.467/2017)
 */
export function validateLegalReferences(text: string, caseId: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Insalubridade grau máximo (40%) deve ter NR-15
  if (text.includes("insalubridade") && text.includes("máximo (40%)")) {
    if (!/NR-15|CLT\s+art\.?\s*19[0-2]/.test(text)) {
      errors.push({
        validator: "LegalReference",
        message: `${caseId}: Insalubridade grau máximo sem referência à NR-15 ou CLT arts. 189-192`,
      });
    }
  }

  // Equiparação salarial deve citar art. 461
  if (text.includes("equiparação salarial") || text.includes("equiparacao salarial")) {
    if (!/art\.?\s*461|CLT\s+art/.test(text)) {
      errors.push({
        validator: "LegalReference",
        message: `${caseId}: Equiparação salarial sem referência ao art. 461 da CLT`,
      });
    }
  }

  // Dano moral trabalhista deve citar arts. 223 da CLT
  if ((text.includes("dano moral") || text.includes("assédio moral")) && text.includes("CLT")) {
    if (!/art\.?\s*223/.test(text)) {
      errors.push({
        validator: "LegalReference",
        message: `${caseId}: Dano/assédio moral trabalhista sem referência aos arts. 223-A a 223-G da CLT`,
      });
    }
  }

  return { passed: errors.length === 0, errors };
}

// ─── Runner ────────────────────────────────────────────────────────────────────

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

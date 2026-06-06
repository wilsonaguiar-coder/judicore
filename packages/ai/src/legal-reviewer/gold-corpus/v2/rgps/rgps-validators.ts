/**
 * FASE 9.0.8.14 — RGPS Good Case Validators
 *
 * Três validadores que operam sobre o texto gerado para detectar inconsistências
 * temporais, de cálculo e de referências jurídicas nos documentos GOOD.
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
 * Verifica inconsistências temporais no texto:
 * - DIB deve preceder DIP (ano DIB < ano DIP, ou mesma ano com mês anterior)
 * - Última contribuição não deve ser posterior à data de incapacidade
 * - Correção INPC não deve ter intervalo invertido (dib > dip)
 */
export function validateTemporalConsistency(text: string, caseId: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Extrai anos de DIB e DIP
  const dibMatch = /DIB[^0-9]*(\d{2}\/\d{2}\/(\d{4}))/.exec(text);
  const dipMatch = /DIP[^0-9]*(\d{2}\/\d{2}\/(\d{4})|(\d{2})\/(\d{4}))/.exec(text);
  if (dibMatch && dipMatch) {
    const dibYear = parseInt(dibMatch[2] ?? "0", 10);
    // DIP pode ser "MM/YYYY" ou "DD/MM/YYYY"
    const dipYearStr = dipMatch[4] ?? dipMatch[2]?.slice(6);
    const dipYear = parseInt(dipYearStr ?? "0", 10);
    if (dipYear > 0 && dibYear > 0 && dibYear > dipYear) {
      errors.push({
        validator: "TemporalConsistency",
        message: `${caseId}: DIB (ano ${dibYear}) é posterior a DIP (ano ${dipYear}) — inversão temporal detectada`,
      });
    }
  }

  // Verifica "INPC acumulado de X a Y" — X deve preceder Y
  const corrMatch = /INPC acumulado de (\d{2}\/\d{2}\/(\d{4})) a (\d{2})\/(\d{4})/.exec(text);
  if (corrMatch) {
    const fromYear = parseInt(corrMatch[2] ?? "0", 10);
    const toYear = parseInt(corrMatch[4] ?? "0", 10);
    if (fromYear > 0 && toYear > 0 && fromYear > toYear) {
      errors.push({
        validator: "TemporalConsistency",
        message: `${caseId}: Período de correção INPC invertido — de ${corrMatch[1]} a ${corrMatch[3]}/${corrMatch[4]}`,
      });
    }
  }

  // Verifica que última contribuição não é futura em relação à data de incapacidade
  const incapMatch = /incapacitado\(a\) em (\d{2}\/\d{2}\/(\d{4}))/.exec(text);
  const lastContribMatch = /[Úú]ltima contribui[çc][ãa]o:\s*\d{2}\/(\d{4})/.exec(text);
  if (incapMatch && lastContribMatch) {
    const incapYear = parseInt(incapMatch[2] ?? "0", 10);
    const lastContribYear = parseInt(lastContribMatch[1] ?? "0", 10);
    if (lastContribYear > incapYear) {
      errors.push({
        validator: "TemporalConsistency",
        message: `${caseId}: Última contribuição (${lastContribYear}) é posterior ao ano de incapacidade (${incapYear})`,
      });
    }
  }

  return { passed: errors.length === 0, errors };
}

// ─── 2. Calculation Consistency ───────────────────────────────────────────────

/**
 * Verifica plausibilidade de valores monetários:
 * - Atrasados devem ser ≥ R$ 5.000,00
 * - Resultados de multiplicação "RMI × fator = resultado" devem estar corretos
 *   (tolerância de ±5% para cobrir arredondamentos)
 */
export function validateCalculationConsistency(text: string, caseId: string): ValidationResult {
  const errors: ValidationError[] = [];

  function parseBrl(s: string): number {
    return parseFloat(s.replace(/\./g, "").replace(",", "."));
  }

  // Atrasados >= R$ 5.000,00
  const atrasadosMatch = /estimadas em (R\$\s*[\d.,]+)/.exec(text) ??
                         /totaliza (R\$\s*[\d.,]+)/.exec(text) ??
                         /atrasadas.*?(R\$\s*[\d.,]+)/.exec(text);
  if (atrasadosMatch) {
    const val = parseBrl((atrasadosMatch[1] ?? "").replace("R$", "").trim());
    if (!isNaN(val) && val < 5000) {
      errors.push({
        validator: "CalculationConsistency",
        message: `${caseId}: Atrasados implausíveis — R$ ${val.toFixed(2)} (mínimo esperado: R$ 5.000,00)`,
      });
    }
  }

  // RMI × fator = resultado (verifica cada ocorrência)
  const multRegex = /RMI (R\$\s*[\d.,]+) × fator INPC ([\d,]+) = (R\$\s*[\d.,]+)/g;
  let m: RegExpExecArray | null;
  while ((m = multRegex.exec(text)) !== null) {
    const rmi = parseBrl((m[1] ?? "").replace("R$", "").trim());
    const fator = parseFloat((m[2] ?? "").replace(",", "."));
    const resultado = parseBrl((m[3] ?? "").replace("R$", "").trim());
    if (!isNaN(rmi) && !isNaN(fator) && !isNaN(resultado)) {
      const esperado = rmi * fator;
      const diff = Math.abs(esperado - resultado) / esperado;
      if (diff > 0.05) {
        errors.push({
          validator: "CalculationConsistency",
          message: `${caseId}: Multiplicação incorreta — ${rmi.toFixed(2)} × ${fator} = ${resultado.toFixed(2)} (esperado ≈ ${esperado.toFixed(2)}, erro ${(diff * 100).toFixed(1)}%)`,
        });
      }
    }
  }

  return { passed: errors.length === 0, errors };
}

// ─── 3. Legal Reference ────────────────────────────────────────────────────────

/**
 * Verifica referências jurídicas corretas:
 * - Súmula 111/STJ não deve ser citada para correção de erro material de cálculo
 *   (Súmula 111 trata de honorários em ações previdenciárias)
 * - AJG deve mencionar fundamento legal (art. 98 a 102 do CPC)
 */
export function validateLegalReferences(text: string, caseId: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Súmula 111/STJ não deve aparecer junto de contexto de erro de cálculo/PBC
  if (/S[úu]mula\s+111\s*\/?\s*STJ/i.test(text)) {
    const context = text.match(/.{0,80}S[úu]mula\s+111\s*\/?\s*STJ.{0,80}/i)?.[0] ?? "";
    if (/corrig[íi]vel|erro material|PBC|salár[io]/i.test(context)) {
      errors.push({
        validator: "LegalReference",
        message: `${caseId}: Súmula 111/STJ citada incorretamente para correção de erro material de cálculo — a súmula trata de honorários advocatícios`,
      });
    }
  }

  // AJG deve ter embasamento legal
  if (/Assist[êe]ncia Judici[áa]ria Gratuita/i.test(text)) {
    if (!/art\. 98|art\. 99|CPC\/2015|gratuidade/i.test(text)) {
      errors.push({
        validator: "LegalReference",
        message: `${caseId}: AJG solicitada sem fundamento legal (esperado: art. 98 a 102 do CPC/2015)`,
      });
    }
  }

  return { passed: errors.length === 0, errors };
}

// ─── Runner ────────────────────────────────────────────────────────────────────

/** Executa os três validadores e retorna resultado consolidado. */
export function validateGoodDocument(text: string, caseId: string): {
  allPassed: boolean;
  results: { temporal: ValidationResult; calculation: ValidationResult; legal: ValidationResult };
} {
  const temporal = validateTemporalConsistency(text, caseId);
  const calculation = validateCalculationConsistency(text, caseId);
  const legal = validateLegalReferences(text, caseId);
  return {
    allPassed: temporal.passed && calculation.passed && legal.passed,
    results: { temporal, calculation, legal },
  };
}

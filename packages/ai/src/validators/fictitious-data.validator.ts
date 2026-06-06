import type { ValidationError } from "../pipeline/types.js";

/**
 * FICTITIOUS_DATA_DETECTED (FASE 8.4.2-R)
 *
 * Detecta nomes fictícios e dados de fallback que foram explicitamente
 * proibidos pela política de placeholders. Presença de qualquer item
 * desta lista na peça gerada é FATAL.
 *
 * Inclui os padrões que a FASE 5.4 adicionou aos prompts e que foram
 * removidos, mas cujo resultado pode ainda estar presente em peças geradas
 * com modelos em cache ou fallbacks residuais.
 */

const FICTITIOUS_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Nomes fictícios explicitamente listados nos prompts removidos
  { pattern: /\bJoão\s+da\s+Silva\b/i,           label: "nome fictício 'João da Silva'" },
  { pattern: /\bMaria\s+Aparecida\s+Santos\b/i,   label: "nome fictício 'Maria Aparecida Santos'" },
  { pattern: /\bMaria\s+Aparecida\b/i,            label: "nome fictício 'Maria Aparecida'" },
  { pattern: /\bJosé\s+da\s+Silva\b/i,            label: "nome fictício 'José da Silva'" },
  // Empresas fictícias dos prompts
  { pattern: /\bEmpresa\s+XYZ\b/i,               label: "empresa fictícia 'Empresa XYZ'" },
  { pattern: /\bBanco\s+ABC\b/i,                  label: "banco fictício 'Banco ABC'" },
  { pattern: /\bEmpresa\s+Ré\s+Ltda\b/i,         label: "empresa fictícia 'Empresa Ré Ltda'" },
  { pattern: /\bOperadora\s+de\s+Plano\s+de\s+Saúde\s+XYZ\b/i, label: "operadora fictícia 'Operadora XYZ'" },
  // Número de processo fictício padrão dos testes/demos
  { pattern: /\b0001234-56\./,                    label: "número de processo fictício '0001234-56'" },
  // Banco de exemplo do demo
  { pattern: /\bBanco\s+Exemplo\b/i,              label: "banco fictício 'Banco Exemplo S/A'" },
];

/**
 * Valida que a peça não contém dados fictícios conhecidos.
 * Aplicável apenas em modo FINAL_DRAFT — em TEMPLATE_MODEL/SAFE_SKELETON
 * os placeholders são esperados e dados fictícios não devem aparecer de
 * qualquer forma (a política de placeholders garante isso nos prompts).
 */
export function validateFictitiousData(draft: string): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const { pattern, label } of FICTITIOUS_PATTERNS) {
    if (pattern.test(draft)) {
      errors.push({
        rule: "FICTITIOUS_DATA_DETECTED",
        message:
          `Dado fictício detectado na peça: ${label}. ` +
          `Substitua por placeholder entre colchetes (ex: [AUTOR], [RÉU]) ou pelo dado real do caso.`,
        fatal: true,
      });
    }
  }

  return errors;
}

/** Lista dos padrões para uso em testes e auditoria. */
export const FICTITIOUS_DATA_PATTERNS = FICTITIOUS_PATTERNS;

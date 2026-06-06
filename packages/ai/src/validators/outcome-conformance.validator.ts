import type { DecidedOutcome } from "../pipeline/types.js";
import type { ValidationError } from "../pipeline/types.js";
import { getOutcomeExpectation } from "../pipeline/outcome-extractor.js";

/**
 * OUTCOME_CONFORMANCE_VALIDATOR (FASE 8.4.2-R)
 *
 * Verifica se o dispositivo da peça gerada corresponde à direção decisória
 * solicitada pelo usuário. Erro FATAL quando há divergência.
 */
export function validateOutcomeConformance(
  draft: string,
  decidedOutcome: DecidedOutcome | undefined,
): ValidationError[] {
  if (!decidedOutcome) return [];

  const expectation = getOutcomeExpectation(decidedOutcome);

  // Extrai apenas o bloco do dispositivo para análise mais precisa.
  // Se não encontrar, usa o draft completo (mais conservador).
  const dispositivoMatch = draft.match(
    /DISPOSITIVO[\s\S]{0,5000}/i,
  );
  const targetText = dispositivoMatch ? dispositivoMatch[0] : draft.slice(-3000);

  const hasPositive = expectation.positivePatterns.some((p) => p.test(targetText));
  const hasNegative = expectation.negativePatterns.some((p) => p.test(targetText));

  if (hasNegative && !hasPositive) {
    return [
      {
        rule: "OUTCOME_CONFORMANCE_VIOLATION",
        message:
          `Direção decisória violada: o usuário solicitou resultado "${expectation.label}" mas o dispositivo gerado contém resultado oposto. ` +
          `Peça bloqueada — regenerar com a direção correta.`,
        fatal: true,
      },
    ];
  }

  if (!hasPositive) {
    return [
      {
        rule: "OUTCOME_CONFORMANCE_NOT_FOUND",
        message:
          `Direção decisória não confirmada: o usuário solicitou resultado "${expectation.label}" mas o dispositivo não contém o resultado esperado. ` +
          `Verifique se o dispositivo está presente e correto.`,
        fatal: true,
      },
    ];
  }

  return [];
}

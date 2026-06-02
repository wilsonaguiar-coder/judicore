// CivilValidator — regras específicas para peças cíveis.
//
// Roda para qualquer peça de jurisdição civil (ESTADUAL, FEDERAL, JEF, JEC)
// ou com regime jurídico CIVIL/ESTATUTARIO.
//
// Regras verificadas:
//   1. Tutela de urgência (DECISAO): deve analisar periculum in mora e citar art. 300 CPC
//   2. Sentença cível: deve conter honorários (art. 85 CPC) e custas (art. 82 CPC)
//   3. Despacho: não deve conter análise de mérito ou decisão liminar

import type { LegalClassification, ValidationError, ValidationResult } from "../pipeline/types.js";

const TUTELA_CONTEXT_RE = /tutela\s+de\s+urg[eê]ncia|medida\s+liminar|antecipa[cç][aã]o\s+de\s+tutela|provid[eê]ncia\s+liminar/i;
const ART300_RE = /art\.?\s*300\b[^a-z]{0,20}(do\s+)?c\.?\s*p\.?\s*c|art\.?\s*300\s*(do\s+)?c[oó]digo\s+de\s+processo/i;
const PERICULUM_RE = /periculum\s+in\s+mora|perigo\s+de\s+dano|urg[eê]ncia\s+da\s+medida|risco\s+(ao\s+resultado|de\s+dano\s+irr|iminente)|dano\s+de\s+dif[ií]cil\s+repara[cç][aã]o/i;
const HONORARIOS_RE = /honor[aá]rios\s+(advocat[ií]cios|de\s+sucumb[eê]ncia)|art\.?\s*85\b[^a-z]{0,30}cpc/i;
const CUSTAS_RE = /custas\s+processuais|art\.?\s*82\b[^a-z]{0,20}cpc|condeno.*custas|custas.*condeno/i;

export class CivilValidator {
  validate(draft: string, classification: LegalClassification): ValidationResult {
    const isCivel =
      ["ESTADUAL", "FEDERAL", "JEF", "JEC"].includes(classification.tipo_justica) ||
      ["CIVIL", "ESTATUTARIO"].includes(classification.regime_juridico ?? "");

    if (!isCivel) return { valid: true, errors: [] };

    const errors: ValidationError[] = [];

    // ── Tutela de urgência em DECISAO ─────────────────────────────────────────
    if (classification.tipo_peca === "DECISAO" && TUTELA_CONTEXT_RE.test(draft)) {
      if (!ART300_RE.test(draft)) {
        errors.push({
          rule: "TUTELA_MISSING_ART300",
          message: "Decisão de tutela de urgência deve citar o art. 300 do CPC (probabilidade do direito + perigo de dano ou risco ao resultado útil)",
          fatal: false,
        });
      }
      if (!PERICULUM_RE.test(draft)) {
        errors.push({
          rule: "TUTELA_MISSING_PERICULUM_MORA",
          message: "Tutela de urgência deve analisar o periculum in mora (perigo de dano irreparável, urgência ou risco ao resultado do processo)",
          fatal: false,
        });
      }
    }

    // ── Sentença cível: honorários e custas obrigatórios ─────────────────────
    if (
      classification.tipo_peca === "SENTENCA" &&
      classification.tipo_justica !== "TRABALHO" &&
      classification.tipo_justica !== "CRIMINAL"
    ) {
      if (!HONORARIOS_RE.test(draft)) {
        errors.push({
          rule: "SENTENCA_MISSING_HONORARIOS",
          message: "Sentença cível deve fixar honorários advocatícios sucumbenciais (art. 85 CPC — entre 10% e 20% do valor da condenação)",
          fatal: false,
        });
      }
      if (!CUSTAS_RE.test(draft)) {
        errors.push({
          rule: "SENTENCA_MISSING_CUSTAS",
          message: "Sentença cível deve fixar a responsabilidade pelo pagamento das custas processuais (art. 82 CPC)",
          fatal: false,
        });
      }
    }

    return { valid: !errors.some((e) => e.fatal), errors };
  }
}

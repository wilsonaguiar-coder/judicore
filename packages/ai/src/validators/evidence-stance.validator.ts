// EvidenceStanceValidator — verifica posicionamento de jurisprudências contrárias no draft.
//
// Regra central:
//   Uma jurisprudência CONTRARIA pode ser citada em três situações legítimas:
//
//   1. REJEIÇÃO DO PEDIDO — o draft usa o precedente para NEGAR o direito pleiteado
//      (ex: sentença que julga improcedente com base no precedente desfavorável ao autor).
//      → Nenhuma violação. O precedente está sendo aplicado conforme sua própria tese.
//
//   2. DISTINGUISHING — o draft cita o precedente e explicita por que ele não se aplica
//      (ex: petição que distingue a hipótese dos autos do precedente desfavorável).
//      → Nenhuma violação. Uso técnico correto.
//
//   3. USO COMO FUNDAMENTO FAVORÁVEL SEM DISTINÇÃO — o draft cita o precedente contrário
//      como se ele apoiasse o pedido, sem fazer distinguishing nem indicar improcedência.
//      → EVIDENCE_STANCE_VIOLATION (fatal). Erro jurídico grave.
//
// Exemplo de uso correto (caso 1):
//   "Conforme o STF no RE 590.260, o servidor que ingressou após a EC 41/2003 não faz
//    jus à paridade. JULGO IMPROCEDENTE o pedido."
//   → Nenhuma violação — o precedente contrário fundamenta a rejeição do pedido.
//
// Exemplo de violação (caso 3):
//   "Conforme o STF no RE 590.260, o servidor faz jus à paridade. JULGO PROCEDENTE."
//   → VIOLATION — precedente contrário usado como se favorável.

import type {
  ValidationError,
  EvidenceAnalysis,
  JurisprudenciaInput,
  ArgumentationMatrix,
} from "../pipeline/types.js";

// Linguagem que indica distinguishing / afastamento explícito do precedente
const DISTINGUISHING_RE =
  /\b(embora|não\s+se\s+aplic|distingue[\s-]se|distinguishing|diversamente|a\s+hipótese\s+dos\s+autos\s+dife|superado|não\s+guarda\s+identidade|em\s+sentido\s+contrário|entendimento\s+contrário|precedente\s+contrário|não\s+obstante|em\s+que\s+pese|apesar\s+de)\b/i;

// Linguagem de rejeição do pedido próxima à citação do precedente.
// Indica que o precedente contrário está sendo usado CORRETAMENTE para negar o direito
// pleiteado — não há violação de posicionamento.
const REJECTION_NEAR_JUR_RE =
  /\b(?:não\s+(?:faz\s+jus|tem\s+direito|possui\s+direito|merece\s+(?:prosperar|acolhida)|há\s+(?:direito|amparo))|julgo\s+improcedente|improcedente|indefiro\s+o\s+pedido|nego\s+provimento|denego\s+a?\s*ordem|deve\s+ser\s+(?:negado|indeferido|julgado\s+improcedente)|sem\s+(?:direito|paridade|integralidade|amparo\s+legal)|razão\s+pela\s+qual.*?(?:improcede|indefiro|nego))\b/i;

export class EvidenceStanceValidator {
  validate(
    draft: string,
    jurisprudencias: JurisprudenciaInput[],
    analyses: EvidenceAnalysis[],
  ): ValidationError[] {
    if (analyses.length === 0) return [];

    const errors: ValidationError[] = [];
    const lower = draft.toLowerCase();

    for (const analysis of analyses) {
      if (analysis.stance !== "CONTRARIO") continue;

      const jur = jurisprudencias.find((j) => j.id === analysis.id);
      if (!jur) continue;

      const citationIdx = this.findCitationIndex(lower, jur);
      if (citationIdx === -1) continue; // precedente não citado no draft — sem violação

      const window = draft.slice(
        Math.max(0, citationIdx - 600),
        Math.min(draft.length, citationIdx + 400),
      );

      // Caso 1 — Rejeição do pedido: o precedente fundamenta a improcedência/indeferimento.
      // O resultado da análise coincide com a tese do precedente. Uso correto — sem violação.
      if (REJECTION_NEAR_JUR_RE.test(window)) continue;

      // Caso 2 — Distinguishing explícito: o draft afasta o precedente por distinção de hipóteses.
      // Uso técnico correto — sem violação.
      if (DISTINGUISHING_RE.test(window)) continue;

      // Caso 3 — Violação: o precedente contrário é citado sem negar o pedido
      // e sem distinguishing → possível uso indevido como fundamento favorável.
      errors.push({
        rule: "EVIDENCE_STANCE_VIOLATION",
        message: `Jurisprudência contrária (${jur.tribunal}) citada sem distinguishing e sem indicar improcedência/indeferimento — use distinguishing para afastar o precedente, ou indique claramente que ele fundamenta a rejeição do pedido.`,
        fatal: true,
      });
    }

    return errors;
  }

  validateMatrix(
    matrix: ArgumentationMatrix,
    analyses: EvidenceAnalysis[],
  ): ValidationError[] {
    if (analyses.length === 0) return [];

    const errors: ValidationError[] = [];

    for (const tese of matrix.teses) {
      if (!tese.jurisprudencia_id) continue;
      const analysis = analyses.find((a) => a.id === tese.jurisprudencia_id);
      if (!analysis) continue;
      if (analysis.use_mode !== "FOUNDATION") {
        errors.push({
          rule: "EVIDENCE_STANCE_MATRIX",
          message: `Tese "${tese.pedido.slice(0, 60)}..." usa jurisprudência ${analysis.stance} (${analysis.use_mode}) como fundamento principal — apenas FOUNDATION permitido em jurisprudencia_id.`,
          fatal: true,
        });
      }
    }

    return errors;
  }

  private findCitationIndex(lowerDraft: string, jur: JurisprudenciaInput): number {
    const numIdx = lowerDraft.indexOf(jur.numero.toLowerCase());
    if (numIdx !== -1) return numIdx;
    if (jur.tribunal.length >= 3) {
      return lowerDraft.indexOf(jur.tribunal.toLowerCase());
    }
    return -1;
  }
}

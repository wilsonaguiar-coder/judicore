import type {
  ValidationError,
  EvidenceAnalysis,
  JurisprudenciaInput,
  ArgumentationMatrix,
} from "../pipeline/types.js";

const DISTINGUISHING_RE =
  /\b(embora|não\s+se\s+aplic|distingue[\s-]se|distinguishing|diversamente|a\s+hipótese\s+dos\s+autos\s+dife|superado|não\s+guarda\s+identidade|em\s+sentido\s+contrário|entendimento\s+contrário|precedente\s+contrário|não\s+obstante|em\s+que\s+pese|apesar\s+de)\b/i;

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
      if (citationIdx === -1) continue;

      if (!this.hasDistinguishingNear(draft, citationIdx)) {
        errors.push({
          rule: "EVIDENCE_STANCE_VIOLATION",
          message: `Jurisprudência contrária (${jur.tribunal}) citada sem distinguishing ou refutação — precedente contrário nunca pode fundamentar a tese favorável.`,
          fatal: true,
        });
      }
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

  private hasDistinguishingNear(draft: string, index: number): boolean {
    const window = draft.slice(
      Math.max(0, index - 600),
      Math.min(draft.length, index + 400),
    );
    return DISTINGUISHING_RE.test(window);
  }
}

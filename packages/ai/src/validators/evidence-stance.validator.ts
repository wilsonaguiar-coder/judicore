// EvidenceStanceValidator — verifica posicionamento de jurisprudências contrárias no draft.
//
// FASE 4.5 — DISTINGUISHING_RE reescrito:
//   Removidos: "embora", "não obstante", "em que pese", "apesar de"
//   (palavras de transição que não constituem distinguishing real).
//   Adicionados: regra de transição, hipótese dos autos distinta, peculiaridade fática,
//   precedente inaplicável, legislação local específica.
//
// Score contextual de distinguishing (0-3):
//   3 — distinguishing canônico com fundamento específico (distinguishing + razão explícita)
//   2 — padrão semântico válido (regra de transição, hipótese distinta, etc.)
//   1 — rejeição do pedido baseada no próprio precedente (uso correto caso 1)
//   0 — ausência de distinguishing → EVIDENCE_STANCE_VIOLATION

import type {
  ValidationError,
  EvidenceAnalysis,
  JurisprudenciaInput,
  ArgumentationMatrix,
} from "../pipeline/types.js";

// ── Distinguishing VÁLIDO (score ≥ 2) ────────────────────────────────────────
// Exige substância real — NÃO inclui "embora", "não obstante", "em que pese".

const STRONG_DISTINGUISHING_RE =
  /\b(distinguishing|distingue[\s-]se|distinguindo-se|a\s+hipótese\s+dos\s+autos\s+(?:difere|é\s+distinta)|não\s+se\s+aplic[ao]\s+(?:ao\s+caso|aqui|à\s+hipótese)|(?:o\s+)?precedente\s+(?:foi\s+)?superado|superado[ao]?\s+(?:o\s+)?(?:entendimento|precedente)|não\s+guarda\s+identidade\s+com|inaplicável\s+(?:ao\s+caso|à\s+hipótese|aqui)|situação\s+fática\s+distinta|peculiaridade\s+(?:do\s+caso|fática)|caso\s+concreto\s+(?:difere|é\s+distinto\s+do\s+paradigma)|regras?\s+de\s+transição|ingresso\s+(?:anterior|antes)\s+(?:à|à\s+vigência|da\s+promulgação)|ingressou\s+antes|legislação\s+(?:local|estadual|municipal)\s+específica|hipótese\s+(?:dos\s+autos\s+)?(?:difere|é\s+distinta|não\s+se\s+amolda)|distinguível\s+do\s+precedente|precedente\s+(?:não\s+(?:é\s+)?aplicável|inaplicável))\b/i;

// ── Rejeição do pedido (score 1 — uso correto do precedente contrário) ────────
// Indica que o precedente fundamenta a NEGATIVA — não há violação.

const REJECTION_NEAR_JUR_RE =
  /\b(?:não\s+(?:faz\s+jus|tem\s+direito|possui\s+direito|merece\s+(?:prosperar|acolhida)|há\s+(?:direito|amparo))|julgo\s+improcedente|improcedente|indefiro\s+o\s+pedido|nego\s+provimento|denego\s+a?\s*ordem|deve\s+ser\s+(?:negado|indeferido|julgado\s+improcedente)|sem\s+(?:direito|paridade|integralidade|amparo\s+legal)|razão\s+pela\s+qual.*?(?:improcede|indefiro|nego))\b/i;

// ── Score contextual de distinguishing ───────────────────────────────────────

function distinguishingScore(window: string): number {
  // Score 2: distinguishing canônico ou padrão semântico válido
  if (STRONG_DISTINGUISHING_RE.test(window)) return 2;
  // Score 1: rejeição do pedido baseada no precedente (uso correto)
  if (REJECTION_NEAR_JUR_RE.test(window)) return 1;
  // Score 0: nenhum distinguishing identificado
  return 0;
}

// ── EvidenceStanceValidator ───────────────────────────────────────────────────

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

      // Score contextual: 0 → violação; 1+ → uso correto (rejeição ou distinguishing)
      if (distinguishingScore(window) >= 1) continue;

      // Violação confirmada: precedente contrário citado sem distinguishing real
      // e sem usar o precedente para fundamentar a negativa do pedido.
      errors.push({
        rule: "EVIDENCE_STANCE_VIOLATION",
        message:
          `Jurisprudência contrária (${jur.tribunal} — ${jur.numero}) citada sem distinguishing ` +
          `substancial e sem fundamentar a rejeição do pedido. ` +
          `Padrões aceitos: distinguishing explícito (com fundamento específico), regra de transição, ` +
          `hipótese fática distinta, precedente superado, inaplicabilidade ao caso, ` +
          `ou uso do precedente para negar o pedido (improcedência/indeferimento).`,
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
          message:
            `Tese "${tese.pedido.slice(0, 60)}..." usa jurisprudência ${analysis.stance} ` +
            `(${analysis.use_mode}) como fundamento principal — apenas FOUNDATION permitido em jurisprudencia_id.`,
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

// StanceConsistencyValidator — verificação PRÉ-GERAÇÃO de coerência posicional.
//
// Detecta inversões de postura ANTES da geração da peça, evitando que o
// drafter produza documentos com posicionamento oposto ao esperado.
//
// Dois tipos de mismatch detectados:
//
//   1. EVIDENCE_STANCE_MATRIX já existe no EvidenceStanceValidator, mas
//      é executado apenas pós-geração. Aqui replicamos a verificação
//      PRÉ-GERAÇÃO para abortar antes de gerar o rascunho.
//
//   2. INVERSÃO DE PAPEL PROCESSUAL — a peça é PETICAO_INICIAL mas a
//      matrix argumenta a posição oposta (ex: arquivo impugnação × matrix
//      defendendo rejeição da impugnação).
//
// Retorna STANCE_MISMATCH_PRE_GENERATION (fatal) se qualquer mismatch for
// detectado. O pipeline aborta a geração ao receber este erro.

import type {
  ValidationError,
  ArgumentationMatrix,
  EvidenceAnalysis,
  TipoPeca,
} from "../pipeline/types.js";

// Ações do peticionante — indicam que a parte está APRESENTANDO um pedido
const PETITIONER_ACTION_RE =
  /\b(impugn[ao]|embargar|postular|requerer|pleitear|impugna[cç][aã]o\s+ao|embargos?\s+(à|de)|opor[-\s]se)\b/i;

// Linguagem de rejeição/negação — pertence ao juiz ou à parte contrária
// detecta frases como: "rejeitar a impugnação", "impugnação improcedente",
// "rejeitar os embargos", "negar provimento aos embargos"
const REJECTION_OF_PETITIONER_RE =
  /\b(rejeitar?\s+a\s+impugna[cç][aã]o|indeferir?\s+a\s+impugna[cç][aã]o|impugna[cç][aã]o\s+(improcedente|rejeitada|indeferida)|rejeitar?\s+os\s+embargos?|embargos?\s+(rejeitados?|improcedentes?|indeferidos?)|negar?\s+provimento\s+ao[s]?\s+embargos?|julgar\s+improcedentes?\s+(a\s+impugna[cç][aã]o|os\s+embargos?))\b/i;

export class StanceConsistencyValidator {
  /**
   * Verifica coerência posicional ANTES da geração da peça.
   *
   * @param matrix       Matriz de argumentação recém-construída.
   * @param tipoPeca     Tipo do documento a ser gerado.
   * @param caseDescription  Descrição do caso (usada para detectar ação do peticionante).
   * @param analyses     Análises de posicionamento das jurisprudências.
   */
  validatePreGeneration(
    matrix: ArgumentationMatrix,
    tipoPeca: TipoPeca,
    caseDescription: string,
    analyses: EvidenceAnalysis[],
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Verificação 1 — jurisprudência CONTRARIA usada como FOUNDATION na matrix.
    // Repete o check do EvidenceStanceValidator.validateMatrix(), mas PRÉ-geração
    // para abortar antes de criar um rascunho com posicionamento invertido.
    for (const tese of matrix.teses) {
      if (!tese.jurisprudencia_id) continue;
      const analysis = analyses.find((a) => a.id === tese.jurisprudencia_id);
      if (!analysis) continue;
      if (analysis.stance === "CONTRARIO" && analysis.use_mode === "FOUNDATION") {
        errors.push({
          rule: "STANCE_MISMATCH_PRE_GENERATION",
          message:
            `Tese "${tese.pedido.slice(0, 60)}..." usa jurisprudência CONTRÁRIA como fundamento ` +
            `FOUNDATION — posição da matriz incompatível com a tese defendida. ` +
            `Geração abortada para evitar EVIDENCE_STANCE_VIOLATION no rascunho.`,
          fatal: true,
        });
      }
    }

    // Se já detectou mismatch de evidence, não precisamos continuar
    if (errors.length > 0) return errors;

    // Verificação 2 — inversão de papel processual em PETICAO_INICIAL.
    // Detecta quando a matriz foi construída para a posição oposta à que a
    // petição inicial deve defender.
    // Ex: caso descreve "impugnar cumprimento" mas matrix conclui "rejeitar impugnação".
    if (tipoPeca === "PETICAO_INICIAL" && PETITIONER_ACTION_RE.test(caseDescription)) {
      for (const tese of matrix.teses) {
        const pedidoText = tese.pedido.toLowerCase();
        const conclusaoText = (tese.conclusao ?? "").toLowerCase();
        if (
          REJECTION_OF_PETITIONER_RE.test(pedidoText) ||
          REJECTION_OF_PETITIONER_RE.test(conclusaoText)
        ) {
          errors.push({
            rule: "STANCE_MISMATCH_PRE_GENERATION",
            message:
              `Inversão de papel processual detectada: o caso descreve uma ação do ` +
              `peticionante (impugnar/embargar) mas a tese "${tese.pedido.slice(0, 60)}..." ` +
              `defende a posição oposta (rejeitar/indeferir). Geração abortada.`,
            fatal: true,
          });
          break;
        }
      }
    }

    return errors;
  }
}

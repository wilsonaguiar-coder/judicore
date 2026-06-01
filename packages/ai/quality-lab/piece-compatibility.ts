// PieceCompatibilityValidator — Matriz de compatibilidade entre tema e tipo de peça.
//
// Certos temas só fazem sentido em tipos específicos de documento:
//
//   Decisões incidentais criminais (liberdade provisória, revogação de preventiva,
//   progressão de regime, HC) → nunca geram SENTENÇA, pois não envolvem julgamento
//   do mérito da ação penal. O documento correto é DECISÃO (ou ACÓRDÃO em 2ª instância).
//
// A matriz é a fonte única de verdade:
//   - Importada por case-factory.ts para prevenir geração de casos inválidos.
//   - Importada por quality-runner.ts para validação de segurança antes de rodar.
//
// Uso:
//   PieceCompatibilityValidator.isCompatible("crim_hc_liberatorio", "SENTENCA") → false
//   PieceCompatibilityValidator.getCompatibleTypes("crim_preventiva") → ["PETICAO_INICIAL", "RECURSO", "DECISAO"]

import type { TipoPeca } from "../src/pipeline/types.js";

// Fases completas — padrão para temas de mérito (sentença definitiva cabível)
export const ALL_PHASES: readonly TipoPeca[] = [
  "PETICAO_INICIAL",
  "RECURSO",
  "DECISAO",
  "SENTENCA",
];

// Fases sem SENTENÇA — para procedimentos incidentais que resultam em DECISÃO
export const PHASES_NO_SENTENCA: readonly TipoPeca[] = [
  "PETICAO_INICIAL",
  "RECURSO",
  "DECISAO",
];

// ── Matriz de compatibilidade por tema ───────────────────────────────────────
//
// Temas ausentes desta tabela → ALL_PHASES (todas as fases permitidas).
//
// Critérios para restrição:
//   • Procedimentos incidentais criminais (liberdade provisória, prisão preventiva,
//     progressão de regime, HC) → sem SENTENÇA. Resultado processual é sempre
//     uma DECISÃO interlocutória ou ACÓRDÃO; nunca sentença de mérito penal.
//   • O julgamento do mérito em ação penal (SENTENÇA com ABSOLVO/CONDENO) ocorre
//     apenas quando há processo-crime completo — não nesses procedimentos cautelares.

export const PIECE_COMPATIBILITY: Readonly<Record<string, readonly TipoPeca[]>> = {
  // ── Criminal — procedimentos incidentais (sem SENTENÇA) ──────────────────
  crim_hc_liberatorio:       PHASES_NO_SENTENCA,  // HC resulta em concessão/denegação da ordem (DECISÃO)
  crim_liberdade_provisoria: PHASES_NO_SENTENCA,  // DEFIRO/INDEFIRO a liberdade provisória (DECISÃO)
  crim_preventiva:           PHASES_NO_SENTENCA,  // REVOGO/MANTENHO a preventiva (DECISÃO)
  crim_progressao:           PHASES_NO_SENTENCA,  // DEFIRO/INDEFIRO progressão de regime (DECISÃO)
};

// ── PieceCompatibilityValidator ──────────────────────────────────────────────

export interface PieceCompatibilityResult {
  valid: boolean;
  rule: "INCOMPATIBLE_PIECE_TYPE" | null;
  message: string | null;
  compatibleTypes: readonly TipoPeca[];
  suggestedType: TipoPeca | null;
}

export class PieceCompatibilityValidator {
  /** Tipos de peça permitidos para o tema. */
  static getCompatibleTypes(themeId: string): readonly TipoPeca[] {
    return PIECE_COMPATIBILITY[themeId] ?? ALL_PHASES;
  }

  /** Verifica se a combinação tema+tipo é válida. */
  static isCompatible(themeId: string, documentType: TipoPeca): boolean {
    return this.getCompatibleTypes(themeId).includes(documentType);
  }

  /**
   * Valida a combinação e, se inválida, sugere o tipo mais adequado.
   * Para temas sem SENTENÇA, sugere DECISAO como substituto.
   */
  static validate(themeId: string, documentType: TipoPeca): PieceCompatibilityResult {
    const compatibleTypes = this.getCompatibleTypes(themeId);

    if (compatibleTypes.includes(documentType)) {
      return { valid: true, rule: null, message: null, compatibleTypes, suggestedType: null };
    }

    // Sugere o tipo mais próximo ao solicitado
    const suggestedType: TipoPeca =
      documentType === "SENTENCA" && compatibleTypes.includes("DECISAO")
        ? "DECISAO"
        : compatibleTypes[compatibleTypes.length - 1]!;

    return {
      valid: false,
      rule: "INCOMPATIBLE_PIECE_TYPE",
      message: `Tema "${themeId}" não gera ${documentType} — tipo processual correto: ${suggestedType}. Permitidos: ${compatibleTypes.join(", ")}`,
      compatibleTypes,
      suggestedType,
    };
  }
}

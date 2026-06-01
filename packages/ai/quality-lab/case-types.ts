// Tipos do Quality Lab — casos sintéticos e resultados de execução.

import type {
  JurisprudenciaInput,
  TipoPeca,
  GenerationMode,
  DocumentStatus,
} from "../src/pipeline/types.js";

export type LegalArea = "RPPS" | "RGPS" | "TRABALHISTA" | "CRIMINAL" | "CIVEL";

// Tipos de armadilhas jurídicas inseridas em ~30% dos casos
export type TrapKind =
  | "JURISPRUDENCIA_CONTRARIA"   // precedente contrário não distinguido
  | "ARTIGO_INCOMPATIVEL"        // ex: RPPS com art. 201 CF, criminal com art. 85 CPC
  | "RECURSO_INADEQUADO"         // ex: trabalhista com apelação, JEF com apelação
  | "COMPETENCIA_INCORRETA"      // ex: STJ em matéria trabalhista
  | "TESE_EQUIVOCADA"            // tese juridicamente errada
  | "PRECEDENTE_SUPERADO"        // súmula/precedente já revogado
  | "FATO_INCOMPLETO"            // descrição faltando elementos essenciais
  | "LINGUAGEM_DECISORIA";       // despacho com "defiro/julgo"

export interface SyntheticCase {
  id: string;
  area: LegalArea;
  documentType: TipoPeca;
  theme: string;                 // chave do tema (ex: "rpps_paridade")
  themeLabel: string;            // rótulo legível
  title: string;
  caseDescription: string;
  instruction?: string;
  jurisprudencias?: JurisprudenciaInput[];
  trap?: TrapKind;               // armadilha inserida (se houver)
  expectedRulesIfTrap?: string[]; // regras esperadas como crítica quando há trap
}

export type ValidatorComponent =
  | "EvidenceAnalyzer"
  | "LegalValidator"
  | "AppealValidator"
  | "StructuralValidator"
  | "FinalValidator"
  | "JurisprudenceValidator"
  | "GenericityValidator"
  | "MatrixQualityValidator"
  | "RichnessValidator"
  | "Other";

/** Mapeia uma rule de ValidationError para o validator que a emitiu. */
export function mapRuleToValidator(rule: string): ValidatorComponent {
  if (rule.startsWith("EVIDENCE_")) return "EvidenceAnalyzer";
  if (rule.startsWith("MATRIX_")) return "MatrixQualityValidator";
  if (rule.startsWith("RICHNESS_") || rule === "FINAL_DRAFT_GENERIC_LANGUAGE") return "RichnessValidator";
  if (
    rule === "JUR_MARKER_IN_DRAFT" ||
    rule === "GENERIC_JURISPRUDENCE" ||
    rule === "TRIBUNAL_MISMATCH"
  ) return "JurisprudenceValidator";
  if (
    rule === "INCOMPATIBLE_APPEAL" ||
    rule === "WRONG_SUPERIOR_COURT" ||
    rule === "JEF_JEC_WRONG_APPEAL" ||
    rule === "CRIMINAL_WRONG_APPEAL"
  ) return "AppealValidator";
  if (
    rule === "MISSING_STRUCTURE" ||
    rule === "DESPACHO_WITH_DECISION_LANGUAGE" ||
    rule === "FORBIDDEN_STRUCTURE"
  ) return "StructuralValidator";
  if (
    rule === "RPPS_WRONG_ARTICLE" ||
    rule === "RGPS_WRONG_ARTICLE" ||
    rule === "WRONG_HONORARIOS" ||
    rule === "WRONG_HONORARIOS_CRIMINAL" ||
    rule === "BLOCKED_ARTICLE" ||
    rule === "PROHIBITED_TERM" ||
    rule === "CRIMINAL_WRONG_TERM" ||
    rule === "REQUIRED_FIELD" ||
    rule === "LOW_CONFIDENCE"
  ) return "LegalValidator";
  return "Other";
}

export interface CaseResult {
  caseId: string;
  area: LegalArea;
  documentType: TipoPeca;
  theme: string;
  themeLabel: string;
  title: string;
  trap?: TrapKind;
  trapDetected?: boolean;        // legacy: true se DETECTED ou AVOIDED
  trapOutcome?: "DETECTED" | "AVOIDED" | "MISSED";
  status: "success" | "error";
  errorMessage?: string;
  mode?: GenerationMode;
  documentStatus?: DocumentStatus;
  score?: number;
  safeMessage?: string;
  validationErrors: { rule: string; message: string; fatal: boolean }[];
  auditErrors: string[];
  draft?: string;
  draftExcerpt?: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
}

// ── Estatísticas ─────────────────────────────────────────────────────────────

export interface AreaStats {
  total: number;
  approved: number;
  withCaveats: number;
  rejected: number;
  avgScore: number;
}

export interface ThemeStats extends AreaStats {
  themeLabel: string;
  area: LegalArea;
  trapTotal: number;
  trapDetected: number;
  trapAvoided: number;
  trapMissed: number;
  topCriticalRules: { rule: string; count: number }[];
}

export interface ValidatorStats {
  fatal: number;
  nonFatal: number;
  topRules: { rule: string; count: number }[];
}

export interface RunSummary {
  generatedAt: string;
  totalCases: number;
  succeeded: number;
  failed: number;
  approved: number;
  approvedWithCaveats: number;
  rejected: number;
  avgScore: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
  byArea: Record<LegalArea, AreaStats>;
  byDocumentType: Record<string, AreaStats>;
  byTheme: Record<string, ThemeStats>;
  byValidator: Record<ValidatorComponent, ValidatorStats>;
  trapStats: {
    totalWithTraps: number;
    detected: number;
    avoided: number;
    missed: number;
    byKind: Record<string, { total: number; detected: number; avoided: number; missed: number }>;
  };
  topCriticalRules: { rule: string; count: number }[];
  results: CaseResult[];
}

// ── Pricing aproximado do gpt-4.1 ────────────────────────────────────────────
export const GPT41_INPUT_USD_PER_1M = 2.0;
export const GPT41_OUTPUT_USD_PER_1M = 8.0;

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * GPT41_INPUT_USD_PER_1M +
    (outputTokens / 1_000_000) * GPT41_OUTPUT_USD_PER_1M
  );
}

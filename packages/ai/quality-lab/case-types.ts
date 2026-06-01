// Tipos do Quality Lab — casos sintéticos e resultados de execução.

import type {
  JurisprudenciaInput,
  TipoPeca,
  GenerationMode,
  DocumentStatus,
} from "../src/pipeline/types.js";

export type LegalArea = "RPPS" | "RGPS" | "TRABALHISTA" | "CRIMINAL" | "CIVEL";

export interface SyntheticCase {
  id: string;
  area: LegalArea;
  documentType: TipoPeca;
  title: string;
  caseDescription: string;
  instruction?: string;
  jurisprudencias?: JurisprudenciaInput[];
  expectedBehavior?: {
    expectedMode?: GenerationMode;
    mustContain?: string[];
    mustNotContain?: string[];
    shouldUseDistinguishing?: boolean;
  };
}

export interface CaseResult {
  caseId: string;
  area: LegalArea;
  documentType: TipoPeca;
  title: string;
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

export interface RunSummary {
  generatedAt: string;
  totalCases: number;
  succeeded: number;
  failed: number;
  approved: number;             // MINUTA APROVADA
  approvedWithCaveats: number;  // APROVADA COM RESSALVAS
  rejected: number;             // REPROVADA
  avgScore: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
  byArea: Record<LegalArea, AreaStats>;
  byDocumentType: Record<string, AreaStats>;
  topCriticalRules: { rule: string; count: number }[];
  results: CaseResult[];
}

export interface AreaStats {
  total: number;
  approved: number;
  withCaveats: number;
  rejected: number;
  avgScore: number;
}

// Pricing aproximado do gpt-4.1 (USD/1M tokens)
export const GPT41_INPUT_USD_PER_1M = 2.0;
export const GPT41_OUTPUT_USD_PER_1M = 8.0;

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * GPT41_INPUT_USD_PER_1M +
    (outputTokens / 1_000_000) * GPT41_OUTPUT_USD_PER_1M
  );
}

/**
 * FASE 9.0.6 — Tipos do Gold Corpus Regression Runner
 *
 * Interfaces de resultado e sumário para comparação dos outputs do reviewer
 * contra os gabaritos do Gold Corpus V1.
 *
 * Regras de design:
 * - Sem lógica executável — apenas tipos e interface mínima de reviewer.
 * - ReviewerLike permite injeção de mock nos testes sem depender do serviço real.
 */

import type { AiLegalStrengthReviewRequest } from "../dto/ai-legal-strength-review-request.js";
import type { AiLegalStrengthReviewResult } from "../dto/ai-legal-strength-review-result.js";

// ─── Interface mínima para injeção de reviewer real ou mock ──────────────────

export interface ReviewerLike {
  review(request: AiLegalStrengthReviewRequest): Promise<AiLegalStrengthReviewResult>;
}

// ─── Resultado por caso ───────────────────────────────────────────────────────

export interface GoldCorpusRegressionResult {
  /** ID do caso no corpus (ex.: "RGPS-001"). */
  caseId: string;
  domain: string;
  documentType: string;
  quality: string;
  difficulty: string;

  /** Faixa de score esperada conforme gabarito. */
  expectedScoreRange: { min: number; max: number };

  /** Score derivado dos findings retornados pelo reviewer. */
  actualScore: number;

  /** true se actualScore está dentro de expectedScoreRange. */
  scorePass: boolean;

  /** Findings esperados conforme gabarito (strings descritivas). */
  expectedFindings: string[];

  /** Textos concatenados dos findings gerados pelo reviewer. */
  actualFindings: string[];

  /** Subconjunto de expectedFindings que teve correspondência semântica com algum actualFinding. */
  matchedExpectedFindings: string[];

  /** Subconjunto de expectedFindings que NÃO teve correspondência — indica regressão. */
  missingExpectedFindings: string[];

  /**
   * Findings proibidos — lista de padrões textuais que o reviewer NÃO deveria gerar
   * (vem de GoldCorpusCase.unexpectedFindings).
   */
  unexpectedFindings: string[];

  /** Subconjunto de actualFindings que corresponderam a algum padrão proibido. */
  unexpectedForbiddenFindings: string[];

  /**
   * Caso passou se:
   *   scorePass && findingPass && unexpectedForbiddenFindings.length === 0
   */
  pass: boolean;
}

// ─── Sumário agregado ─────────────────────────────────────────────────────────

export interface GoldCorpusRegressionSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;

  /** Proporção de casos que passaram (0–1). */
  passRate: number;

  /** Proporção de casos em que o score ficou dentro da faixa esperada. */
  scorePassRate: number;

  /** Proporção de casos em que ao menos um expectedFinding foi encontrado (ou expectedFindings vazio). */
  findingPassRate: number;

  results: GoldCorpusRegressionResult[];

  byDomain: Record<
    string,
    { total: number; passed: number; failed: number; passRate: number }
  >;

  byQuality: Record<
    string,
    { total: number; passed: number; failed: number; passRate: number }
  >;
}

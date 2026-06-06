/**
 * FASE 9.0.8.3 — Tipos da Camada de Revisão Humana
 *
 * Nenhuma lógica executável — apenas interfaces e tipos.
 *
 * Design:
 * - Agnóstico a provider (providerId: string, não LiveProviderId).
 * - Domínio inferido do caseId pelo serviço (sem campo redundante).
 * - Sem dependência de gold corpus, regression runner ou live benchmark.
 */

// ─── Avaliação individual de finding ─────────────────────────────────────────

export interface HumanReviewFindingEvaluation {
  /** ID do finding conforme retornado pelo provider (AiLegalStrengthFinding.id). */
  findingId: string;

  /** "O finding é juridicamente correto?" */
  isLegallyCorrect: boolean;

  /** "Esse finding realmente merece atenção?" */
  isRelevant: boolean;

  /** "O advogado conseguiria melhorar a peça usando esse finding?" */
  isActionable: boolean;

  /** Notas livres do revisor. */
  reviewerNotes?: string;

  /**
   * Score geral do finding.
   * 1=inútil | 2=fraco | 3=razoável | 4=bom | 5=excelente
   */
  score: 1 | 2 | 3 | 4 | 5;
}

// ─── Avaliação de um caso (conjunto de findings de um provider) ───────────────

export interface HumanReviewCaseEvaluation {
  /** ID do caso no corpus (ex.: "RGPS-002"). */
  caseId: string;

  /** Provider que gerou os findings (ex.: "openai"). */
  providerId: string;

  /** Identificador do revisor humano (ex.: "advogado-joao"). */
  reviewerId: string;

  /** Avaliações individuais dos findings retornados pelo provider. */
  evaluations: HumanReviewFindingEvaluation[];

  /**
   * Score geral da análise completa do caso.
   * 1=inútil | 2=fraco | 3=razoável | 4=bom | 5=excelente
   */
  overallScore: 1 | 2 | 3 | 4 | 5;

  /** Comentários livres sobre a análise do caso. */
  comments?: string;
}

// ─── Fatia de métricas ────────────────────────────────────────────────────────

export interface HumanReviewMetricSlice {
  totalFindingsReviewed: number;
  totalCasesReviewed: number;

  /** Proporção de findings avaliados como juridicamente corretos (0–1). */
  legallyCorrectRate: number;

  /** Proporção de findings avaliados como relevantes (0–1). */
  relevanceRate: number;

  /** Proporção de findings avaliados como acionáveis (0–1). */
  actionabilityRate: number;

  /** Score médio dos findings (escala 1–5; 0 quando sem dados). */
  averageScore: number;

  /**
   * Human Validated Quality Score (HVQS) — 0 a 1.
   * Fórmula: correctnessRate*0.40 + relevanceRate*0.30 + actionabilityRate*0.20 + normalizedScore*0.10
   * onde normalizedScore = (averageScore - 1) / 4.
   */
  humanValidatedQualityScore: number;
}

// ─── Sumário agregado ─────────────────────────────────────────────────────────

export interface HumanReviewSummary extends HumanReviewMetricSlice {
  byProvider: Record<string, HumanReviewMetricSlice>;
  byDomain: Record<string, HumanReviewMetricSlice>;
}

// ─── Amostrador ───────────────────────────────────────────────────────────────

/** Resultado do benchmark que pode ser amostrado para revisão humana. */
export interface SampleableResult {
  caseId: string;
  providerId: string;
  /** Qualidade do caso conforme o corpus. Opcional — usado para distribuição. */
  quality?: string;
}

/** Uma entrada selecionada pelo amostrador para revisão humana. */
export interface HumanReviewSampleEntry {
  caseId: string;
  providerId: string;
  /** Qualidade do caso (null quando não disponível). */
  quality: string | null;
  selectionReason: "good_representative" | "problematic_representative" | "random";
}

export interface HumanReviewSamplerOptions {
  /** Quantos casos selecionar por provider. */
  casesPerProvider: number;
  /** Garantir ao menos um caso GOOD por provider (default: true). */
  requireAtLeastOneGood: boolean;
  /** Garantir ao menos um caso com issue por provider (default: true). */
  requireAtLeastOneProblematic: boolean;
}

// ─── Relatório de validade do benchmark ──────────────────────────────────────

/** Resultado do benchmark automatizado para comparação com avaliação humana. */
export interface AutomatedBenchmarkResult {
  caseId: string;
  providerId: string;
  /** true se o caso passou no benchmark automatizado. */
  pass: boolean;
}

/** Entrada de concordância para um par (caseId, providerId). */
export interface BenchmarkConcordanceEntry {
  caseId: string;
  providerId: string;
  benchmarkPassed: boolean;
  humanOverallScore: number; // 1–5
  humanQualityScore: number; // 0–1 (normalizado)
  isAgreement: boolean;
  /** Benchmark aprovou; humano avalia como baixa qualidade (score ≤ 2). */
  isBenchmarkFalsePositive: boolean;
  /** Benchmark reprovou; humano avalia como alta qualidade (score ≥ 4). */
  isBenchmarkFalseNegative: boolean;
}

/** Relatório comparativo: benchmark automatizado vs. avaliação humana. */
export interface BenchmarkValidityReport {
  /** Número de pares (caseId, providerId) com ambas as avaliações disponíveis. */
  totalCompared: number;

  /** Taxa de concordância (0–1). */
  agreementRate: number;

  /** Proporção de falsos positivos do benchmark (0–1). */
  benchmarkFalsePositiveRate: number;

  /** Proporção de falsos negativos do benchmark (0–1). */
  benchmarkFalseNegativeRate: number;

  /** Correlação de Pearson entre aprovação do benchmark e score humano normalizado (-1 a 1). */
  pearsonCorrelation: number;

  entries: BenchmarkConcordanceEntry[];
}

/**
 * FASE 9.0.7 — Tipos das Métricas de Precisão do Gold Corpus
 *
 * Regras de design:
 * - Sem lógica executável — apenas tipos.
 * - Todas as métricas de proporção ficam em [0, 1].
 * - GoldCorpusMetricSlice é reutilizado por domínio, qualidade e agregado.
 */

export interface GoldCorpusMetricSlice {
  totalCases: number;

  /** TP / (TP + FP) — proporção dos findings gerados que eram esperados. */
  findingPrecision: number;

  /** TP / (TP + FN) — proporção dos findings esperados que foram gerados. */
  findingRecall: number;

  /** 2 * precision * recall / (precision + recall) */
  findingF1: number;

  /** Casos com score dentro da faixa esperada / totalCases. */
  scorePassRate: number;

  /** Casos que passaram / totalCases. */
  casePassRate: number;

  /** Findings inesperados gerados que não deveriam ter sido gerados. */
  falsePositiveCount: number;

  /** Findings esperados que não foram encontrados. */
  falseNegativeCount: number;

  /** Findings esperados encontrados corretamente. */
  truePositiveCount: number;
}

export interface GoldCorpusMetrics extends GoldCorpusMetricSlice {
  byDomain: Record<string, GoldCorpusMetricSlice>;
  byQuality: Record<string, GoldCorpusMetricSlice>;
}

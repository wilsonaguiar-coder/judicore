/**
 * FASE 9.0.8.3 — Serviço de Relatório de Validade do Benchmark
 *
 * Responsabilidades:
 * - Comparar resultados automatizados vs. avaliação humana.
 * - Calcular taxa de concordância, FP, FN e correlação de Pearson.
 *
 * Regras de design:
 * - Sem I/O, sem chamadas de rede, sem side effects.
 * - Nunca retorna NaN ou Infinity.
 * - Correlação de Pearson retorna 0 quando variância é zero.
 */

import type {
  AutomatedBenchmarkResult,
  BenchmarkConcordanceEntry,
  BenchmarkValidityReport,
  HumanReviewCaseEvaluation,
} from "./human-review.types.js";

// ─── Pearson ──────────────────────────────────────────────────────────────────

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0) return 0;

  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i]!;
    sumY += ys[i]!;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0, varX = 0, varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num  += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const denominator = Math.sqrt(varX * varY);
  if (denominator === 0) return 0;
  const r = num / denominator;
  if (!isFinite(r) || isNaN(r)) return 0;
  return r;
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class HumanReviewReportService {

  /**
   * Gera relatório comparativo entre benchmark automatizado e avaliação humana.
   *
   * Emparelha (caseId, providerId). Pares sem correspondência em ambos os lados
   * são ignorados. Score humano normalizado = (overallScore - 1) / 4.
   *
   * FP: benchmark aprovado + overallScore ≤ 2.
   * FN: benchmark reprovado + overallScore ≥ 4.
   * Concordância: nem FP nem FN.
   */
  generateValidityReport(
    humanEvals: HumanReviewCaseEvaluation[],
    automatedResults: AutomatedBenchmarkResult[],
  ): BenchmarkValidityReport {

    // Índice de resultados automatizados por chave "caseId|providerId"
    const autoMap = new Map<string, AutomatedBenchmarkResult>();
    for (const r of automatedResults) {
      autoMap.set(`${r.caseId}|${r.providerId}`, r);
    }

    const entries: BenchmarkConcordanceEntry[] = [];

    for (const h of humanEvals) {
      const key = `${h.caseId}|${h.providerId}`;
      const auto = autoMap.get(key);
      if (!auto) continue;

      const humanQualityScore = (h.overallScore - 1) / 4;
      const isFP = auto.pass && h.overallScore <= 2;
      const isFN = !auto.pass && h.overallScore >= 4;

      entries.push({
        caseId: h.caseId,
        providerId: h.providerId,
        benchmarkPassed: auto.pass,
        humanOverallScore: h.overallScore,
        humanQualityScore,
        isAgreement: !isFP && !isFN,
        isBenchmarkFalsePositive: isFP,
        isBenchmarkFalseNegative: isFN,
      });
    }

    const total = entries.length;

    if (total === 0) {
      return {
        totalCompared: 0,
        agreementRate: 0,
        benchmarkFalsePositiveRate: 0,
        benchmarkFalseNegativeRate: 0,
        pearsonCorrelation: 0,
        entries: [],
      };
    }

    const agreements = entries.filter((e) => e.isAgreement).length;
    const fps        = entries.filter((e) => e.isBenchmarkFalsePositive).length;
    const fns        = entries.filter((e) => e.isBenchmarkFalseNegative).length;

    const xs = entries.map((e) => e.benchmarkPassed ? 1 : 0);
    const ys = entries.map((e) => e.humanQualityScore);

    return {
      totalCompared: total,
      agreementRate: agreements / total,
      benchmarkFalsePositiveRate: fps / total,
      benchmarkFalseNegativeRate: fns / total,
      pearsonCorrelation: pearson(xs, ys),
      entries,
    };
  }
}

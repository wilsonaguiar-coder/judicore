/**
 * FASE 9.0.7 — Serviço de Métricas de Precisão do Gold Corpus
 *
 * Transforma um GoldCorpusRegressionSummary em métricas quantitativas
 * (precision, recall, F1, scorePassRate, casePassRate) agregadas por domínio e qualidade.
 *
 * Regras de design:
 * - Sem chamadas de rede, sem I/O, sem side effects.
 * - Nunca retorna NaN ou Infinity.
 * - Não altera o summary recebido.
 * - FP para casos GOOD inclui todo actualFinding (não apenas os proibidos),
 *   pois o gabarito espera zero findings para peças sem problemas planejados.
 */

import type { GoldCorpusRegressionResult, GoldCorpusRegressionSummary } from "./gold-corpus-regression.types.js";
import type { GoldCorpusMetricSlice, GoldCorpusMetrics } from "./gold-corpus-metrics.types.js";

// ─── Contagens por caso ───────────────────────────────────────────────────────

interface CaseCounts {
  tp: number;
  fp: number;
  fn: number;
  scorePass: number;
  casePass: number;
}

function countsForResult(r: GoldCorpusRegressionResult): CaseCounts {
  const tp = r.matchedExpectedFindings.length;
  const fn = r.missingExpectedFindings.length;

  let fp: number;
  if (r.quality === "GOOD") {
    // Para casos GOOD o gabarito espera zero findings — todo finding gerado é FP
    fp = r.actualFindings.length;
  } else {
    fp = r.unexpectedForbiddenFindings.length;
  }

  return {
    tp,
    fp,
    fn,
    scorePass: r.scorePass ? 1 : 0,
    casePass: r.pass ? 1 : 0,
  };
}

// ─── Métricas a partir de contagens agregadas ─────────────────────────────────

function computePrecision(tp: number, fp: number, fn: number): number {
  if (tp + fp === 0) {
    // Nenhum finding foi gerado
    return tp + fn === 0
      ? 1   // nada esperado, nada gerado → perfeito
      : 0;  // havia esperados, nada foi gerado → precision inválida, penalizar como 0
  }
  return tp / (tp + fp);
}

function computeRecall(tp: number, fn: number): number {
  if (tp + fn === 0) return 1; // nada a recordar → vacuously perfeito
  return tp / (tp + fn);
}

function computeF1(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

function buildSlice(results: GoldCorpusRegressionResult[]): GoldCorpusMetricSlice {
  if (results.length === 0) {
    return {
      totalCases: 0,
      findingPrecision: 1,
      findingRecall: 1,
      findingF1: 1,
      scorePassRate: 0,
      casePassRate: 0,
      falsePositiveCount: 0,
      falseNegativeCount: 0,
      truePositiveCount: 0,
    };
  }

  let totalTp = 0;
  let totalFp = 0;
  let totalFn = 0;
  let totalScorePass = 0;
  let totalCasePass = 0;

  for (const r of results) {
    const c = countsForResult(r);
    totalTp += c.tp;
    totalFp += c.fp;
    totalFn += c.fn;
    totalScorePass += c.scorePass;
    totalCasePass += c.casePass;
  }

  const precision = computePrecision(totalTp, totalFp, totalFn);
  const recall = computeRecall(totalTp, totalFn);
  const f1 = computeF1(precision, recall);

  return {
    totalCases: results.length,
    findingPrecision: precision,
    findingRecall: recall,
    findingF1: f1,
    scorePassRate: totalScorePass / results.length,
    casePassRate: totalCasePass / results.length,
    falsePositiveCount: totalFp,
    falseNegativeCount: totalFn,
    truePositiveCount: totalTp,
  };
}

// ─── Serviço público ──────────────────────────────────────────────────────────

export class GoldCorpusMetricsService {
  calculate(summary: GoldCorpusRegressionSummary): GoldCorpusMetrics {
    const results = summary.results;

    // Agrupa por domínio
    const domainGroups: Record<string, GoldCorpusRegressionResult[]> = {};
    for (const r of results) {
      (domainGroups[r.domain] ??= []).push(r);
    }

    // Agrupa por qualidade
    const qualityGroups: Record<string, GoldCorpusRegressionResult[]> = {};
    for (const r of results) {
      (qualityGroups[r.quality] ??= []).push(r);
    }

    const byDomain: Record<string, GoldCorpusMetricSlice> = {};
    for (const [domain, group] of Object.entries(domainGroups)) {
      byDomain[domain] = buildSlice(group);
    }

    const byQuality: Record<string, GoldCorpusMetricSlice> = {};
    for (const [quality, group] of Object.entries(qualityGroups)) {
      byQuality[quality] = buildSlice(group);
    }

    return {
      ...buildSlice(results),
      byDomain,
      byQuality,
    };
  }
}

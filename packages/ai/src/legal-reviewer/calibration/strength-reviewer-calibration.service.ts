import type { StrengthReviewTelemetryService } from "../telemetry/strength-review-telemetry.service.js";
import type {
  StrengthReviewExecutionRecord,
  StrengthReviewFeedbackRecord,
  TelemetryRecord,
} from "../telemetry/telemetry.types.js";
import type {
  CalibrationReport,
  FindingQualityEntry,
  ConfidenceBand,
  DomainCalibration,
  ProviderComparisonEntry,
  GenericityAlert,
  BestExample,
  Recommendation,
  DataQuality,
} from "./calibration.types.js";

/** Threshold para considerar um finding genérico (aparece em >80% das execuções). */
const GENERICITY_THRESHOLD = 0.80;
/** Execuções mínimas para dados suficientes. */
const MIN_EXECUTIONS = 20;
/** Feedbacks mínimos para dados suficientes. */
const MIN_FEEDBACKS = 10;
/** Número máximo de melhores exemplos por finding type. */
const MAX_EXAMPLES_PER_TYPE = 3;

export class StrengthReviewerCalibrationService {
  constructor(private readonly telemetry: StrengthReviewTelemetryService) {}

  calibrate(): CalibrationReport {
    const records = this.telemetry.getRawRecords();
    const executions = records.filter((r): r is StrengthReviewExecutionRecord => r.recordType === "EXECUTION");
    const feedbacks = records.filter((r): r is StrengthReviewFeedbackRecord => r.recordType === "FEEDBACK");

    const dataQuality = buildDataQuality(executions.length, feedbacks.length);
    const findingQuality = buildFindingQuality(executions, feedbacks);
    const sorted = [...findingQuality].sort((a, b) => b.qualityScore - a.qualityScore);
    const topPerformers = sorted.filter(e => e.qualityScore >= 0.7).slice(0, 5);
    const lowPerformers = [...findingQuality]
      .sort((a, b) => a.qualityScore - b.qualityScore)
      .filter(e => e.qualityScore < 0.5)
      .slice(0, 5);

    return {
      generatedAt: new Date().toISOString(),
      dataQuality,
      findingQuality,
      topPerformers,
      lowPerformers,
      genericityAlerts: buildGenericityAlerts(findingQuality, executions.length),
      confidenceBands: buildConfidenceBands(executions, feedbacks),
      domainCalibration: buildDomainCalibration(executions, feedbacks),
      providerComparison: buildProviderComparison(executions, feedbacks),
      bestExamples: buildBestExamples(executions, feedbacks),
      recommendations: buildRecommendations(findingQuality, dataQuality, executions, feedbacks),
    };
  }
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function buildDataQuality(totalExecutions: number, totalFeedbacks: number): DataQuality {
  const coverage = totalExecutions > 0 ? Number((totalFeedbacks / totalExecutions).toFixed(2)) : 0;
  const sufficientData = totalExecutions >= MIN_EXECUTIONS && totalFeedbacks >= MIN_FEEDBACKS;

  let warning: string | undefined;
  if (!sufficientData) {
    if (totalExecutions < MIN_EXECUTIONS && totalFeedbacks < MIN_FEEDBACKS) {
      warning = `Dados insuficientes: ${totalExecutions} execuções e ${totalFeedbacks} feedbacks (mínimo: ${MIN_EXECUTIONS} e ${MIN_FEEDBACKS}).`;
    } else if (totalExecutions < MIN_EXECUTIONS) {
      warning = `Poucas execuções: ${totalExecutions} (mínimo: ${MIN_EXECUTIONS}).`;
    } else {
      warning = `Poucos feedbacks: ${totalFeedbacks} (mínimo: ${MIN_FEEDBACKS}).`;
    }
  }

  return { totalExecutions, totalFeedbacks, feedbackCoverage: coverage, sufficientData, warning };
}

function buildFindingQuality(
  executions: StrengthReviewExecutionRecord[],
  feedbacks: StrengthReviewFeedbackRecord[],
): FindingQualityEntry[] {
  const totalExecs = executions.length;
  if (totalExecs === 0) return [];

  // Agrupa findings por tipo
  const byType: Record<string, { confidences: number[]; execsWithType: Set<number> }> = {};

  for (let i = 0; i < executions.length; i++) {
    const exec = executions[i]!;
    for (const f of exec.findings) {
      if (!byType[f.findingType]) byType[f.findingType] = { confidences: [], execsWithType: new Set() };
      byType[f.findingType]!.confidences.push(f.confidence);
      byType[f.findingType]!.execsWithType.add(i);
    }
  }

  // Agrupa feedback por tipo
  const feedbackByType: Record<string, { useful: number; notUseful: number }> = {};
  for (const fb of feedbacks) {
    if (!feedbackByType[fb.findingType]) feedbackByType[fb.findingType] = { useful: 0, notUseful: 0 };
    if (fb.feedback === "USEFUL") feedbackByType[fb.findingType]!.useful++;
    else feedbackByType[fb.findingType]!.notUseful++;
  }

  const entries: FindingQualityEntry[] = [];

  for (const [findingType, data] of Object.entries(byType)) {
    const avgConfidence = data.confidences.reduce((s, c) => s + c, 0) / data.confidences.length;
    const genericityRatio = data.execsWithType.size / totalExecs;
    const genericityPenalty = genericityRatio > GENERICITY_THRESHOLD
      ? Number(((genericityRatio - GENERICITY_THRESHOLD) / (1 - GENERICITY_THRESHOLD)).toFixed(3))
      : 0;

    const fb = feedbackByType[findingType];
    const fbTotal = fb ? fb.useful + fb.notUseful : 0;
    const usefulnessRate = fbTotal > 0 ? fb!.useful / fbTotal : 0;

    const qualityScore = Number(
      (usefulnessRate * 0.60 + avgConfidence * 0.30 + (1 - genericityPenalty) * 0.10).toFixed(3),
    );

    entries.push({
      findingType,
      usefulnessRate: Number((usefulnessRate * 100).toFixed(1)),
      avgConfidence: Number(avgConfidence.toFixed(3)),
      frequency: data.confidences.length,
      genericityRatio: Number(genericityRatio.toFixed(3)),
      genericityPenalty: Number(genericityPenalty.toFixed(3)),
      qualityScore,
    });
  }

  return entries.sort((a, b) => b.qualityScore - a.qualityScore);
}

function buildGenericityAlerts(
  findingQuality: FindingQualityEntry[],
  totalExecutions: number,
): GenericityAlert[] {
  return findingQuality
    .filter(e => e.genericityRatio > GENERICITY_THRESHOLD)
    .map(e => ({
      findingType: e.findingType,
      genericityRatio: e.genericityRatio,
      affectedExecutionsPct: Number((e.genericityRatio * 100).toFixed(1)),
      recommendation: `Finding "${e.findingType}" aparece em ${(e.genericityRatio * 100).toFixed(0)}% das execuções — pode estar sendo sugerido de forma excessivamente genérica. Considere revisar os critérios do prompt para este tipo.`,
    }))
    .sort((a, b) => b.genericityRatio - a.genericityRatio);
}

const CONFIDENCE_BANDS_DEF: Array<{ label: string; min: number; max: number }> = [
  { label: "0.75–0.79", min: 0.75, max: 0.80 },
  { label: "0.80–0.89", min: 0.80, max: 0.90 },
  { label: "0.90–1.00", min: 0.90, max: 1.01 },
];

function buildConfidenceBands(
  executions: StrengthReviewExecutionRecord[],
  feedbacks: StrengthReviewFeedbackRecord[],
): ConfidenceBand[] {
  // Para cada faixa de confiança, pega os tipos de finding com confidence nessa faixa,
  // depois cruza com feedbacks para estimar usefulnessRate.
  const allFindings = executions.flatMap(e => e.findings);
  const feedbackByType: Record<string, { useful: number; total: number }> = {};
  for (const fb of feedbacks) {
    if (!feedbackByType[fb.findingType]) feedbackByType[fb.findingType] = { useful: 0, total: 0 };
    feedbackByType[fb.findingType]!.total++;
    if (fb.feedback === "USEFUL") feedbackByType[fb.findingType]!.useful++;
  }

  return CONFIDENCE_BANDS_DEF.map(band => {
    const inBand = allFindings.filter(f => f.confidence >= band.min && f.confidence < band.max);
    if (inBand.length === 0) {
      return { label: band.label, minConfidence: band.min, maxConfidence: band.max, usefulnessRate: 0, sampleSize: 0 };
    }

    // Estima usefulnessRate como média ponderada da usefulnessRate dos tipos presentes na faixa
    let weightedUseful = 0;
    let weightedTotal = 0;
    for (const finding of inBand) {
      const fb = feedbackByType[finding.findingType];
      if (fb && fb.total > 0) {
        weightedUseful += fb.useful;
        weightedTotal += fb.total;
      }
    }

    const usefulnessRate = weightedTotal > 0 ? Number(((weightedUseful / weightedTotal) * 100).toFixed(1)) : 0;

    return {
      label: band.label,
      minConfidence: band.min,
      maxConfidence: band.max,
      usefulnessRate,
      sampleSize: inBand.length,
    };
  });
}

function buildDomainCalibration(
  executions: StrengthReviewExecutionRecord[],
  feedbacks: StrengthReviewFeedbackRecord[],
): DomainCalibration[] {
  const byDomain: Record<string, StrengthReviewExecutionRecord[]> = {};
  for (const exec of executions) {
    const domain = exec.domain ?? "desconhecido";
    if (!byDomain[domain]) byDomain[domain] = [];
    byDomain[domain]!.push(exec);
  }

  const feedbackByTypeDomain: Record<string, Record<string, { useful: number; total: number }>> = {};
  for (const fb of feedbacks) {
    const domain = fb.domain ?? "desconhecido";
    if (!feedbackByTypeDomain[domain]) feedbackByTypeDomain[domain] = {};
    if (!feedbackByTypeDomain[domain]![fb.findingType]) feedbackByTypeDomain[domain]![fb.findingType] = { useful: 0, total: 0 };
    feedbackByTypeDomain[domain]![fb.findingType]!.total++;
    if (fb.feedback === "USEFUL") feedbackByTypeDomain[domain]![fb.findingType]!.useful++;
  }

  return Object.entries(byDomain).map(([domain, execs]) => {
    const allFindings = execs.flatMap(e => e.findings);
    const typeCounts: Record<string, number> = {};
    for (const f of allFindings) {
      typeCounts[f.findingType] = (typeCounts[f.findingType] ?? 0) + 1;
    }

    const domainFb = feedbackByTypeDomain[domain] ?? {};
    const topFindingTypes = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([findingType, count]) => {
        const fb = domainFb[findingType];
        const usefulnessRate = fb && fb.total > 0
          ? Number(((fb.useful / fb.total) * 100).toFixed(1))
          : 0;
        return { findingType, count, usefulnessRate };
      });

    const totalFindings = allFindings.length;
    const avgFindingsPerExecution = execs.length > 0
      ? Number((totalFindings / execs.length).toFixed(2))
      : 0;

    return { domain, totalExecutions: execs.length, avgFindingsPerExecution, topFindingTypes };
  }).sort((a, b) => b.totalExecutions - a.totalExecutions);
}

function buildProviderComparison(
  executions: StrengthReviewExecutionRecord[],
  feedbacks: StrengthReviewFeedbackRecord[],
): ProviderComparisonEntry[] {
  const byProvider: Record<string, StrengthReviewExecutionRecord[]> = {};
  for (const exec of executions) {
    if (!byProvider[exec.provider]) byProvider[exec.provider] = [];
    byProvider[exec.provider]!.push(exec);
  }

  // Feedbacks não têm provider; estimamos cruzando finding types usados por cada provider
  const feedbackByType: Record<string, { useful: number; total: number }> = {};
  for (const fb of feedbacks) {
    if (!feedbackByType[fb.findingType]) feedbackByType[fb.findingType] = { useful: 0, total: 0 };
    feedbackByType[fb.findingType]!.total++;
    if (fb.feedback === "USEFUL") feedbackByType[fb.findingType]!.useful++;
  }

  return Object.entries(byProvider).map(([provider, execs]) => {
    const totalFindings = execs.reduce((s, e) => s + e.findingCount, 0);
    const avgFindingsPerExecution = Number((totalFindings / execs.length).toFixed(2));
    const avgResponseTimeMs = Math.round(execs.reduce((s, e) => s + e.responseTimeMs, 0) / execs.length);

    // Estima usefulnessRate pelos tipos de finding produzidos por este provider
    const providerTypes = new Set(execs.flatMap(e => e.findings.map(f => f.findingType)));
    let useful = 0;
    let total = 0;
    for (const type of providerTypes) {
      const fb = feedbackByType[type];
      if (fb) { useful += fb.useful; total += fb.total; }
    }
    const estimatedUsefulnessRate = total > 0 ? Number(((useful / total) * 100).toFixed(1)) : null;

    return { provider, executions: execs.length, avgFindingsPerExecution, avgResponseTimeMs, estimatedUsefulnessRate };
  }).sort((a, b) => b.executions - a.executions);
}

function buildBestExamples(
  executions: StrengthReviewExecutionRecord[],
  feedbacks: StrengthReviewFeedbackRecord[],
): BestExample[] {
  const usefulByType: Record<string, number> = {};
  for (const fb of feedbacks) {
    if (fb.feedback === "USEFUL") {
      usefulByType[fb.findingType] = (usefulByType[fb.findingType] ?? 0) + 1;
    }
  }

  // Coleta exemplos agrupados por tipo, priorizando tipos com mais feedbacks USEFUL
  const examplesByType: Record<string, BestExample[]> = {};
  for (const exec of executions) {
    for (const f of exec.findings) {
      if (!f.evidenceSnippet) continue;
      if (!examplesByType[f.findingType]) examplesByType[f.findingType] = [];
      if (examplesByType[f.findingType]!.length >= MAX_EXAMPLES_PER_TYPE) continue;
      examplesByType[f.findingType]!.push({
        findingType: f.findingType,
        opportunityLevel: f.opportunityLevel,
        evidenceSnippet: f.evidenceSnippet,
        domain: exec.domain,
        usefulFeedbackCount: usefulByType[f.findingType] ?? 0,
      });
    }
  }

  return Object.values(examplesByType)
    .flat()
    .sort((a, b) => b.usefulFeedbackCount - a.usefulFeedbackCount)
    .slice(0, 20);
}

function buildRecommendations(
  findingQuality: FindingQualityEntry[],
  dataQuality: DataQuality,
  executions: StrengthReviewExecutionRecord[],
  feedbacks: StrengthReviewFeedbackRecord[],
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (!dataQuality.sufficientData) {
    recs.push({
      severity: "LOW",
      message: dataQuality.warning ?? "Volume de dados ainda insuficiente para recomendações confiáveis. Continue coletando feedback.",
    });
  }

  for (const entry of findingQuality) {
    if (entry.usefulnessRate < 30 && entry.frequency >= 5) {
      recs.push({
        severity: "HIGH",
        findingType: entry.findingType,
        message: `"${entry.findingType}" tem taxa de utilidade muito baixa (${entry.usefulnessRate}%) com ${entry.frequency} ocorrências. Revisar critérios de ativação no prompt.`,
      });
    } else if (entry.usefulnessRate < 50 && entry.frequency >= 3) {
      recs.push({
        severity: "MEDIUM",
        findingType: entry.findingType,
        message: `"${entry.findingType}" tem taxa de utilidade abaixo de 50% (${entry.usefulnessRate}%). Monitorar e considerar ajuste nos exemplos do prompt.`,
      });
    }

    if (entry.genericityRatio > GENERICITY_THRESHOLD) {
      recs.push({
        severity: "MEDIUM",
        findingType: entry.findingType,
        message: `"${entry.findingType}" aparece em ${(entry.genericityRatio * 100).toFixed(0)}% das execuções — possível finding genérico. Revisar especificidade dos critérios.`,
      });
    }
  }

  // Providers sem dados de feedback
  const providerTypes = new Set(executions.flatMap(e => e.findings.map(f => f.findingType)));
  const feedbackTypes = new Set(feedbacks.map(fb => fb.findingType));
  const uncoveredTypes = [...providerTypes].filter(t => !feedbackTypes.has(t));
  if (uncoveredTypes.length > 0 && dataQuality.totalExecutions >= 5) {
    recs.push({
      severity: "LOW",
      message: `${uncoveredTypes.length} tipo(s) de finding sem nenhum feedback coletado: ${uncoveredTypes.slice(0, 3).join(", ")}${uncoveredTypes.length > 3 ? "..." : ""}. Incentive os usuários a dar feedback.`,
    });
  }

  return recs;
}

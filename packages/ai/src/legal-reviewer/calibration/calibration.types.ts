// ── Pontuação de qualidade por tipo de finding ────────────────────────────────

export interface FindingQualityEntry {
  findingType: string;
  usefulnessRate: number;
  avgConfidence: number;
  frequency: number;
  /** Porcentagem de execuções em que este finding aparece (0-1). */
  genericityRatio: number;
  /** Penalidade aplicada por ser genérico (ratio > 0.80). */
  genericityPenalty: number;
  /** Pontuação composta: usefulnessRate×0.60 + avgConfidence×0.30 + (1−genericityPenalty)×0.10 */
  qualityScore: number;
}

// ── Correlação confidence × feedback ─────────────────────────────────────────

export interface ConfidenceBand {
  /** Rótulo da faixa: ex. "0.75–0.79", "0.80–0.89", "0.90–1.00" */
  label: string;
  minConfidence: number;
  maxConfidence: number;
  /** Taxa de utilidade observada para findings nesta faixa de confiança. */
  usefulnessRate: number;
  sampleSize: number;
}

// ── Análise por domínio jurídico ──────────────────────────────────────────────

export interface DomainCalibration {
  domain: string;
  totalExecutions: number;
  avgFindingsPerExecution: number;
  topFindingTypes: Array<{ findingType: string; count: number; usefulnessRate: number }>;
}

// ── Comparação entre providers ────────────────────────────────────────────────

export interface ProviderComparisonEntry {
  provider: string;
  executions: number;
  avgFindingsPerExecution: number;
  avgResponseTimeMs: number;
  /** Taxa de utilidade estimada cruzando execuções com feedbacks do mesmo domínio/tipo. */
  estimatedUsefulnessRate: number | null;
}

// ── Alertas de genericidade ───────────────────────────────────────────────────

export interface GenericityAlert {
  findingType: string;
  genericityRatio: number;
  /** Porcentagem de execuções afetadas (0-100). */
  affectedExecutionsPct: number;
  recommendation: string;
}

// ── Melhores exemplos para corpus ────────────────────────────────────────────

export interface BestExample {
  findingType: string;
  opportunityLevel: string;
  evidenceSnippet: string;
  domain?: string;
  /** Número de feedbacks USEFUL para este tipo de finding. */
  usefulFeedbackCount: number;
}

// ── Recomendação textual ──────────────────────────────────────────────────────

export interface Recommendation {
  severity: "HIGH" | "MEDIUM" | "LOW";
  findingType?: string;
  message: string;
}

// ── Qualidade dos dados de calibração ────────────────────────────────────────

export interface DataQuality {
  totalExecutions: number;
  totalFeedbacks: number;
  feedbackCoverage: number;
  /** Se há dados suficientes para calibração confiável (>= 20 execuções e >= 10 feedbacks). */
  sufficientData: boolean;
  warning?: string;
}

// ── Relatório de calibração ───────────────────────────────────────────────────

export interface CalibrationReport {
  generatedAt: string;
  dataQuality: DataQuality;
  findingQuality: FindingQualityEntry[];
  topPerformers: FindingQualityEntry[];
  lowPerformers: FindingQualityEntry[];
  genericityAlerts: GenericityAlert[];
  confidenceBands: ConfidenceBand[];
  domainCalibration: DomainCalibration[];
  providerComparison: ProviderComparisonEntry[];
  bestExamples: BestExample[];
  recommendations: Recommendation[];
}

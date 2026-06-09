export { generateDocument, analyzeCase, generateDocumentStream, analyzeCaseStream, generatePremiumDocumentStream } from "./generate.js";
export { getOpenAIClient, setOpenAIClient, MODEL } from "./client.js";
export type { Jurisprudencia, DocumentType, GenerateDocumentParams, AnalyzeParams, AIResult, PremiumGenerateParams } from "./types.js";
export { LegalPipeline, LegalClassifierService, LegalExtractionService, LegalMatrixService, LegalDraftService, LegalAuditService, LegalValidator, EvidenceAnalyzerService } from "./pipeline/index.js";
export { PetitionInitialAuditor } from "./pipeline/petition-initial.auditor.js";
export type { PipelineInput, PipelineEvent, LegalClassification, LegalExtraction, ArgumentationMatrix, LegalAudit, InitialPetitionAuditReport, JurisprudenciaInput as JurisprudenciaInputPipeline, ValidationResult, ValidationError, TipoJustica, TipoPeca, RegimeJuridico, GenerationMode, ExtractionQuality, EvidenceAnalysis, EvidenceStance, EvidenceUseMode, JurisprudenciaAnalyzed } from "./pipeline/index.js";
export { FinalValidator, resolveDocumentStatus, StructuralValidator, LegalRulesValidator, AppealValidator, JurisprudenceValidator, GenericityValidator, MatrixQualityValidator, RichnessValidator, EvidenceStanceValidator, SentencaValidator, CriminalSentenceValidator } from "./validators/index.js";
export type { FinalValidationResult } from "./validators/index.js";
export type { DocumentStatus } from "./pipeline/types.js";
export { AuditReportEngine } from "./audit-report/audit-report.engine.js";
export type { AuditReport, AuditClassificacao, AuditItem, FundamentacaoJuridicaItem, QualidadeScore, ConsistenciaArgumentativa, QualidadeArgumentativa } from "./audit-report/audit-report.types.js";

// Generation Pipeline Fase 12
export { GenerationPipeline } from "./generation-pipeline/generation.pipeline.js";
export type { GenerationInput } from "./generation-pipeline/generation.pipeline.js";

// Exportações das Fases 8.x
export * from "./audit/audit.service.js";
export * from "./audit/correction-plan.service.js";
export * from "./audit/assisted-revision/assisted-revision.service.js";
export * from "./audit/assisted-revision/assisted-revision.types.js";
export * from "./audit/rewrite/rewrite.service.js";
export * from "./audit/rewrite/rewrite.types.js";
export * from "./audit/re-audit/re-audit.service.js";
export * from "./audit/re-audit/re-audit.types.js";
export * from "./audit/review/human-review.service.js";
export * from "./audit/review/human-review.types.js";
export * from "./audit/revision/guided-revision.types.js";

// Fase 9.0.0-A — Telemetria
export { StrengthReviewTelemetryService } from "./legal-reviewer/telemetry/strength-review-telemetry.service.js";

// Fase 9.0.1 — Calibração
export { StrengthReviewerCalibrationService } from "./legal-reviewer/calibration/strength-reviewer-calibration.service.js";

// Fase 9.0.2 — Domain Knowledge Framework
export type { DomainKnowledgePack } from "./legal-reviewer/domain-knowledge/domain-knowledge.types.js";
export { DomainKnowledgeRegistry } from "./legal-reviewer/domain-knowledge/domain-knowledge.registry.js";
export { genericLegalKnowledgePack } from "./legal-reviewer/domain-knowledge/packs/generic.pack.js";
export { rgpsKnowledgePack } from "./legal-reviewer/domain-knowledge/packs/rgps.pack.js";
export { rppsKnowledgePack } from "./legal-reviewer/domain-knowledge/packs/rpps.pack.js";
export { trabalhistaKnowledgePack } from "./legal-reviewer/domain-knowledge/packs/trabalhista.pack.js";
export { tributarioKnowledgePack } from "./legal-reviewer/domain-knowledge/packs/tributario.pack.js";
export { familiaKnowledgePack } from "./legal-reviewer/domain-knowledge/packs/familia.pack.js";
export { consumidorKnowledgePack } from "./legal-reviewer/domain-knowledge/packs/consumidor.pack.js";
export { criminalKnowledgePack } from "./legal-reviewer/domain-knowledge/packs/criminal.pack.js";
export { fazendaPublicaKnowledgePack } from "./legal-reviewer/domain-knowledge/packs/fazenda-publica.pack.js";
export { ambientalKnowledgePack } from "./legal-reviewer/domain-knowledge/packs/ambiental.pack.js";
export { civelGeralKnowledgePack } from "./legal-reviewer/domain-knowledge/packs/civel-geral.pack.js";
export { juizadoEspecialKnowledgePack } from "./legal-reviewer/domain-knowledge/packs/juizado-especial.pack.js";
export type {
  CalibrationReport,
  FindingQualityEntry,
  ConfidenceBand,
  DomainCalibration,
  ProviderComparisonEntry,
  GenericityAlert,
  BestExample,
  Recommendation,
  DataQuality,
} from "./legal-reviewer/calibration/calibration.types.js";
export { anonymizeSnippet, anonymizeSuggestion, mightContainPii } from "./legal-reviewer/telemetry/anonymizer.js";
export type {
  TelemetryRecord,
  StrengthReviewExecutionRecord,
  StrengthReviewFeedbackRecord,
  StrengthReviewAnalytics,
  AnonymizedExample,
  FindingFrequency,
  FindingTelemetry,
  FeedbackStats,
  FeedbackValue,
} from "./legal-reviewer/telemetry/telemetry.types.js";

// Fase 9.0.0 — AI Legal Strength Reviewer
export { AiLegalStrengthReviewerService } from "./legal-reviewer/services/ai-legal-strength-reviewer.service.js";
export { AiLegalStrengthReviewerProvider, safeJsonParse } from "./legal-reviewer/providers/ai-legal-strength-reviewer.provider.js";
export type { RawStrengthFinding } from "./legal-reviewer/providers/ai-legal-strength-reviewer.provider.js";
export { StrengthFindingType } from "./legal-reviewer/enums/strength-finding-type.enum.js";
export { OpportunityLevel } from "./legal-reviewer/enums/opportunity-level.enum.js";
export type { AiLegalStrengthReviewRequest, DocumentSummary, ExtractedEntity } from "./legal-reviewer/dto/ai-legal-strength-review-request.js";
export type { AiLegalStrengthFinding } from "./legal-reviewer/dto/ai-legal-strength-finding.js";
export type { AiLegalStrengthReviewResult } from "./legal-reviewer/dto/ai-legal-strength-review-result.js";

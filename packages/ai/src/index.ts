export { generateDocument, analyzeCase, generateDocumentStream, analyzeCaseStream, generatePremiumDocumentStream } from "./generate.js";
export { getOpenAIClient, setOpenAIClient, MODEL } from "./client.js";
export type { Jurisprudencia, DocumentType, GenerateDocumentParams, AnalyzeParams, AIResult, PremiumGenerateParams } from "./types.js";
export { LegalPipeline, LegalClassifierService, LegalExtractionService, LegalMatrixService, LegalDraftService, LegalAuditService, LegalValidator, EvidenceAnalyzerService } from "./pipeline/index.js";
export type { PipelineInput, PipelineEvent, LegalClassification, LegalExtraction, ArgumentationMatrix, LegalAudit, JurisprudenciaInput as JurisprudenciaInputPipeline, ValidationResult, ValidationError, TipoJustica, TipoPeca, RegimeJuridico, GenerationMode, ExtractionQuality, EvidenceAnalysis, EvidenceStance, EvidenceUseMode, JurisprudenciaAnalyzed } from "./pipeline/index.js";
export { FinalValidator, resolveDocumentStatus, StructuralValidator, LegalRulesValidator, AppealValidator, JurisprudenceValidator, GenericityValidator, MatrixQualityValidator, RichnessValidator, EvidenceStanceValidator, SentencaValidator, CriminalSentenceValidator } from "./validators/index.js";
export type { FinalValidationResult } from "./validators/index.js";
export type { DocumentStatus } from "./pipeline/types.js";
export { AuditReportEngine } from "./audit-report/audit-report.engine.js";
export type { AuditReport, AuditClassificacao, AuditItem, FundamentacaoJuridicaItem, QualidadeScore, ConsistenciaArgumentativa, QualidadeArgumentativa } from "./audit-report/audit-report.types.js";

// Exporta\u00E7\u00F5es das Fases 8.x
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

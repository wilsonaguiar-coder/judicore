export { generateDocument, analyzeCase, generateDocumentStream, analyzeCaseStream, generatePremiumDocumentStream } from "./generate.js";
export { getOpenAIClient, setOpenAIClient, MODEL } from "./client.js";
export type { Jurisprudencia, DocumentType, GenerateDocumentParams, AnalyzeParams, AIResult, PremiumGenerateParams } from "./types.js";
export { LegalPipeline, LegalClassifierService, LegalExtractionService, LegalMatrixService, LegalDraftService, LegalAuditService, LegalValidator, EvidenceAnalyzerService } from "./pipeline/index.js";
export type { PipelineInput, PipelineEvent, LegalClassification, LegalExtraction, ArgumentationMatrix, LegalAudit, JurisprudenciaInput as JurisprudenciaInputPipeline, ValidationResult, ValidationError, TipoJustica, TipoPeca, RegimeJuridico, GenerationMode, ExtractionQuality, EvidenceAnalysis, EvidenceStance, EvidenceUseMode, JurisprudenciaAnalyzed } from "./pipeline/index.js";
export { FinalValidator, resolveDocumentStatus, StructuralValidator, LegalRulesValidator, AppealValidator, JurisprudenceValidator, GenericityValidator, MatrixQualityValidator, RichnessValidator, EvidenceStanceValidator } from "./validators/index.js";
export type { FinalValidationResult } from "./validators/index.js";
export type { DocumentStatus } from "./pipeline/types.js";

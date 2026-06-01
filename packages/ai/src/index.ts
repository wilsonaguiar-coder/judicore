export { generateDocument, analyzeCase, generateDocumentStream, analyzeCaseStream, generatePremiumDocumentStream } from "./generate.js";
export type { Jurisprudencia, DocumentType, GenerateDocumentParams, AnalyzeParams, AIResult, PremiumGenerateParams } from "./types.js";
export { LegalPipeline, LegalClassifierService, LegalExtractionService, LegalMatrixService, LegalDraftService, LegalAuditService, LegalValidator } from "./pipeline/index.js";
export type { PipelineInput, PipelineEvent, LegalClassification, LegalExtraction, ArgumentationMatrix, LegalAudit, JurisprudenciaInput as JurisprudenciaInputPipeline, ValidationResult, ValidationError, TipoJustica, TipoPeca, RegimeJuridico } from "./pipeline/index.js";

import type {
  LegalClassification,
  LegalExtraction,
  ArgumentationMatrix,
  LegalAudit,
  GenerationMode,
  JurisprudenciaInput,
  ValidationError,
  DocumentStatus,
  EvidenceAnalysis,
} from "../pipeline/types.js";
import { StructuralValidator } from "./structural.validator.js";
import { LegalRulesValidator } from "./legal.validator.js";
import { AppealValidator } from "./appeal.validator.js";
import { JurisprudenceValidator } from "./jurisprudence.validator.js";
import { GenericityValidator } from "./genericity.validator.js";
import { MatrixQualityValidator } from "./matrix-quality.validator.js";
import { RichnessValidator } from "./richness.validator.js";
import { EvidenceStanceValidator } from "./evidence-stance.validator.js";

export interface FinalValidationResult {
  valid: boolean;
  hasFatalErrors: boolean;
  errors: ValidationError[];
  document_confidence: number;
  status_minuta: DocumentStatus;
  blocked: boolean;
  ressalvas: string[];
  safe_message?: string | undefined;
}

export function resolveDocumentStatus(
  score: number,
  errors: ValidationError[],
  mode?: GenerationMode,
): { status: DocumentStatus; blocked: boolean; ressalvas: string[] } {
  // SAFE_SKELETON e TEMPLATE_MODEL são modelos intencionalmente incompletos:
  // erros estruturais são esperados e não bloqueiam.
  if (mode === "SAFE_SKELETON" || mode === "TEMPLATE_MODEL") {
    return {
      status: "APROVADA COM RESSALVAS",
      blocked: false,
      ressalvas: ["Modelo estruturado — preencha os campos entre colchetes com os dados reais do caso antes de usar."],
    };
  }

  // Para FINAL_DRAFT: erros fatais sempre bloqueiam, independente do score.
  const hasCritical = errors.some((e) => e.fatal);
  if (hasCritical) {
    return { status: "REPROVADA", blocked: true, ressalvas: errors.map((e) => e.message) };
  }

  if (score >= 90) {
    return { status: "MINUTA APROVADA", blocked: false, ressalvas: [] };
  }

  if (score >= 81) {
    return {
      status: "APROVADA COM RESSALVAS",
      blocked: false,
      ressalvas: errors.map((e) => e.message),
    };
  }

  return { status: "REPROVADA", blocked: true, ressalvas: errors.map((e) => e.message) };
}

export class FinalValidator {
  private structural = new StructuralValidator();
  private legal = new LegalRulesValidator();
  private appeal = new AppealValidator();
  private jurisprudence = new JurisprudenceValidator();
  private genericity = new GenericityValidator();
  private matrixQuality = new MatrixQualityValidator();
  private richness = new RichnessValidator();
  private evidenceStance = new EvidenceStanceValidator();

  validate(
    draft: string,
    classification: LegalClassification,
    extraction: LegalExtraction,
    matrix: ArgumentationMatrix,
    audit: LegalAudit,
    jurisprudencias: JurisprudenciaInput[],
    mode: GenerationMode,
    evidenceAnalyses: EvidenceAnalysis[] = [],
  ): FinalValidationResult {
    const allErrors: ValidationError[] = [];

    // 1. Validação estrutural
    const structResult = this.structural.validate(draft, classification.tipo_peca);
    allErrors.push(...structResult.errors);

    // 2. Validação de regras jurídicas (artigos, diplomas)
    const legalResult = this.legal.validateDraftArticles(draft, classification);
    allErrors.push(...legalResult.errors);

    // 3. Validação de recursos
    const appealResult = this.appeal.validate(draft, classification);
    allErrors.push(...appealResult.errors);

    // 4. Validação de jurisprudência
    const jurErrors = this.jurisprudence.validateDraftJurisprudence(draft, jurisprudencias, classification);
    allErrors.push(...jurErrors);

    // 5. Detector de genericidade
    const genericErrors = this.genericity.detect(draft);
    allErrors.push(...genericErrors);

    // 6. Qualidade da matriz (emite avisos sem bloquear)
    const matrixResult = this.matrixQuality.validate(matrix, extraction);
    allErrors.push(...matrixResult.errors);

    // Validação de posicionamento de evidências (stance)
    allErrors.push(...this.evidenceStance.validateMatrix(matrix, evidenceAnalyses));
    allErrors.push(...this.evidenceStance.validate(draft, jurisprudencias, evidenceAnalyses));

    const hasFatalErrors = allErrors.some((e) => e.fatal);
    const genericityScore = this.genericity.calculateScore(draft, extraction);

    // 7. FINAL_DRAFT: genericidade >= 3 → adiciona aviso (não bloqueia sozinho)
    if (mode === "FINAL_DRAFT" && genericityScore >= 3) {
      allErrors.push({
        rule: "FINAL_DRAFT_GENERIC_LANGUAGE",
        message: "A peça FINAL_DRAFT contém linguagem genérica demais — revise a fundamentação.",
        fatal: false,
      });
    }

    // 8. FINAL_DRAFT: validação de riqueza argumentativa
    if (mode === "FINAL_DRAFT") {
      allErrors.push(...this.richness.validate(draft, {
        tipo_peca: classification.tipo_peca,
        regime_juridico: classification.regime_juridico,
        assunto_principal: classification.assunto_principal,
        pedidos: extraction.pedidos,
      }));
    }

    // document_confidence — para display e ranking (não drive o status final)
    let confidence = this.calculateConfidence(classification, extraction, matrix, audit, mode, genericityScore);
    if (mode === "FINAL_DRAFT") {
      if (hasFatalErrors) confidence = Math.min(confidence, 0.49);
      if (genericityScore >= 3) confidence = Math.min(confidence, 0.69);
    }

    // Status final baseado no score do auditor
    const resolved = resolveDocumentStatus(audit.score, allErrors, mode);

    const safe_message = this.buildSafeMessage(resolved.status, mode, hasFatalErrors);

    return {
      valid: !hasFatalErrors,
      hasFatalErrors,
      errors: allErrors,
      document_confidence: confidence,
      status_minuta: resolved.status,
      blocked: resolved.blocked,
      ressalvas: resolved.ressalvas,
      safe_message,
    };
  }

  private buildSafeMessage(status: DocumentStatus, mode: GenerationMode, hasFatalErrors: boolean): string | undefined {
    if (hasFatalErrors) return "A minuta contém erros jurídicos graves e exige revisão antes de qualquer uso.";
    if (mode !== "FINAL_DRAFT") return "A minuta é um modelo estruturado. Preencha os campos entre colchetes com os dados reais do caso antes de usar.";
    if (status === "APROVADA COM RESSALVAS") return "A minuta foi aprovada com ressalvas. Revise os pontos indicados antes de usar.";
    if (status === "REPROVADA") return "A minuta exige revisão jurídica antes de uso.";
    return undefined;
  }

  private calculateConfidence(
    classification: LegalClassification,
    extraction: LegalExtraction,
    matrix: ArgumentationMatrix,
    audit: LegalAudit,
    mode: GenerationMode,
    genericityScore: number,
  ): number {
    if (mode === "SAFE_SKELETON") return 0.20;
    if (mode === "TEMPLATE_MODEL") return 0.50;

    const classScore = Math.min(classification.confianca, 1.0);
    const fatosScore = Math.min(extraction.fatos.length / 3, 1.0);
    const pedidosScore = Math.min(extraction.pedidos.length / 2, 1.0);
    const matrizScore = extraction.pedidos.length > 0
      ? Math.min(matrix.teses.length / extraction.pedidos.length, 1.0)
      : 0.5;
    const qualScore = extraction.qualidade_extracao === "SUFICIENTE" ? 1.0
      : extraction.qualidade_extracao === "PARCIAL" ? 0.5
      : 0.2;
    const auditScore = Math.min(audit.score / 100, 1.0);
    const genericPenalty = Math.min(genericityScore * 0.05, 0.25);

    const weighted =
      classScore   * 0.20 +
      fatosScore   * 0.18 +
      pedidosScore * 0.13 +
      matrizScore  * 0.18 +
      qualScore    * 0.10 +
      auditScore   * 0.15 +
      (1 - genericPenalty) * 0.06;

    return Math.max(0, Math.round(weighted * 100) / 100);
  }
}

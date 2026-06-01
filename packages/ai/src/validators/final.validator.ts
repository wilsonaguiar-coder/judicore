import type {
  LegalClassification,
  LegalExtraction,
  ArgumentationMatrix,
  LegalAudit,
  GenerationMode,
  JurisprudenciaInput,
  ValidationError,
  ValidationResult,
  TipoPeca,
} from "../pipeline/types.js";
import { StructuralValidator } from "./structural.validator.js";
import { LegalRulesValidator } from "./legal.validator.js";
import { AppealValidator } from "./appeal.validator.js";
import { JurisprudenceValidator } from "./jurisprudence.validator.js";
import { GenericityValidator } from "./genericity.validator.js";

export interface FinalValidationResult {
  valid: boolean;
  hasFatalErrors: boolean;
  errors: ValidationError[];
  document_confidence: number;
  status_minuta: "MINUTA APROVADA" | "MINUTA PARA REVISÃO";
  safe_message?: string | undefined;
}

export class FinalValidator {
  private structural = new StructuralValidator();
  private legal = new LegalRulesValidator();
  private appeal = new AppealValidator();
  private jurisprudence = new JurisprudenceValidator();
  private genericity = new GenericityValidator();

  validate(
    draft: string,
    classification: LegalClassification,
    extraction: LegalExtraction,
    matrix: ArgumentationMatrix,
    audit: LegalAudit,
    jurisprudencias: JurisprudenciaInput[],
    mode: GenerationMode,
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

    const hasFatalErrors = allErrors.some((e) => e.fatal);
    const genericityScore = this.genericity.calculateScore(draft, extraction);

    // FINAL_DRAFT com conteúdo excessivamente genérico → rebaixar para REVISÃO
    if (mode === "FINAL_DRAFT" && genericityScore >= 4) {
      allErrors.push({
        rule: "FINAL_DRAFT_TOO_GENERIC",
        message: "A peça foi classificada como FINAL_DRAFT, mas contém conteúdo excessivamente genérico.",
        fatal: false,
      });
    }

    // Calcular document_confidence
    // Para SAFE_SKELETON e TEMPLATE_MODEL os valores são fixos (0.20 / 0.50) e não sofrem capping.
    let confidence = this.calculateConfidence(classification, extraction, matrix, audit, mode, genericityScore);

    // Capping de confidence — só se aplica a FINAL_DRAFT (modos fixos já são conservadores por natureza)
    if (mode === "FINAL_DRAFT") {
      if (hasFatalErrors) {
        confidence = Math.min(confidence, 0.49);
      }
      if (genericityScore >= 4) {
        confidence = Math.min(confidence, 0.69);
      }
    }

    const isTooGenericFinalDraft = mode === "FINAL_DRAFT" && genericityScore >= 4;
    const status_minuta: "MINUTA APROVADA" | "MINUTA PARA REVISÃO" =
      confidence >= 0.80 && !hasFatalErrors && !isTooGenericFinalDraft
        ? "MINUTA APROVADA"
        : "MINUTA PARA REVISÃO";

    let safe_message: string | undefined;
    if (hasFatalErrors) {
      safe_message = "A minuta contém erros jurídicos graves e exige revisão antes de qualquer uso.";
    } else if (mode !== "FINAL_DRAFT") {
      safe_message = "A minuta é um modelo estruturado. Preencha os campos entre colchetes com os dados reais do caso antes de usar.";
    } else if (isTooGenericFinalDraft) {
      safe_message = "A minuta contém conteúdo genérico demais para um FINAL_DRAFT — revise os fatos e pedidos antes de usar.";
    } else if (status_minuta === "MINUTA PARA REVISÃO") {
      safe_message = "A minuta exige revisão jurídica antes de uso.";
    }

    return {
      valid: !hasFatalErrors,
      hasFatalErrors,
      errors: allErrors,
      document_confidence: confidence,
      status_minuta,
      safe_message,
    };
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

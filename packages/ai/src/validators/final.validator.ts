import type {
  LegalClassification,
  LegalExtraction,
  ArgumentationMatrix,
  LegalAudit,
  GenerationMode,
  JurisprudenciaInput,
  ValidationError,
} from "../pipeline/types.js";
import { StructuralValidator } from "./structural.validator.js";
import { LegalRulesValidator } from "./legal.validator.js";
import { AppealValidator } from "./appeal.validator.js";
import { JurisprudenceValidator } from "./jurisprudence.validator.js";
import { GenericityValidator } from "./genericity.validator.js";
import { MatrixQualityValidator } from "./matrix-quality.validator.js";
import { RichnessValidator } from "./richness.validator.js";

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
  private matrixQuality = new MatrixQualityValidator();
  private richness = new RichnessValidator();

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

    // 6. Qualidade da matriz (emite avisos sem bloquear)
    const matrixResult = this.matrixQuality.validate(matrix, extraction);
    allErrors.push(...matrixResult.errors);

    const hasFatalErrors = allErrors.some((e) => e.fatal);
    const genericityScore = this.genericity.calculateScore(draft, extraction);

    // 7. FINAL_DRAFT: genericidade >= 3 → rebaixar para revisão
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

    // Calcular document_confidence
    // Para SAFE_SKELETON e TEMPLATE_MODEL os valores são fixos (0.20 / 0.50) e não sofrem capping.
    let confidence = this.calculateConfidence(classification, extraction, matrix, audit, mode, genericityScore);

    // Capping de confidence — só se aplica a FINAL_DRAFT
    if (mode === "FINAL_DRAFT") {
      if (hasFatalErrors) confidence = Math.min(confidence, 0.49);
      if (genericityScore >= 3) confidence = Math.min(confidence, 0.69);
    }

    const isWeakFinalDraft = mode === "FINAL_DRAFT" && genericityScore >= 3;
    const status_minuta: "MINUTA APROVADA" | "MINUTA PARA REVISÃO" =
      confidence >= 0.80 && !hasFatalErrors && !isWeakFinalDraft
        ? "MINUTA APROVADA"
        : "MINUTA PARA REVISÃO";

    let safe_message: string | undefined;
    if (hasFatalErrors) {
      safe_message = "A minuta contém erros jurídicos graves e exige revisão antes de qualquer uso.";
    } else if (mode !== "FINAL_DRAFT") {
      safe_message = "A minuta é um modelo estruturado. Preencha os campos entre colchetes com os dados reais do caso antes de usar.";
    } else if (isWeakFinalDraft) {
      safe_message = "A minuta contém linguagem genérica — revise a fundamentação antes de usar.";
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

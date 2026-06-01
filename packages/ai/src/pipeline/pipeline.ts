import { LegalClassifierService } from "./classifier.js";
import { LegalExtractionService } from "./extractor.js";
import { LegalMatrixService } from "./matrix.js";
import { LegalDraftService } from "./drafter.js";
import { LegalAuditService } from "./auditor.js";
import { LegalValidator } from "./validator.js";
import type {
  PipelineInput,
  PipelineContext,
  PipelineEvent,
  JurisprudenciaInput,
  GenerationMode,
  LegalClassification,
  LegalExtraction,
  ArgumentationMatrix,
  LegalAudit,
} from "./types.js";

// ── Padrões que indicam input genérico/inválido ───────────────────────────────

const BLOCKED_INPUT_PATTERNS = [
  /^\s*$/,
  /^pesquisa\s+livre$/i,
  /^teste$/i,
  /^modelo$/i,
  /^exemplo$/i,
  /^não\s+informado$/i,
  /^n\/a$/i,
  /^s\/n$/i,
];

const GENERIC_INPUT_PATTERNS = [
  /pesquisa\s+livre/i,
  /^teste\b/i,
  /^modelo\b/i,
  /^exemplo\b/i,
];

function checkInputBlocked(desc: string): string | null {
  const trimmed = desc.trim();
  if (trimmed.length === 0) return "Descrição do caso está vazia";
  for (const p of BLOCKED_INPUT_PATTERNS) {
    if (p.test(trimmed)) return `Descrição inválida para geração: "${trimmed}"`;
  }
  if (trimmed.length < 20) return "Descrição do caso é muito curta para gerar uma peça jurídica";
  return null;
}

// ── Determinação do modo de geração ──────────────────────────────────────────

function determineGenerationMode(
  caseDescription: string,
  classification: LegalClassification,
  extraction: LegalExtraction,
): { mode: GenerationMode; reason: string } {
  // Classificação incerta → SAFE_SKELETON
  if (classification.confianca < 0.75 || classification.tipo_justica === "INDETERMINADA") {
    return {
      mode: "SAFE_SKELETON",
      reason: `Confiança na classificação insuficiente (${classification.confianca.toFixed(2)}) — gerando esqueleto seguro`,
    };
  }

  // Input com padrões genéricos → TEMPLATE_MODEL
  if (GENERIC_INPUT_PATTERNS.some((p) => p.test(caseDescription.trim()))) {
    return {
      mode: "TEMPLATE_MODEL",
      reason: "Descrição do caso é genérica — gerando modelo estruturado com placeholders",
    };
  }

  // Extração insuficiente → SAFE_SKELETON
  if (extraction.qualidade_extracao === "INSUFICIENTE") {
    return {
      mode: "SAFE_SKELETON",
      reason: extraction.motivo_qualidade ?? "Qualidade de extração insuficiente para peça final",
    };
  }

  // Fatos ou pedidos insuficientes → TEMPLATE_MODEL
  if (extraction.fatos.length < 2 || extraction.pedidos.length < 1) {
    return {
      mode: "TEMPLATE_MODEL",
      reason: `Informações insuficientes: ${extraction.fatos.length} fato(s), ${extraction.pedidos.length} pedido(s) — gerando modelo`,
    };
  }

  // Extração parcial → TEMPLATE_MODEL
  if (extraction.qualidade_extracao === "PARCIAL") {
    return {
      mode: "TEMPLATE_MODEL",
      reason: extraction.motivo_qualidade ?? "Fatos parcialmente identificados — gerando modelo estruturado",
    };
  }

  return { mode: "FINAL_DRAFT", reason: "Informações suficientes para geração de peça final" };
}

// ── Cálculo do score de confiança do documento ────────────────────────────────

function calculateDocumentConfidence(
  classification: LegalClassification,
  extraction: LegalExtraction,
  matrix: ArgumentationMatrix,
  audit: LegalAudit,
  mode: GenerationMode,
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

  const weighted =
    classScore  * 0.20 +
    fatosScore  * 0.20 +
    pedidosScore * 0.15 +
    matrizScore * 0.20 +
    qualScore   * 0.10 +
    auditScore  * 0.15;

  return Math.round(weighted * 100) / 100;
}

// ── Pipeline principal ────────────────────────────────────────────────────────

export class LegalPipeline {
  private classifier = new LegalClassifierService();
  private extractor = new LegalExtractionService();
  private matrixBuilder = new LegalMatrixService();
  private drafter = new LegalDraftService();
  private auditor = new LegalAuditService();
  private validator = new LegalValidator();

  async *run(
    input: PipelineInput,
    generationId: string,
    onStageComplete?: (stage: string, data: unknown) => Promise<void>,
  ): AsyncGenerator<PipelineEvent> {
    // ── Verificação de input ───────────────────────────────────────────────────
    const blocked = checkInputBlocked(input.caseDescription);
    if (blocked) {
      yield { event: "error", data: { message: blocked, phase: "input_validation", fatal: true } };
      return;
    }

    const ctx: PipelineContext = {
      generationId,
      caseDescription: input.caseDescription,
      documentType: input.documentType,
      jurisprudencias: input.jurisprudencias,
      instruction: input.instruction,
      retryOf: input.retryOf,
      corrections: input.corrections,
    };

    // ── Fase 1: Classificação ──────────────────────────────────────────────────
    yield { event: "phase", data: { phase: "classifying", generationId } };
    try {
      const { classification, usage } = await this.classifier.classify(
        ctx.caseDescription,
        ctx.documentType,
        ctx.jurisprudencias,
      );
      ctx.classification = classification;
      await onStageComplete?.("classification", { classification, usage });
      yield { event: "classification", data: classification };
    } catch (err: unknown) {
      yield { event: "error", data: { message: String(err), phase: "classifying", fatal: true } };
      return;
    }

    // ── Validação determinística da classificação ──────────────────────────────
    const classValidation = this.validator.validateClassification(ctx.classification!);
    if (!classValidation.valid) {
      yield { event: "validation_errors", data: classValidation.errors };
      if (classValidation.errors.some((e) => e.fatal)) return;
    }

    // ── Fase 2: Extração ───────────────────────────────────────────────────────
    yield { event: "phase", data: { phase: "extracting", generationId } };
    try {
      const { extraction, usage } = await this.extractor.extract(
        ctx.caseDescription,
        ctx.classification!,
        ctx.jurisprudencias,
      );
      ctx.extraction = extraction;
      await onStageComplete?.("extraction", { extraction, usage });
      yield { event: "extraction", data: extraction };
    } catch (err: unknown) {
      yield { event: "error", data: { message: String(err), phase: "extracting", fatal: true } };
      return;
    }

    // ── Determinação do modo de geração ───────────────────────────────────────
    const { mode, reason } = determineGenerationMode(
      ctx.caseDescription,
      ctx.classification!,
      ctx.extraction!,
    );
    ctx.generationMode = mode;
    yield { event: "mode", data: { mode, reason } };

    // Emite avisos de extração insuficiente sem bloquear
    const extractionValidation = this.validator.validateExtractionSufficiency(ctx.extraction!);
    if (extractionValidation.errors.length > 0) {
      yield { event: "validation_errors", data: extractionValidation.errors };
    }

    // ── Fase 3: Matriz de argumentação ────────────────────────────────────────
    yield { event: "phase", data: { phase: "building_matrix", generationId } };
    try {
      const { matrix, usage } = await this.matrixBuilder.buildMatrix(
        ctx.extraction!,
        ctx.classification!,
        ctx.jurisprudencias,
      );
      ctx.matrix = matrix;
      await onStageComplete?.("matrix", { matrix, usage });
      yield { event: "matrix", data: matrix };
    } catch (err: unknown) {
      yield { event: "error", data: { message: String(err), phase: "building_matrix", fatal: true } };
      return;
    }

    // ── Fase 4: Geração da peça ────────────────────────────────────────────────
    yield { event: "phase", data: { phase: "drafting", generationId } };
    let fullDraft = "";
    let draftInput = 0, draftOutput = 0;
    try {
      const draftStream = this.drafter.draft(
        ctx.classification!,
        ctx.extraction!,
        ctx.matrix!,
        ctx.jurisprudencias,
        (inp, out) => { draftInput = inp; draftOutput = out; },
        ctx.instruction,
        ctx.corrections,
        mode,
      );
      for await (const chunk of draftStream) {
        fullDraft += chunk;
        yield { event: "chunk", data: chunk };
      }
      ctx.draft = fullDraft;
      await onStageComplete?.("draft", { content: fullDraft, inputTokens: draftInput, outputTokens: draftOutput });
    } catch (err: unknown) {
      yield { event: "error", data: { message: String(err), phase: "drafting", fatal: true } };
      return;
    }

    // ── Validações determinísticas do rascunho ────────────────────────────────
    const draftRuleValidation = this.validator.validateDraftAgainstRules(ctx.draft!, ctx.classification!);
    if (draftRuleValidation.errors.length > 0) {
      yield { event: "validation_errors", data: draftRuleValidation.errors };
    }

    // Validação estrutural
    const structValidation = this.validator.validateStructure(ctx.draft!, ctx.classification!.tipo_peca);
    if (structValidation.errors.length > 0) {
      yield { event: "validation_errors", data: structValidation.errors };
    }

    // Detector de conteúdo genérico
    const genericErrors = this.validator.detectGenericContent(ctx.draft!);
    if (genericErrors.length > 0) {
      yield { event: "validation_errors", data: genericErrors };
    }

    // ── Fase 5: Auditoria ──────────────────────────────────────────────────────
    yield { event: "phase", data: { phase: "auditing", generationId } };
    try {
      const { audit, usage } = await this.auditor.audit(
        ctx.draft!,
        ctx.classification!,
        ctx.matrix!,
      );
      ctx.audit = audit;

      // Calcular document_confidence e status_minuta
      const docConfidence = calculateDocumentConfidence(
        ctx.classification!,
        ctx.extraction!,
        ctx.matrix!,
        audit,
        mode,
      );
      ctx.audit.document_confidence = docConfidence;
      ctx.audit.status_minuta = docConfidence >= 0.80 ? "MINUTA APROVADA" : "MINUTA PARA REVISÃO";

      await onStageComplete?.("audit", { audit: ctx.audit, usage });
      yield { event: "audit", data: ctx.audit };
    } catch (err: unknown) {
      yield { event: "error", data: { message: String(err), phase: "auditing", fatal: false } };
      yield { event: "done", data: { generationId, aprovada: false, mode } };
      return;
    }

    yield {
      event: "done",
      data: { generationId, aprovada: ctx.audit!.aprovada, mode },
    };
  }
}

export { LegalClassifierService, LegalExtractionService, LegalMatrixService, LegalDraftService, LegalAuditService, LegalValidator };
export type { PipelineInput, PipelineContext, PipelineEvent, JurisprudenciaInput };

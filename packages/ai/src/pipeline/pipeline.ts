import { LegalClassifierService } from "./classifier.js";
import { LegalExtractionService } from "./extractor.js";
import { LegalMatrixService } from "./matrix.js";
import { LegalDraftService } from "./drafter.js";
import { LegalAuditService } from "./auditor.js";
import { LegalValidator } from "./validator.js";
import type { PipelineInput, PipelineContext, PipelineEvent, JurisprudenciaInput } from "./types.js";

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

    // ── Validação determinística do rascunho ──────────────────────────────────
    const draftValidation = this.validator.validateDraftAgainstRules(ctx.draft!, ctx.classification!);
    if (draftValidation.errors.length > 0) {
      yield { event: "validation_errors", data: draftValidation.errors };
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
      await onStageComplete?.("audit", { audit, usage });
      yield { event: "audit", data: audit };
    } catch (err: unknown) {
      yield { event: "error", data: { message: String(err), phase: "auditing", fatal: false } };
      yield { event: "done", data: { generationId, aprovada: false } };
      return;
    }

    yield {
      event: "done",
      data: { generationId, aprovada: ctx.audit!.aprovada },
    };
  }
}

export { LegalClassifierService, LegalExtractionService, LegalMatrixService, LegalDraftService, LegalAuditService, LegalValidator };
export type { PipelineInput, PipelineContext, PipelineEvent, JurisprudenciaInput };

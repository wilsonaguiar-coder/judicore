import { LegalClassifierService } from "./classifier.js";
import { LegalExtractionService } from "./extractor.js";
import { LegalMatrixService } from "./matrix.js";
import { LegalDraftService } from "./drafter.js";
import { LegalAuditService } from "./auditor.js";
import { LegalValidator } from "./validator.js";
import { EvidenceAnalyzerService } from "./evidence-analyzer.js";
import { FinalValidator, MatrixQualityValidator, resolveDocumentStatus } from "../validators/index.js";
import type { FinalValidationResult } from "../validators/index.js";
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
  EvidenceAnalysis,
  JurisprudenciaAnalyzed,
} from "./types.js";

// ── Padrões que indicam input genérico/inválido ───────────────────────────────

// Bloqueia fatalmente apenas inputs completamente inválidos (vazios ou tokens sem sentido)
const BLOCKED_INPUT_PATTERNS = [
  /^\s*$/,
  /^teste$/i,
  /^não\s+informado$/i,
  /^n\/a$/i,
  /^s\/n$/i,
];

// Padrões que indicam input genérico → TEMPLATE_MODEL
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
  return null;
}

// ── Determinação do modo de geração — Fase 1 (após extração) ─────────────────

type PreliminaryMode = GenerationMode | "POSSIBLE_FINAL_DRAFT";

function determinePreliminaryMode(
  caseDescription: string,
  classification: LegalClassification,
  extraction: LegalExtraction,
): { mode: PreliminaryMode; reason: string } {
  if (caseDescription.trim().length < 20) {
    return { mode: "SAFE_SKELETON", reason: "Descrição curta/incompleta — gerando esqueleto seguro" };
  }
  if (classification.confianca < 0.75 || classification.tipo_justica === "INDETERMINADA") {
    return {
      mode: "SAFE_SKELETON",
      reason: `Confiança na classificação insuficiente (${classification.confianca.toFixed(2)}) — gerando esqueleto seguro`,
    };
  }
  if (GENERIC_INPUT_PATTERNS.some((p) => p.test(caseDescription.trim()))) {
    return { mode: "TEMPLATE_MODEL", reason: "Descrição do caso é genérica — gerando modelo estruturado" };
  }
  if (extraction.qualidade_extracao === "INSUFICIENTE") {
    return { mode: "SAFE_SKELETON", reason: extraction.motivo_qualidade ?? "Qualidade de extração insuficiente" };
  }
  if (extraction.qualidade_extracao === "PARCIAL") {
    return { mode: "TEMPLATE_MODEL", reason: extraction.motivo_qualidade ?? "Fatos parcialmente identificados — gerando modelo estruturado" };
  }
  if (
    extraction.fatos.length >= 3 &&
    extraction.pedidos.length >= 2 &&
    extraction.questoes_juridicas.length >= 2
  ) {
    return { mode: "POSSIBLE_FINAL_DRAFT", reason: "Extração suficiente — aguardando avaliação da matriz" };
  }
  return { mode: "TEMPLATE_MODEL", reason: `Informações insuficientes: ${extraction.fatos.length} fato(s), ${extraction.pedidos.length} pedido(s)` };
}

// ── Determinação do modo de geração — Fase 2 (após matriz) ───────────────────

function confirmGenerationMode(
  preliminary: PreliminaryMode,
  extraction: LegalExtraction,
  matrix: ArgumentationMatrix,
): { mode: GenerationMode; reason: string } {
  if (preliminary !== "POSSIBLE_FINAL_DRAFT") {
    return { mode: preliminary as GenerationMode, reason: "" };
  }
  const matrixValidator = new MatrixQualityValidator();
  const matrixResult = matrixValidator.validate(matrix, extraction);
  const hasEnoughTeses = matrix.teses.length >= extraction.pedidos.length;
  if (hasEnoughTeses && matrixResult.valid) {
    return { mode: "FINAL_DRAFT", reason: "Extração suficiente e matriz de qualidade — gerando peça final" };
  }
  return {
    mode: "TEMPLATE_MODEL",
    reason: `Matriz insuficiente para FINAL_DRAFT: ${matrixResult.errors[0]?.message ?? "qualidade baixa"}`,
  };
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
  private finalValidator = new FinalValidator();
  private evidenceAnalyzer = new EvidenceAnalyzerService();

  async *run(
    input: PipelineInput,
    generationId: string,
    onStageComplete?: (stage: string, data: unknown) => Promise<void>,
  ): AsyncGenerator<PipelineEvent> {
    // ── Verificação de input ───────────────────────────────────────────────────
    const inputError = checkInputBlocked(input.caseDescription);
    if (inputError) {
      yield { event: "error", data: { message: inputError, phase: "input_validation", fatal: true } };
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

    // ── Determinação preliminar do modo (fase 1) ─────────────────────────────
    const { mode: preliminaryMode } = determinePreliminaryMode(
      ctx.caseDescription,
      ctx.classification!,
      ctx.extraction!,
    );

    // Emite avisos de extração insuficiente sem bloquear
    const extractionValidation = this.validator.validateExtractionSufficiency(ctx.extraction!);
    if (extractionValidation.errors.length > 0) {
      yield { event: "validation_errors", data: extractionValidation.errors };
    }

    // ── Fase 3: Análise de posicionamento das evidências ─────────────────────
    yield { event: "phase", data: { phase: "analyzing_evidence", generationId } };
    let analyzedJurs: JurisprudenciaAnalyzed[] = ctx.jurisprudencias.map((j) => ({ ...j }));
    if (ctx.jurisprudencias.length > 0) {
      try {
        const { analyses, usage } = await this.evidenceAnalyzer.analyze(
          ctx.caseDescription,
          ctx.classification!,
          ctx.extraction!,
          ctx.jurisprudencias,
        );
        ctx.evidenceAnalysis = analyses;
        analyzedJurs = ctx.jurisprudencias.map((j) => ({
          ...j,
          evidence: analyses.find((a) => a.id === j.id),
        }));
        await onStageComplete?.("evidence", { analyses, usage });
        yield { event: "evidence", data: analyses };
      } catch (err: unknown) {
        // Não-fatal: continua sem análise de evidências
        yield { event: "error", data: { message: `Evidence analysis falhou: ${String(err)}`, phase: "analyzing_evidence", fatal: false } };
      }
    }

    // ── Fase 4: Matriz de argumentação ────────────────────────────────────────
    yield { event: "phase", data: { phase: "building_matrix", generationId } };
    try {
      const { matrix, usage } = await this.matrixBuilder.buildMatrix(
        ctx.extraction!,
        ctx.classification!,
        analyzedJurs,
      );
      ctx.matrix = matrix;
      await onStageComplete?.("matrix", { matrix, usage });
      yield { event: "matrix", data: matrix };
    } catch (err: unknown) {
      yield { event: "error", data: { message: String(err), phase: "building_matrix", fatal: true } };
      return;
    }

    // ── Confirmação do modo de geração (fase 2, após matriz) ─────────────────
    const { mode, reason } = confirmGenerationMode(preliminaryMode, ctx.extraction!, ctx.matrix!);
    ctx.generationMode = mode;
    yield { event: "mode", data: { mode, reason } };

    // ── Fase 5: Geração da peça ────────────────────────────────────────────────
    yield { event: "phase", data: { phase: "drafting", generationId } };
    let fullDraft = "";
    let draftInput = 0, draftOutput = 0;
    try {
      const draftStream = this.drafter.draft(
        ctx.classification!,
        ctx.extraction!,
        ctx.matrix!,
        analyzedJurs,
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

    // Validação estrutural é executada via FinalValidator (StructuralValidator interno) —
    // não duplicar aqui para evitar MISSING_STRUCTURE reportado duas vezes.

    // Detector de conteúdo genérico
    const genericErrors = this.validator.detectGenericContent(ctx.draft!);
    if (genericErrors.length > 0) {
      yield { event: "validation_errors", data: genericErrors };
    }

    // ── Fase 6: Auditoria + Validação final ───────────────────────────────────
    yield { event: "phase", data: { phase: "auditing", generationId } };
    let finalResult: FinalValidationResult | undefined;
    try {
      const { audit, usage } = await this.auditor.audit(
        ctx.draft!,
        ctx.classification!,
        ctx.matrix!,
      );
      ctx.audit = audit;

      // Validação final integrada (usa audit.score para resolver status)
      finalResult = this.finalValidator.validate(
        ctx.draft!,
        ctx.classification!,
        ctx.extraction!,
        ctx.matrix!,
        audit,
        ctx.jurisprudencias,
        mode,
        ctx.evidenceAnalysis ?? [],
      );
      if (finalResult.errors.length > 0) {
        yield { event: "validation_errors", data: finalResult.errors };
      }

      // Enriquecer audit com status resolvido
      ctx.audit.document_confidence = finalResult.document_confidence;
      ctx.audit.status_minuta = finalResult.status_minuta;
      ctx.audit.blocked = finalResult.blocked;
      ctx.audit.ressalvas = finalResult.ressalvas;
      ctx.audit.aprovada = !finalResult.blocked;

      await onStageComplete?.("audit", { audit: ctx.audit, usage });
      yield { event: "audit", data: ctx.audit };
    } catch (err: unknown) {
      yield { event: "error", data: { message: String(err), phase: "auditing", fatal: false } };
      yield { event: "done", data: { generationId, aprovada: false, blocked: true, mode, status: "REPROVADA" } };
      return;
    }

    yield {
      event: "done",
      data: {
        generationId,
        aprovada: !ctx.audit!.blocked,
        blocked: ctx.audit!.blocked ?? false,
        ressalvas: ctx.audit!.ressalvas ?? [],
        mode,
        status: ctx.audit!.status_minuta,
        safe_message: finalResult?.safe_message,
      },
    };
  }
}

export { LegalClassifierService, LegalExtractionService, LegalMatrixService, LegalDraftService, LegalAuditService, LegalValidator };
export type { PipelineInput, PipelineContext, PipelineEvent, JurisprudenciaInput };

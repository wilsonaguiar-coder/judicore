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
import { SentencaValidator } from "./sentenca.validator.js";
import { CriminalSentenceValidator } from "./criminal-sentenca.validator.js";
import { CivilValidator } from "./civil.validator.js";
import { ConsumerValidator } from "./consumer.validator.js";
import { ExecutionValidator } from "./execution.validator.js";
import { JefCivelValidator } from "./jef-civel.validator.js";
import { StanceContradictionValidator } from "./stance-contradiction.validator.js";

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

// ── Derivação de área de riqueza (FASE 4.6) ──────────────────────────────────
// Mapeia LegalClassification para um perfil de DomainRichnessAnalyzer.

function deriveRichnessArea(c: LegalClassification): string {
  if (c.regime_juridico === "RPPS") return "RPPS";
  if (c.regime_juridico === "RGPS") return "RGPS";
  if (c.tipo_justica === "JEF" || c.tipo_justica === "JEC") {
    const assunto = c.assunto_principal ?? "";
    const isFederal =
      /lei\s+10\.259|JEF\s+[Ff]ederal|Turma\s+Recursal\s+[Ff]ederal|TRF\d?|INSS|Uni[aã]o\s+Federal/i.test(assunto);
    return isFederal ? "JEF_FEDERAL" : "JEF_ESTADUAL";
  }
  if (c.tipo_justica === "EXECUCAO_FISCAL") return "EXECUCAO_CUMPRIMENTO";
  const assunto = c.assunto_principal ?? "";
  if (/execu[cç][aã]o|cumprimento\s+de\s+senten[cç]a|penhora|SISBAJUD/i.test(assunto)) {
    return "EXECUCAO_CUMPRIMENTO";
  }
  if (/consumidor|CDC|rela[cç][aã]o\s+de\s+consumo|c[oó]digo\s+de\s+defesa/i.test(assunto)) {
    return "CONSUMIDOR";
  }
  return "CIVEL_GERAL";
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
  private sentenca = new SentencaValidator();
  private criminalSentenca = new CriminalSentenceValidator();
  private civil = new CivilValidator();
  private consumer = new ConsumerValidator();
  private execution = new ExecutionValidator();
  private jefCivel = new JefCivelValidator();
  private stanceContradiction = new StanceContradictionValidator();

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

    // 1b. Validação específica de SENTENCA (geral)
    if (classification.tipo_peca === "SENTENCA") {
      allErrors.push(...this.sentenca.validate(draft, classification).errors);
      // 1c. Validação específica de SENTENCA criminal
      allErrors.push(...this.criminalSentenca.validate(draft, classification).errors);
    }

    // 1d. Validação cível (tutela + honorários/custas em sentença)
    allErrors.push(...this.civil.validate(draft, classification).errors);

    // 1e. Validação consumerista (CDC + inversão ônus + dano moral + repetição em dobro)
    allErrors.push(...this.consumer.validate(draft, classification).errors);

    // 1f. Validação de execução/cumprimento (seções, CPC, modalidade, objeção, SISBAJUD)
    allErrors.push(...this.execution.validate(draft, classification).errors);

    // 1g. Validação de JEF Cível (competência, valor, recurso, perícia, tutela)
    allErrors.push(...this.jefCivel.validate(draft, classification).errors);

    // 1h. Detector de contradição semântica pós-draft (STANCE_CONTRADICTION — FASE 4.4.1)
    allErrors.push(...this.stanceContradiction.validate(draft));

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
        message: "A minuta contém linguagem genérica demais — revise a fundamentação com argumentos específicos ao caso.",
        fatal: false,
      });
    }

    // 8. FINAL_DRAFT: validação de riqueza argumentativa (FASE 4.6 — perfil por domínio)
    if (mode === "FINAL_DRAFT") {
      allErrors.push(...this.richness.validate(draft, {
        tipo_peca: classification.tipo_peca,
        regime_juridico: classification.regime_juridico,
        assunto_principal: classification.assunto_principal,
        pedidos: extraction.pedidos,
        area: deriveRichnessArea(classification),
      }));
    }

    // 9. Template não preenchido — FATAL independente de modo
    // Detecta placeholders literais com 3+ chars: [ENDEREÇAMENTO], [A DETERMINAR], etc.
    const PLACEHOLDER_RE = /\[[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9\s.,;:!?\/_\-]{3,}\]/gi;
    const placeholders = [...draft.matchAll(PLACEHOLDER_RE)];
    if (placeholders.length >= 3) {
      allErrors.push({
        rule: "UNFILLED_TEMPLATE_PLACEHOLDERS",
        message: `Minuta contém ${placeholders.length} campo(s) de template não preenchido(s) — exemplo: "${placeholders[0]![0]}"`,
        fatal: true,
      });
    }

    // 10. Minuta vazia ou esqueleto — FATAL quando o conteúdo útil é insuficiente
    const SKELETON_PHRASES_RE = /peça gerada sem informações suficientes|completar todos os campos|preencher com dados reais|inserir fatos do caso concreto|a determinar/i;
    const usefulText = draft.replace(/\[[^\]]{3,}\]/g, "").replace(/\s+/g, " ").trim();
    const isSkeletonByLength = usefulText.length < 1500;
    const isSkeletonByPhrase = SKELETON_PHRASES_RE.test(draft);
    const placeholderRatio = placeholders.length > 0
      ? placeholders.length / Math.max(1, draft.split(/\n/).length)
      : 0;
    if ((isSkeletonByLength || isSkeletonByPhrase || placeholderRatio > 0.3) && placeholders.length >= 2) {
      allErrors.push({
        rule: "EMPTY_OR_SKELETON_DRAFT",
        message: "Minuta insuficiente: estrutura de template sem conteúdo substantivo. Preencha todos os campos antes de usar.",
        fatal: true,
      });
    }

    // document_confidence — para display e ranking (não drive o status final)
    let confidence = this.calculateConfidence(classification, extraction, matrix, audit, mode, genericityScore);
    if (mode === "FINAL_DRAFT") {
      if (hasFatalErrors) confidence = Math.min(confidence, 0.49);
      if (genericityScore >= 3) confidence = Math.min(confidence, 0.69);
    }

    // Status final baseado no score do auditor
    const resolved = resolveDocumentStatus(audit.score, allErrors, mode);

    const safe_message = this.buildSafeMessage(resolved.status, mode, hasFatalErrors, allErrors);

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

  private buildSafeMessage(status: DocumentStatus, mode: GenerationMode, hasFatalErrors: boolean, errors?: { rule: string }[]): string | undefined {
    if (errors?.some((e) => e.rule === "UNFILLED_TEMPLATE_PLACEHOLDERS" || e.rule === "EMPTY_OR_SKELETON_DRAFT")) {
      return "A minuta contém campos não preenchidos e não deve ser utilizada sem complementação substancial.";
    }
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

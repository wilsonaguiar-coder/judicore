import { FinalValidator } from "../validators/index.js";
import { AuditReportEngine } from "../audit-report/audit-report.engine.js";
import { CorrectionPlanService } from "./correction-plan.service.js";
import { FeedbackReportService } from "./feedback-report.service.js";
import type { LegalClassification } from "../pipeline/types.js";
import type { AuditReport } from "../audit-report/audit-report.types.js";

// ETAPA 2: DTO padronizado de resposta (envelope)
export interface IntegratedAuditResponse {
  pieceId: string;
  audit: {
    status: "APROVADA" | "APROVADA_COM_RESSALVAS" | "REPROVADA";
    score: number;
    classification: string;
    fatalErrors: Array<{ titulo: string; descricao: string; code?: string | undefined }>;
    nonFatalErrors: Array<{ titulo: string; descricao: string; code?: string | undefined }>;
    strengths: Array<{ titulo: string; descricao: string }>;
    rawReport?: AuditReport;
  };
  feedback?: any; // FeedbackReport
  correctionPlan?: any; // CorrectionPlan
}

// ETAPA 1: Serviço dedicado de auditoria (standalone para integração)
export class AuditService {
  private finalValidator = new FinalValidator();
  private auditReportEngine = new AuditReportEngine();
  private feedbackReportService = new FeedbackReportService();
  private correctionPlanService = new CorrectionPlanService();

  public auditGeneratedDocument(
    pieceId: string,
    draft: string,
    classification: LegalClassification
  ): IntegratedAuditResponse {
    console.log(`[AUDIT] Starting audit for piece ${pieceId}...`);
    const start = Date.now();

    // Mockamos estruturas da pipeline completa (que n\u00E3o temos numa chamada standalone)
    // pois a auditoria sem\u00E2ntica principal baseia-se em "draft" e "classification".
    const extractionMock: any = { fatos: [], pedidos: [], questoes_juridicas: [], partes: { autor: "", reu: "" }, valor_causa: 0, prioridade_tramitacao: false, qualidade_extracao: "SUFICIENTE", artigos_citados: [] };
    const matrixMock: any = { teses: [] };
    const auditMock: any = { score: 100, rules_checked: [], document_confidence: 1, status_minuta: "MINUTA APROVADA", blocked: false, ressalvas: [] };

    // ETAPA 1: Executar FinalValidator
    const validationResult = this.finalValidator.validate(
      draft,
      classification,
      extractionMock,
      matrixMock,
      auditMock,
      [], // jurisprudencias
      "FINAL_DRAFT", // mode
      [] // evidenceAnalyses
    );

    // Gerar relat\u00F3rio rico (AuditReportEngine)
    const report = this.auditReportEngine.generate(
      draft,
      validationResult,
      classification,
      extractionMock,
      matrixMock,
      auditMock,
      [],
      []
    );

    const elapsed = Date.now() - start;
    console.log(`[AUDIT] Completed in ${elapsed} ms`);

    // ETAPA 4: Mapear status visual
    const mappedStatus = 
      validationResult.status_minuta === "MINUTA APROVADA" ? "APROVADA" :
      validationResult.status_minuta === "APROVADA COM RESSALVAS" ? "APROVADA_COM_RESSALVAS" :
      "REPROVADA";

    return {
      pieceId,
      audit: {
        status: mappedStatus,
        score: report.qualidadeTecnica,
        classification: report.classificacaoFinal,
        fatalErrors: report.problemasFatais.map(e => ({ titulo: e.titulo, descricao: e.descricao, code: e.regra })),
        nonFatalErrors: report.problemasNaoFatais.map(e => ({ titulo: e.titulo, descricao: e.descricao, code: e.regra })),
        strengths: report.pontosFortes.map(e => ({ titulo: e.titulo, descricao: e.descricao })),
        rawReport: report,
      },
      feedback: this.feedbackReportService.generateFeedbackReport(report),
      correctionPlan: this.correctionPlanService.generateCorrectionPlan(report),
    };
  }
}

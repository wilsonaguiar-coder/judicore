import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FeedbackReportService } from "../../src/audit/feedback-report.service.js";
import type { AuditReport } from "../../src/audit-report/audit-report.types.js";

describe("FeedbackReportService", () => {
  const feedbackService = new FeedbackReportService();

  const baseAuditReport: AuditReport = {
    qualidadeTecnica: 100,
    viabilidadeJuridica: 100,
    classificacaoFinal: "VIAVEL",
    minutaIncompleta: false,
    scoreGeral: 100,
    classificacao: "EXCELENTE",
    problemasFatais: [],
    problemasNaoFatais: [],
    pontosFortes: [
      { titulo: "Excelente argumentação", descricao: "A peça tem boa argumentação" }
    ],
    sugestoesMelhoria: [],
    fundamentacaoJuridica: [],
    riscosProcessuais: [],
    consistenciaArgumentativa: { score: 100, resultado: "CONSISTENTE", detalhes: [] },
    qualidadeEstrutural: { score: 100, label: "EXCELENTE", itens: [] },
    qualidadeProbatoria: { score: 100, label: "EXCELENTE", itens: [] },
    qualidadeArgumentativa: { score: 100, normalizedScore: 100, perfil: "ALTO", dimensoes: [] }
  };

  it("1. Peça sem alertas - summary correto e strengths presentes", () => {
    const feedback = feedbackService.generateFeedbackReport(baseAuditReport);

    assert.equal(feedback.status, "APROVADA");
    assert.equal(feedback.summary, "A peça não apresentou inconsistências relevantes segundo os validadores atualmente ativos.");
    assert.equal(feedback.criticalFindings.length, 0);
    assert.equal(feedback.warnings.length, 0);
    assert.equal(feedback.strengths.length, 1);
    assert.equal(feedback.strengths[0], "Excelente argumentação");
  });

  it("2. Peça com alertas não fatais - warnings preenchido", () => {
    const audit: AuditReport = {
      ...baseAuditReport,
      classificacaoFinal: "ATENCAO",
      problemasNaoFatais: [
        { titulo: "Título não fatal", descricao: "Desc", regra: "FINAL_DRAFT_GENERIC_LANGUAGE" }
      ]
    };

    const feedback = feedbackService.generateFeedbackReport(audit);

    assert.equal(feedback.status, "APROVADA_COM_RESSALVAS");
    assert.equal(feedback.summary, "Foram identificados pontos que merecem revisão, mas que não comprometem automaticamente a viabilidade jurídica da peça.");
    assert.equal(feedback.criticalFindings.length, 0);
    assert.equal(feedback.warnings.length, 1);
    assert.equal(feedback.warnings[0]!.code, "FINAL_DRAFT_GENERIC_LANGUAGE");
  });

  it("3. Peça com alertas fatais - criticalFindings preenchido", () => {
    const audit: AuditReport = {
      ...baseAuditReport,
      classificacaoFinal: "RISCO_ELEVADO",
      problemasFatais: [
        { titulo: "Título fatal", descricao: "Desc", regra: "UNADDRESSED_MAIN_REQUEST" }
      ]
    };

    const feedback = feedbackService.generateFeedbackReport(audit);

    assert.equal(feedback.status, "REPROVADA");
    assert.equal(feedback.summary, "Foram identificadas inconsistências relevantes que podem comprometer a segurança jurídica da peça.");
    assert.equal(feedback.criticalFindings.length, 1);
    assert.equal(feedback.warnings.length, 0);
    assert.equal(feedback.criticalFindings[0]!.code, "UNADDRESSED_MAIN_REQUEST");
  });

  it("4. Conversão correta de: code, title, explanation, suggestion", () => {
    const audit: AuditReport = {
      ...baseAuditReport,
      problemasFatais: [
        { 
          titulo: "Será substituído pelo RULE_TITLES se existir", 
          descricao: "Desc", 
          regra: "UNADDRESSED_MAIN_REQUEST" 
        }
      ]
    };

    const feedback = feedbackService.generateFeedbackReport(audit);
    const item = feedback.criticalFindings[0]!;

    assert.equal(item.code, "UNADDRESSED_MAIN_REQUEST");
    // O title deve vir de RULE_TITLES que é "Pedido principal não enfrentado no dispositivo" ou similar
    assert.ok(item.title.length > 0);
    assert.ok(item.title !== "Será substituído pelo RULE_TITLES se existir", "Deveria ter usado o title do RULE_TITLES");
    assert.equal(item.explanation, "O sistema identificou indícios de que um pedido principal formulado na peça não recebeu tratamento correspondente no dispositivo.");
    // Suggestion deve vir de RULE_SUGGESTIONS
    assert.ok(item.suggestion !== undefined && item.suggestion.length > 0, "Deveria ter a suggestion do RULE_SUGGESTIONS");
  });
});

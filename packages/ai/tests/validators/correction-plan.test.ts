import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CorrectionPlanService } from "../../src/audit/correction-plan.service.js";
import type { AuditReport } from "../../src/audit-report/audit-report.types.js";

describe("CorrectionPlanService", () => {
  const correctionService = new CorrectionPlanService();

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

  it("1. Sem alertas -> CorrectionPlan vazio", () => {
    const plan = correctionService.generateCorrectionPlan(baseAuditReport);

    assert.equal(plan.status, "APROVADA");
    assert.equal(plan.items.length, 0, "Deveria estar vazio");
  });

  it("2. Erro HIGH -> Item HIGH presente", () => {
    const audit: AuditReport = {
      ...baseAuditReport,
      classificacaoFinal: "RISCO_ELEVADO",
      problemasFatais: [
        { titulo: "Contradição Médica", descricao: "Desc", regra: "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION" }
      ]
    };

    const plan = correctionService.generateCorrectionPlan(audit);

    assert.equal(plan.status, "REPROVADA");
    assert.equal(plan.items.length, 1);
    assert.equal(plan.items[0]!.priority, "HIGH");
    assert.equal(plan.items[0]!.code, "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION");
  });

  it("3. Erro MEDIUM -> Item MEDIUM presente", () => {
    const audit: AuditReport = {
      ...baseAuditReport,
      classificacaoFinal: "ATENCAO",
      problemasNaoFatais: [
        { titulo: "Linguagem Genérica", descricao: "Desc", regra: "FINAL_DRAFT_GENERIC_LANGUAGE" }
      ]
    };

    const plan = correctionService.generateCorrectionPlan(audit);

    assert.equal(plan.status, "APROVADA_COM_RESSALVAS");
    assert.equal(plan.items.length, 1);
    assert.equal(plan.items[0]!.priority, "MEDIUM");
    assert.equal(plan.items[0]!.code, "FINAL_DRAFT_GENERIC_LANGUAGE");
  });

  it("4. Ordenação correta -> HIGH antes de MEDIUM", () => {
    const audit: AuditReport = {
      ...baseAuditReport,
      problemasNaoFatais: [
        { titulo: "Linguagem Genérica", descricao: "Desc", regra: "FINAL_DRAFT_GENERIC_LANGUAGE" }, // MEDIUM
        { titulo: "Contradição", descricao: "Desc", regra: "PRESCRIPTION_PROCEDENCE_CONTRADICTION" } // HIGH
      ]
    };

    const plan = correctionService.generateCorrectionPlan(audit);

    assert.equal(plan.items.length, 2);
    assert.equal(plan.items[0]!.priority, "HIGH");
    assert.equal(plan.items[1]!.priority, "MEDIUM");
    assert.equal(plan.items[0]!.code, "PRESCRIPTION_PROCEDENCE_CONTRADICTION");
    assert.equal(plan.items[1]!.code, "FINAL_DRAFT_GENERIC_LANGUAGE");
  });

  it("5. Mapeamento correto -> code, priority, area, instruction", () => {
    const audit: AuditReport = {
      ...baseAuditReport,
      problemasFatais: [
        { titulo: "Pedido Não Enfrentado", descricao: "Desc", regra: "UNADDRESSED_MAIN_REQUEST" }
      ]
    };

    const plan = correctionService.generateCorrectionPlan(audit);
    const item = plan.items[0]!;

    assert.equal(item.code, "UNADDRESSED_MAIN_REQUEST");
    assert.equal(item.priority, "HIGH");
    assert.equal(item.area, "DISPOSITIVO");
    assert.equal(item.instruction, "Verificar se todos os pedidos principais formulados na peça foram enfrentados expressamente no dispositivo.");
  });
});

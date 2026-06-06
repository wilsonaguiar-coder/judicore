import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ComparativeAuditService } from "../../src/audit/comparison/comparative-audit.service.js";
import type { AuditReport } from "../../src/audit-report/audit-report.types.js";
import type { IntegratedAuditResponse } from "../../src/audit/audit.service.js";

describe("ComparativeAuditService", () => {
  const service = new ComparativeAuditService();

  const baseReport: AuditReport = {
    qualidadeTecnica: 80,
    viabilidadeJuridica: 80,
    classificacaoFinal: "ATENCAO",
    minutaIncompleta: false,
    scoreGeral: 80,
    classificacao: "BOA",
    problemasFatais: [],
    problemasNaoFatais: [
      { titulo: "A", descricao: "A", regra: "WARN_A", severidade: "IMPORTANTE" },
      { titulo: "B", descricao: "B", regra: "WARN_B", severidade: "SUGESTAO" }
    ],
    pontosFortes: [],
    sugestoesMelhoria: [],
    fundamentacaoJuridica: [],
    riscosProcessuais: [],
    consistenciaArgumentativa: { score: 100, resultado: "CONSISTENTE", detalhes: [] },
    qualidadeEstrutural: { score: 100, label: "EXCELENTE", itens: [] },
    qualidadeProbatoria: { score: 100, label: "EXCELENTE", itens: [] },
    qualidadeArgumentativa: { score: 100, normalizedScore: 100, perfil: "ALTO", dimensoes: [] }
  };

  it("1. Sem mudan\u00E7a: same alerts, same score", () => {
    const result = service.compareAudits(baseReport, baseReport);

    assert.equal(result.removedAlerts.length, 0);
    assert.equal(result.newAlerts.length, 0);
    assert.equal(result.keptAlerts.length, 2);
    assert.equal(result.improved, false);
    assert.equal(result.regressed, false);
    assert.equal(result.scoreDelta, 0);
    assert.equal(result.summary, "A nova vers\u00E3o manteve resultado semelhante ao anterior.");
  });

  it("2. Melhoria: alerta removido e score maior", () => {
    const currentReport: AuditReport = {
      ...baseReport,
      qualidadeTecnica: 90,
      problemasNaoFatais: [
        { titulo: "B", descricao: "B", regra: "WARN_B", severidade: "SUGESTAO" }
      ]
    };

    const result = service.compareAudits(baseReport, currentReport);

    assert.equal(result.improved, true);
    assert.equal(result.regressed, false);
    assert.equal(result.scoreDelta, 10);
    assert.equal(result.removedAlerts.length, 1);
    assert.equal(result.removedAlerts[0]!.code, "WARN_A");
    assert.equal(result.newAlerts.length, 0);
    assert.equal(result.keptAlerts.length, 1);
    assert.equal(result.summary, "A nova vers\u00E3o reduziu alertas e/ou aumentou o score da auditoria.");
  });

  it("3. Regress\u00E3o: alerta novo e score menor", () => {
    const currentReport: AuditReport = {
      ...baseReport,
      qualidadeTecnica: 70,
      problemasNaoFatais: [
        ...baseReport.problemasNaoFatais,
        { titulo: "C", descricao: "C", regra: "WARN_C", severidade: "IMPORTANTE" }
      ]
    };

    const result = service.compareAudits(baseReport, currentReport);

    assert.equal(result.improved, false);
    assert.equal(result.regressed, true);
    assert.equal(result.scoreDelta, -10);
    assert.equal(result.newAlerts.length, 1);
    assert.equal(result.newAlerts[0]!.code, "WARN_C");
    assert.equal(result.removedAlerts.length, 0);
    assert.equal(result.summary, "A nova vers\u00E3o introduziu novos alertas ou reduziu o score da auditoria.");
  });

  it("4. Score ausente: compara\u00E7\u00E3o funciona por alertas", () => {
    const prev: any = { ...baseReport, qualidadeTecnica: undefined };
    const curr: any = { 
      ...baseReport, 
      qualidadeTecnica: undefined, 
      problemasNaoFatais: [{ titulo: "A", descricao: "A", regra: "WARN_A" }] 
    };

    const result = service.compareAudits(prev, curr);

    assert.equal(result.scoreDelta, undefined);
    assert.equal(result.removedAlerts.length, 1);
    assert.equal(result.removedAlerts[0]!.code, "WARN_B");
    assert.equal(result.improved, true);
    assert.equal(result.regressed, false);
  });

  it("5. Fatal + nonFatal: ambos entram na compara\u00E7\u00E3o", () => {
    const prev: AuditReport = {
      ...baseReport,
      problemasFatais: [{ titulo: "F1", descricao: "F1", regra: "FATAL_1" }],
      problemasNaoFatais: []
    };
    const curr: AuditReport = {
      ...baseReport,
      problemasFatais: [],
      problemasNaoFatais: [{ titulo: "W1", descricao: "W1", regra: "WARN_1" }]
    };

    const result = service.compareAudits(prev, curr);

    assert.equal(result.removedAlerts.length, 1);
    assert.equal(result.removedAlerts[0]!.code, "FATAL_1");
    assert.equal(result.newAlerts.length, 1);
    assert.equal(result.newAlerts[0]!.code, "WARN_1");
    // Empate no total de remo\u00E7\u00F5es/novos. Como baseReport tem score = score, improved e regressed false
    assert.equal(result.improved, false);
    assert.equal(result.regressed, false);
  });

  it("6. IntegratedAuditResponse: fun\u00E7\u00E3o aceita envelope integrado", () => {
    const prevInt: IntegratedAuditResponse = {
      pieceId: "1",
      audit: {
        status: "ATENCAO",
        score: 80,
        classification: "ATENCAO",
        fatalErrors: [],
        nonFatalErrors: [{ titulo: "A", descricao: "A", code: "WARN_A" }],
        strengths: []
      }
    };
    const currInt: IntegratedAuditResponse = {
      pieceId: "1",
      audit: {
        status: "APROVADA",
        score: 95,
        classification: "VIAVEL",
        fatalErrors: [],
        nonFatalErrors: [],
        strengths: []
      }
    };

    const result = service.compareAudits(prevInt, currInt);

    assert.equal(result.scoreDelta, 15);
    assert.equal(result.removedAlerts.length, 1);
    assert.equal(result.removedAlerts[0]!.code, "WARN_A");
    assert.equal(result.improved, true);
  });

  it("7. Summary correto para: melhoria, regress\u00E3o, estabilidade", () => {
    // J\u00E1 coberto nos testes 1, 2 e 3. Validamos s\u00F3 mais um de estabilidade com alertas diferentes mas mesmo n\u00FAmero
    const prev: AuditReport = {
      ...baseReport,
      problemasNaoFatais: [{ titulo: "A", descricao: "A", regra: "WARN_A" }]
    };
    const curr: AuditReport = {
      ...baseReport,
      problemasNaoFatais: [{ titulo: "B", descricao: "B", regra: "WARN_B" }]
    };

    const result = service.compareAudits(prev, curr);
    assert.equal(result.summary, "A nova vers\u00E3o manteve resultado semelhante ao anterior.");
  });
});

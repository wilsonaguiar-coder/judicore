import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StructuralValidator } from "../validators/structural.validator.js";
import { LegalRulesValidator } from "../validators/legal.validator.js";
import { AppealValidator } from "../validators/appeal.validator.js";
import { JurisprudenceValidator } from "../validators/jurisprudence.validator.js";
import { GenericityValidator } from "../validators/genericity.validator.js";
import { FinalValidator } from "../validators/final.validator.js";
import type { LegalClassification, LegalExtraction, ArgumentationMatrix, LegalAudit } from "../pipeline/types.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeClassification(overrides: Partial<LegalClassification> = {}): LegalClassification {
  return {
    tipo_justica: "ESTADUAL",
    tipo_peca: "SENTENCA",
    regime_juridico: "CIVIL",
    grau: "PRIMEIRO",
    tribunal_competente: "TJSP",
    rito: null,
    assunto_principal: "indenização por danos morais",
    partes: { autor: "Autor A", reu: "Réu B" },
    confianca: 0.90,
    ...overrides,
  };
}

function makeExtraction(overrides: Partial<LegalExtraction> = {}): LegalExtraction {
  return {
    fatos: ["Fato 1 concreto ocorrido em 10/01/2024", "Fato 2 detalhado com valor R$ 5.000", "Fato 3 com consequência jurídica"],
    pedidos: ["Condenação em indenização por danos morais no valor de R$ 10.000", "Condenação em custas e honorários"],
    questoes_juridicas: ["Responsabilidade civil extracontratual", "Nexo causal entre conduta e dano"],
    artigos_citados: ["art. 186 CC/2002", "art. 927 CC/2002"],
    jurisprudencias_relevantes: [],
    qualidade_extracao: "SUFICIENTE",
    ...overrides,
  };
}

function makeMatrix(overrides: Partial<ArgumentationMatrix> = {}): ArgumentationMatrix {
  return {
    teses: [
      { id: "tese_001", pedido: "Indenização por danos morais", fato: "Fato 1", norma: "art. 186 CC/2002", jurisprudencia_id: null, conclusao: "Deve ser acolhido" },
    ],
    ...overrides,
  };
}

function makeAudit(overrides: Partial<LegalAudit> = {}): LegalAudit {
  return {
    aprovada: true,
    score: 85,
    erros: [],
    resumo: "Peça aprovada",
    ...overrides,
  };
}

// ── Teste 1: Input genérico → modo TEMPLATE_MODEL ─────────────────────────────

describe("Teste 1: Input genérico detectado na extração", () => {
  it("qualidade INSUFICIENTE deve gerar SAFE_SKELETON (via FinalValidator)", () => {
    const finalValidator = new FinalValidator();
    const classification = makeClassification({ confianca: 0.45, tipo_justica: "INDETERMINADA" });
    const extraction = makeExtraction({ qualidade_extracao: "INSUFICIENTE", fatos: [], pedidos: [] });
    const result = finalValidator.validate(
      "Peça qualquer texto genérico",
      classification,
      extraction,
      makeMatrix({ teses: [] }),
      makeAudit({ aprovada: false, score: 20 }),
      [],
      "SAFE_SKELETON",
    );
    assert.equal(result.document_confidence, 0.20, "SAFE_SKELETON deve ter confiança 0.20");
    assert.equal(result.status_minuta, "MINUTA PARA REVISÃO");
  });
});

// ── Teste 2: Sentença sem dispositivo → falha estrutural ──────────────────────

describe("Teste 2: Sentença sem seção dispositivo", () => {
  it("deve gerar erro MISSING_STRUCTURE fatal", () => {
    const validator = new StructuralValidator();
    const draft = `
      RELATÓRIO
      Trata-se de ação indenizatória...
      FUNDAMENTAÇÃO
      O autor demonstrou os fatos...
    `;
    const result = validator.validate(draft, "SENTENCA");
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "Sentença sem dispositivo deve ter erro fatal");
    assert.ok(
      result.errors.some((e) => e.message.toLowerCase().includes("dispositivo") || e.message.toLowerCase().includes("julgo")),
      "Erro deve mencionar dispositivo ou julgo",
    );
  });
});

// ── Teste 3: DECISAO sem "É o relatório. Decido." ────────────────────────────

describe("Teste 3: DECISÃO sem frase obrigatória", () => {
  it("deve gerar erro de estrutura", () => {
    const validator = new StructuralValidator();
    const draft = `
      Processo nº 0001234-56.2024.8.26.0000
      Trata-se de requerimento de tutela de urgência...
      Ante o exposto, DEFIRO a tutela de urgência.
    `;
    const result = validator.validate(draft, "DECISAO");
    assert.ok(
      result.errors.some((e) => e.message.toLowerCase().includes("relatório") || e.message.toLowerCase().includes("decido")),
      "DECISAO sem 'É o relatório. Decido.' deve gerar erro",
    );
  });
});

// ── Teste 4: DESPACHO com "julgo" → falha ────────────────────────────────────

describe("Teste 4: DESPACHO com linguagem decisória", () => {
  it("deve gerar erro fatal por conter 'julgo'", () => {
    const validator = new StructuralValidator();
    const draft = `
      Processo nº 0001234-56.2024.8.26.0000
      Intime-se o réu para contestar no prazo legal.
      Ante o exposto, julgo procedente o pedido e condeno o réu ao pagamento de danos morais.
    `;
    const result = validator.validate(draft, "DESPACHO");
    const julgoError = result.errors.find((e) => e.message.toLowerCase().includes("julg") || e.rule === "FORBIDDEN_STRUCTURE");
    assert.ok(julgoError, "DESPACHO com 'julgo' deve gerar erro");
    assert.ok(julgoError.fatal, "Erro deve ser fatal");
  });
});

// ── Teste 5: TRABALHO com "apelação" → falha fatal ───────────────────────────

describe("Teste 5: Recurso trabalhista com 'apelação'", () => {
  it("deve gerar erro fatal pois apelação não existe na Justiça do Trabalho", () => {
    const validator = new AppealValidator();
    const classification = makeClassification({ tipo_justica: "TRABALHO", tipo_peca: "RECURSO", regime_juridico: "CLT" });
    const draft = "Interpõe-se APELAÇÃO contra a sentença proferida em primeiro grau.";
    const result = validator.validate(draft, classification);
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "Apelação em processo trabalhista deve gerar erro fatal");
  });
});

// ── Teste 6: RPPS com art. 201 CF → falha fatal ──────────────────────────────

describe("Teste 6: Regime RPPS citando art. 201 CF (regime do INSS)", () => {
  it("deve gerar erro fatal pois art. 201 é do RGPS (INSS), não do RPPS", () => {
    const validator = new LegalRulesValidator();
    const classification = makeClassification({ tipo_justica: "ESTADUAL", regime_juridico: "RPPS" });
    const draft = "O servidor faz jus à aposentadoria nos termos do art. 201 da CF/88, que rege o regime geral de previdência.";
    const result = validator.validateDraftArticles(draft, classification);
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "RPPS + art. 201 CF deve gerar erro fatal");
  });
});

// ── Teste 7: RGPS com art. 40 CF → falha fatal ───────────────────────────────

describe("Teste 7: Regime RGPS citando art. 40 CF (regime de servidores)", () => {
  it("deve gerar erro fatal pois art. 40 é do RPPS (servidores), não do RGPS", () => {
    const validator = new LegalRulesValidator();
    const classification = makeClassification({ tipo_justica: "FEDERAL", regime_juridico: "RGPS" });
    const draft = "O segurado do INSS tem direito à aposentadoria conforme o art. 40 da Constituição Federal.";
    const result = validator.validateDraftArticles(draft, classification);
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "RGPS + art. 40 CF deve gerar erro fatal");
  });
});

// ── Teste 8: [JUR-1] no texto final → falha fatal ────────────────────────────

describe("Teste 8: Marcador [JUR-1] encontrado no texto final", () => {
  it("deve gerar erro fatal pois marcadores internos não devem aparecer na peça", () => {
    const validator = new JurisprudenceValidator();
    const draft = "Conforme decidido em [JUR-1], o entendimento é pacífico no sentido de que...";
    const classification = makeClassification();
    const errors = validator.validateDraftJurisprudence(draft, [], classification);
    const fatalErrors = errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "[JUR-N] no texto final deve gerar erro fatal");
    assert.ok(errors[0]?.rule === "JUR_MARKER_IN_DRAFT");
  });
});

// ── Teste 9: HC com "julgo improcedente" → falha ─────────────────────────────

describe("Teste 9: Habeas corpus com linguagem ordinária ('julgo improcedente')", () => {
  it("deve gerar erro fatal pois HC usa 'concedo/denego a ordem', não 'julgo procedente/improcedente'", () => {
    const validator = new LegalRulesValidator();
    const classification = makeClassification({
      tipo_justica: "CRIMINAL",
      tipo_peca: "SENTENCA",
      regime_juridico: "CRIMINAL",
      assunto_principal: "habeas corpus impetrado em favor de preso provisório",
    });
    const draft = `
      Vistos.
      Trata-se de habeas corpus impetrado em favor do paciente João da Silva, preso preventivamente.
      Ante o exposto, JULGO IMPROCEDENTE o habeas corpus, mantendo a prisão preventiva.
    `;
    const result = validator.validateDraftArticles(draft, classification);
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "'julgo improcedente' em matéria criminal deve gerar erro fatal");
    assert.ok(
      result.errors.some((e) => e.rule === "CRIMINAL_WRONG_TERM"),
      "Deve haver erro CRIMINAL_WRONG_TERM",
    );
  });
});

// ── Teste 10: Alto genericityScore → MINUTA PARA REVISÃO ────────────────────

describe("Teste 10: Peça genérica deve resultar em MINUTA PARA REVISÃO", () => {
  it("score de genericidade alto reduz confiança abaixo de 0.80", () => {
    const finalValidator = new FinalValidator();
    const classification = makeClassification({ confianca: 0.70 });
    const extraction = makeExtraction({
      qualidade_extracao: "PARCIAL",
      fatos: ["fato genérico"],
      pedidos: [],
    });
    const genericDraft = `
      O autor vem perante Vossa Excelência expor e requerer o seguinte.
      Conforme os fatos acima narrados, o réu agiu de forma contrária ao direito.
      Diante do exposto, requer-se a procedência dos pedidos.
      [INSERIR FATOS ESPECÍFICOS DO CASO]
      [INSERIR FUNDAMENTAÇÃO JURÍDICA]
      [PREENCHER COM DADOS REAIS]
    `;
    const result = finalValidator.validate(
      genericDraft,
      classification,
      extraction,
      makeMatrix({ teses: [] }),
      makeAudit({ aprovada: false, score: 50 }),
      [],
      "TEMPLATE_MODEL",
    );
    assert.equal(result.status_minuta, "MINUTA PARA REVISÃO", "Peça genérica deve ser MINUTA PARA REVISÃO");
    assert.ok(result.document_confidence < 0.80, `Confiança deve ser < 0.80, foi ${result.document_confidence}`);
  });
});

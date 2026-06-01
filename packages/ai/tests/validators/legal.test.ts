import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LegalRulesValidator } from "../../src/validators/legal.validator.js";
import { makeClassification } from "../helpers/factories.js";

describe("LegalRulesValidator — RPPS + art. 201 CF (uso direto como fundamento)", () => {
  it("deve emitir RPPS_WRONG_ARTICLE FATAL", () => {
    const validator = new LegalRulesValidator();
    const classification = makeClassification({ tipo_justica: "ESTADUAL", regime_juridico: "RPPS" });
    const draft =
      "O servidor faz jus à aposentadoria nos termos do art. 201 da CF/88, conforme assegurado pela legislação.";
    const result = validator.validateDraftArticles(draft, classification);
    const wrongArticleError = result.errors.find((e) => e.rule === "RPPS_WRONG_ARTICLE");
    assert.ok(wrongArticleError, "uso direto do art. 201 em RPPS deve emitir RPPS_WRONG_ARTICLE");
    assert.equal(wrongArticleError?.fatal, true, "uso direto deve ser fatal");
  });
});

describe("LegalRulesValidator — RPPS + art. 201 CF (uso distintivo)", () => {
  it("NÃO deve emitir erro quando art. 201 é citado para distinguir RPPS de RGPS", () => {
    const validator = new LegalRulesValidator();
    const classification = makeClassification({ tipo_justica: "ESTADUAL", regime_juridico: "RPPS" });
    const draft =
      "O regime RPPS aplicável ao servidor não se confunde com o art. 201 CF (RGPS/INSS). Diferentemente do regime geral, o RPPS rege-se pelo art. 40 CF/88.";
    const result = validator.validateDraftArticles(draft, classification);
    const wrongArticleError = result.errors.find((e) => e.rule === "RPPS_WRONG_ARTICLE");
    assert.equal(wrongArticleError, undefined, "uso distintivo NÃO deve gerar erro");
  });
});

describe("LegalRulesValidator — RGPS + art. 40 CF (uso direto como fundamento)", () => {
  it("deve emitir RGPS_WRONG_ARTICLE FATAL", () => {
    const validator = new LegalRulesValidator();
    const classification = makeClassification({ tipo_justica: "FEDERAL", regime_juridico: "RGPS" });
    const draft =
      "O segurado tem direito à aposentadoria com fundamento no art. 40 da Constituição Federal, nos termos da legislação.";
    const result = validator.validateDraftArticles(draft, classification);
    const wrongArticleError = result.errors.find((e) => e.rule === "RGPS_WRONG_ARTICLE");
    assert.ok(wrongArticleError, "uso direto do art. 40 em RGPS deve emitir RGPS_WRONG_ARTICLE");
    assert.equal(wrongArticleError?.fatal, true, "uso direto deve ser fatal");
  });
});

describe("LegalRulesValidator — HC com 'julgo improcedente'", () => {
  it("deve emitir CRIMINAL_WRONG_TERM fatal", () => {
    const validator = new LegalRulesValidator();
    const classification = makeClassification({
      tipo_justica: "CRIMINAL",
      tipo_peca: "SENTENCA",
      regime_juridico: "CRIMINAL",
      assunto_principal: "habeas corpus",
    });
    const draft = `
      Trata-se de habeas corpus em favor do paciente.
      Ante o exposto, JULGO IMPROCEDENTE o habeas corpus, mantendo a prisão preventiva.
    `;
    const result = validator.validateDraftArticles(draft, classification);
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "'julgo improcedente' em criminal deve gerar erro fatal");
    assert.ok(
      result.errors.some((e) => e.rule === "CRIMINAL_WRONG_TERM"),
      "Deve haver erro CRIMINAL_WRONG_TERM",
    );
  });
});

describe("LegalRulesValidator — art. 85 CPC em criminal", () => {
  it("deve emitir WRONG_HONORARIOS_CRIMINAL fatal", () => {
    const validator = new LegalRulesValidator();
    const classification = makeClassification({
      tipo_justica: "CRIMINAL",
      tipo_peca: "SENTENCA",
      regime_juridico: "CRIMINAL",
    });
    const draft = "Condeno o réu em honorários advocatícios nos termos do art. 85 CPC.";
    const result = validator.validateDraftArticles(draft, classification);
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "art. 85 CPC em criminal deve gerar erro fatal");
    assert.ok(
      result.errors.some((e) => e.rule === "WRONG_HONORARIOS_CRIMINAL"),
      "Deve haver erro WRONG_HONORARIOS_CRIMINAL",
    );
  });
});

describe("LegalRulesValidator — art. 85 CPC em trabalhista", () => {
  it("deve emitir WRONG_HONORARIOS fatal", () => {
    const validator = new LegalRulesValidator();
    const classification = makeClassification({ tipo_justica: "TRABALHO", regime_juridico: "CLT" });
    const draft = "Condeno o reclamado em honorários nos termos do art. 85 CPC.";
    const result = validator.validateDraftArticles(draft, classification);
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "art. 85 CPC em trabalhista deve gerar erro fatal");
    assert.ok(
      result.errors.some((e) => e.rule === "WRONG_HONORARIOS"),
      "Deve haver erro WRONG_HONORARIOS",
    );
  });
});

describe("LegalRulesValidator — PROHIBITED_TERM ('Excelentíssimo' em SENTENCA)", () => {
  it("deve emitir erro fatal", () => {
    const validator = new LegalRulesValidator();
    const classification = makeClassification({ tipo_peca: "SENTENCA" });
    const draft = "Excelentíssimo Senhor Doutor Juiz, vem o autor expor...";
    const result = validator.validateDraftArticles(draft, classification);
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "'Excelentíssimo' em SENTENCA deve gerar erro fatal");
    assert.ok(
      result.errors.some((e) => e.rule === "PROHIBITED_TERM"),
      "Deve haver erro PROHIBITED_TERM",
    );
  });
});

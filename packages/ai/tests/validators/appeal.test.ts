import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppealValidator } from "../../src/validators/appeal.validator.js";
import { makeClassification } from "../helpers/factories.js";

describe("AppealValidator — TRABALHO + apelação", () => {
  it("deve emitir INCOMPATIBLE_APPEAL fatal", () => {
    const validator = new AppealValidator();
    const classification = makeClassification({
      tipo_justica: "TRABALHO",
      tipo_peca: "RECURSO",
      regime_juridico: "CLT",
    });
    const draft = "Interpõe-se APELAÇÃO contra a sentença proferida em primeiro grau.";
    const result = validator.validate(draft, classification);
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "Apelação em trabalhista deve gerar erro fatal");
    assert.ok(
      result.errors.some((e) => e.rule === "INCOMPATIBLE_APPEAL"),
      "Deve haver erro INCOMPATIBLE_APPEAL",
    );
  });
});

describe("AppealValidator — TRABALHO + STJ", () => {
  it("deve emitir WRONG_SUPERIOR_COURT fatal", () => {
    const validator = new AppealValidator();
    const classification = makeClassification({
      tipo_justica: "TRABALHO",
      tipo_peca: "RECURSO",
      regime_juridico: "CLT",
    });
    const draft =
      "Interpõe-se Recurso de Revista ao Superior Tribunal de Justiça — STJ, requerendo provimento.";
    const result = validator.validate(draft, classification);
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "STJ em trabalhista deve gerar erro fatal");
    assert.ok(
      result.errors.some((e) => e.rule === "WRONG_SUPERIOR_COURT"),
      "Deve haver erro WRONG_SUPERIOR_COURT",
    );
  });
});

describe("AppealValidator — JEF + apelação", () => {
  it("deve emitir JEF_JEC_WRONG_APPEAL fatal", () => {
    const validator = new AppealValidator();
    const classification = makeClassification({
      tipo_justica: "JEF",
      tipo_peca: "RECURSO",
      regime_juridico: "RGPS",
    });
    const draft = "Interpõe-se apelação contra a sentença do JEF que julgou improcedente o pedido.";
    const result = validator.validate(draft, classification);
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "Apelação em JEF deve gerar erro fatal");
    assert.ok(
      result.errors.some((e) => e.rule === "JEF_JEC_WRONG_APPEAL"),
      "Deve haver erro JEF_JEC_WRONG_APPEAL",
    );
  });
});

describe("AppealValidator — JEC + apelação", () => {
  it("deve emitir JEF_JEC_WRONG_APPEAL fatal", () => {
    const validator = new AppealValidator();
    const classification = makeClassification({
      tipo_justica: "JEC",
      tipo_peca: "RECURSO",
      regime_juridico: "CIVIL",
    });
    const draft = "Apelação interposta em face da sentença do Juizado Especial Cível.";
    const result = validator.validate(draft, classification);
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "Apelação em JEC deve gerar erro fatal");
    assert.ok(
      result.errors.some((e) => e.rule === "JEF_JEC_WRONG_APPEAL"),
      "Deve haver erro JEF_JEC_WRONG_APPEAL",
    );
  });
});

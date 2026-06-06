import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppealValidator } from "../../src/validators/appeal.validator.js";
import { JefCivelValidator } from "../../src/validators/jef-civel.validator.js";
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

// JEF/JEC: AppealValidator delega ao JefCivelValidator (comentário na linha 32
// de appeal.validator.ts). O código real emitido é JEF_RECURSO_ERRADO.

describe("JefCivelValidator — JEF + apelação", () => {
  it("deve emitir JEF_RECURSO_ERRADO fatal", () => {
    const validator = new JefCivelValidator();
    const classification = makeClassification({
      tipo_justica: "JEF",
      tipo_peca: "RECURSO",
      regime_juridico: "RGPS",
      assunto_principal: "benefício previdenciário — Juizado Especial Federal (Lei 10.259/01)",
    });
    const draft =
      "O apelante recorre mediante apelação da sentença proferida pelo Juizado Especial Federal " +
      "(Lei 10.259/01), requerendo sua reforma.";
    const result = validator.validate(draft, classification);
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "Apelação em JEF deve gerar erro fatal");
    assert.ok(
      result.errors.some((e) => e.rule === "JEF_RECURSO_ERRADO"),
      "Deve haver erro JEF_RECURSO_ERRADO",
    );
  });
});

describe("JefCivelValidator — JEC + apelação", () => {
  it("deve emitir JEF_RECURSO_ERRADO fatal", () => {
    const validator = new JefCivelValidator();
    const classification = makeClassification({
      tipo_justica: "JEC",
      tipo_peca: "RECURSO",
      regime_juridico: "CIVIL",
      assunto_principal: "relação de consumo — Juizado Especial Cível (Lei 9.099/95)",
    });
    const draft =
      "O apelante recorre da sentença proferida pelo Juizado Especial Cível (Lei 9.099/95), " +
      "requerendo sua reforma mediante a presente apelação.";
    const result = validator.validate(draft, classification);
    const fatalErrors = result.errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "Apelação em JEC deve gerar erro fatal");
    assert.ok(
      result.errors.some((e) => e.rule === "JEF_RECURSO_ERRADO"),
      "Deve haver erro JEF_RECURSO_ERRADO",
    );
  });
});

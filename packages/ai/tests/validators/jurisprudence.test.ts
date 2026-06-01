import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JurisprudenceValidator } from "../../src/validators/jurisprudence.validator.js";
import { makeClassification } from "../helpers/factories.js";

describe("JurisprudenceValidator — [JUR-N] no texto final", () => {
  it("deve gerar erro fatal JUR_MARKER_IN_DRAFT", () => {
    const validator = new JurisprudenceValidator();
    const draft = "Conforme decidido em [JUR-1], o entendimento é pacífico no sentido de que...";
    const classification = makeClassification();
    const errors = validator.validateDraftJurisprudence(draft, [], classification);
    const fatalErrors = errors.filter((e) => e.fatal);
    assert.ok(fatalErrors.length > 0, "[JUR-N] no texto final deve gerar erro fatal");
    assert.equal(errors[0]?.rule, "JUR_MARKER_IN_DRAFT");
  });
});

describe("JurisprudenceValidator — referência genérica a tribunal", () => {
  it("deve gerar erro GENERIC_JURISPRUDENCE (não fatal)", () => {
    const validator = new JurisprudenceValidator();
    const draft = "Decisão do STJ que entende ser devida a indenização nos casos de inscrição indevida.";
    const classification = makeClassification({ tipo_justica: "ESTADUAL" });
    const errors = validator.validateDraftJurisprudence(draft, [], classification);
    assert.ok(
      errors.some((e) => e.rule === "GENERIC_JURISPRUDENCE"),
      "Referência genérica deve gerar GENERIC_JURISPRUDENCE",
    );
  });
});

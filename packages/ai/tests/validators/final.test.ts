import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FinalValidator, resolveDocumentStatus } from "../../src/validators/final.validator.js";
import { makeClassification, makeExtraction, makeMatrix, makeAudit } from "../helpers/factories.js";

describe("FinalValidator — SAFE_SKELETON confidence 0.20", () => {
  it("deve retornar confidence fixo 0.20 e status APROVADA COM RESSALVAS", () => {
    const validator = new FinalValidator();
    const result = validator.validate(
      "Esqueleto estruturado com placeholders.",
      makeClassification({ confianca: 0.99 }),
      makeExtraction({ fatos: ["f1", "f2", "f3"], pedidos: ["p1", "p2"] }),
      makeMatrix(),
      makeAudit({ score: 100 }),
      [],
      "SAFE_SKELETON",
    );
    assert.equal(result.document_confidence, 0.2);
    assert.equal(result.status_minuta, "APROVADA COM RESSALVAS");
  });
});

describe("FinalValidator — TEMPLATE_MODEL confidence 0.50", () => {
  it("deve retornar confidence fixo 0.50 e status APROVADA COM RESSALVAS", () => {
    const validator = new FinalValidator();
    const result = validator.validate(
      "Modelo estruturado.",
      makeClassification({ confianca: 0.95 }),
      makeExtraction(),
      makeMatrix(),
      makeAudit({ score: 95 }),
      [],
      "TEMPLATE_MODEL",
    );
    assert.equal(result.document_confidence, 0.5);
    assert.equal(result.status_minuta, "APROVADA COM RESSALVAS");
  });
});

describe("FinalValidator — FINAL_DRAFT genérico com score 75", () => {
  it("deve resultar em REPROVADA e confidence <= 0.69", () => {
    const validator = new FinalValidator();
    const genericDraft = `
      O direito alegado pelo autor merece acolhimento.
      O reconhecimento do direito alegado é medida necessária.
      A pretensão da parte autora encontra amparo na legislação vigente.
      O cumprimento da obrigação deve ser imposto ao réu.
      O direito material postulado está demonstrado nos autos.
      [INSERIR FATOS ESPECÍFICOS]
    `;
    const result = validator.validate(
      genericDraft,
      makeClassification({ confianca: 0.9 }),
      makeExtraction(),
      makeMatrix(),
      makeAudit({ score: 75 }),
      [],
      "FINAL_DRAFT",
    );
    assert.equal(result.status_minuta, "REPROVADA");
    assert.ok(result.document_confidence <= 0.69);
    assert.ok(
      result.errors.some((e) => e.rule === "FINAL_DRAFT_GENERIC_LANGUAGE"),
      "Deve haver erro FINAL_DRAFT_GENERIC_LANGUAGE",
    );
  });
});

describe("resolveDocumentStatus — Caso 10: score 85 deve ser APROVADA COM RESSALVAS", () => {
  it("score entre 81-89 sem erros fatais resulta em APROVADA COM RESSALVAS", () => {
    const result = resolveDocumentStatus(85, [], "FINAL_DRAFT");
    assert.equal(result.status, "APROVADA COM RESSALVAS");
    assert.equal(result.blocked, false);
  });

  it("score 90+ sem erros resulta em MINUTA APROVADA", () => {
    const result = resolveDocumentStatus(92, [], "FINAL_DRAFT");
    assert.equal(result.status, "MINUTA APROVADA");
    assert.equal(result.blocked, false);
  });

  it("score 80 ou menor resulta em REPROVADA", () => {
    const result = resolveDocumentStatus(78, [], "FINAL_DRAFT");
    assert.equal(result.status, "REPROVADA");
    assert.equal(result.blocked, true);
  });

  it("FINAL_DRAFT com erro fatal sempre bloqueia, independente do score", () => {
    const result = resolveDocumentStatus(
      97,
      [{ rule: "X", message: "erro fatal", fatal: true }],
      "FINAL_DRAFT",
    );
    assert.equal(result.status, "REPROVADA");
    assert.equal(result.blocked, true);
  });

  it("SAFE_SKELETON nunca bloqueia, mesmo com fatal", () => {
    const result = resolveDocumentStatus(
      20,
      [{ rule: "X", message: "erro fatal", fatal: true }],
      "SAFE_SKELETON",
    );
    assert.equal(result.status, "APROVADA COM RESSALVAS");
    assert.equal(result.blocked, false);
  });

  it("TEMPLATE_MODEL nunca bloqueia, mesmo com fatal", () => {
    const result = resolveDocumentStatus(
      30,
      [{ rule: "X", message: "erro fatal", fatal: true }],
      "TEMPLATE_MODEL",
    );
    assert.equal(result.status, "APROVADA COM RESSALVAS");
    assert.equal(result.blocked, false);
  });
});

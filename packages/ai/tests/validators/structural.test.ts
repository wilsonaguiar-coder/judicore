import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StructuralValidator } from "../../src/validators/structural.validator.js";

describe("StructuralValidator — SENTENCA sem dispositivo", () => {
  it("deve gerar erro fatal", () => {
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
      result.errors.some(
        (e) => e.message.toLowerCase().includes("dispositivo") || e.message.toLowerCase().includes("julgo"),
      ),
      "Erro deve mencionar dispositivo ou julgo",
    );
  });
});

describe("StructuralValidator — DECISAO sem 'É o relatório. Decido.'", () => {
  it("deve gerar erro", () => {
    const validator = new StructuralValidator();
    const draft = `
      Processo nº 0001234-56.2024.8.26.0000
      Trata-se de requerimento de tutela de urgência...
      Ante o exposto, DEFIRO a tutela de urgência.
    `;
    const result = validator.validate(draft, "DECISAO");
    assert.ok(
      result.errors.some(
        (e) => e.message.toLowerCase().includes("relatório") || e.message.toLowerCase().includes("decido"),
      ),
      "DECISAO sem 'É o relatório. Decido.' deve gerar erro",
    );
  });
});

describe("StructuralValidator — DESPACHO com 'julgo'", () => {
  it("deve gerar erro fatal", () => {
    const validator = new StructuralValidator();
    const draft = `
      Processo nº 0001234-56.2024.8.26.0000
      Ante o exposto, julgo procedente o pedido e condeno o réu ao pagamento.
    `;
    const result = validator.validate(draft, "DESPACHO");
    const julgoError = result.errors.find(
      (e) => e.message.toLowerCase().includes("julg") || e.rule === "FORBIDDEN_STRUCTURE",
    );
    assert.ok(julgoError, "DESPACHO com 'julgo' deve gerar erro");
    assert.ok(julgoError?.fatal, "Erro deve ser fatal");
  });
});

describe("StructuralValidator — DESPACHO com 'defiro'", () => {
  it("deve gerar regra DESPACHO_WITH_DECISION_LANGUAGE fatal", () => {
    const validator = new StructuralValidator();
    const draft =
      "Processo nº 0001234-56.2024.8.26.0000\nDefiro o pedido de tutela de urgência formulado pela parte autora.";
    const result = validator.validate(draft, "DESPACHO");
    const fatalError = result.errors.find(
      (e) => e.rule === "DESPACHO_WITH_DECISION_LANGUAGE" && e.fatal,
    );
    assert.ok(fatalError, "Despacho com 'defiro' deve gerar erro fatal DESPACHO_WITH_DECISION_LANGUAGE");
  });
});

describe("StructuralValidator — DESPACHO com 'indefiro'", () => {
  it("deve gerar regra DESPACHO_WITH_DECISION_LANGUAGE fatal", () => {
    const validator = new StructuralValidator();
    const draft =
      "Processo nº 0001234-56.2024.8.26.0000\nIndefiro o requerimento de gratuidade da justiça.";
    const result = validator.validate(draft, "DESPACHO");
    const fatalError = result.errors.find(
      (e) => e.rule === "DESPACHO_WITH_DECISION_LANGUAGE" && e.fatal,
    );
    assert.ok(fatalError, "Despacho com 'indefiro' deve gerar erro fatal DESPACHO_WITH_DECISION_LANGUAGE");
  });
});

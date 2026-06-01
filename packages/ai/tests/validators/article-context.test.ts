import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectArticleContext,
  isArticleUsedAsDistinction,
} from "../../src/validators/article-context.js";

describe("detectArticleContext — uso direto como fundamento", () => {
  it("'nos termos do art. 201 CF' → DIRECT_FOUNDATION", () => {
    const draft = "O autor faz jus à aposentadoria nos termos do art. 201 da CF/88.";
    assert.equal(detectArticleContext(draft, "201"), "DIRECT_FOUNDATION");
  });

  it("'com fundamento no art. 40 CF' → DIRECT_FOUNDATION", () => {
    const draft = "Pleiteia o servidor a aposentadoria com fundamento no art. 40 da Constituição Federal.";
    assert.equal(detectArticleContext(draft, "40"), "DIRECT_FOUNDATION");
  });

  it("'assegurado pelo art. 201' → DIRECT_FOUNDATION", () => {
    const draft = "O direito ao benefício é assegurado pelo art. 201 CF, conforme entendimento pacífico.";
    assert.equal(detectArticleContext(draft, "201"), "DIRECT_FOUNDATION");
  });
});

describe("detectArticleContext — uso distintivo", () => {
  it("'não se confunde com o art. 201' → DISTINCTION", () => {
    const draft = "O regime do servidor RPPS não se confunde com o art. 201 CF, que rege o RGPS.";
    assert.equal(detectArticleContext(draft, "201"), "DISTINCTION");
  });

  it("'diferentemente do art. 201' → DISTINCTION", () => {
    const draft = "Diferentemente do art. 201 CF, o regime aplicável aqui é o RPPS (art. 40).";
    assert.equal(detectArticleContext(draft, "201"), "DISTINCTION");
  });

  it("RPPS e RGPS no mesmo parágrafo do art. 201 → DISTINCTION", () => {
    const draft = "O caso é de RPPS. Diferentemente, o art. 201 CF disciplina o RGPS.";
    assert.equal(detectArticleContext(draft, "201"), "DISTINCTION");
  });
});

describe("detectArticleContext — artigo ausente", () => {
  it("draft sem o artigo → NOT_PRESENT", () => {
    const draft = "O servidor pleiteia a aposentadoria com fundamento no art. 40 CF.";
    assert.equal(detectArticleContext(draft, "201"), "NOT_PRESENT");
  });
});

describe("isArticleUsedAsDistinction", () => {
  it("retorna true quando RPPS e RGPS aparecem na janela do art. 201", () => {
    const draft = "O regime RPPS não se confunde com o RGPS, sujeito ao art. 201 CF.";
    assert.equal(isArticleUsedAsDistinction(draft, "201", "RPPS", "RGPS"), true);
  });

  it("retorna false quando o artigo é usado isoladamente como fundamento", () => {
    const draft = "Pleiteia a aposentadoria nos termos do art. 201 CF.";
    assert.equal(isArticleUsedAsDistinction(draft, "201", "RPPS", "RGPS"), false);
  });
});

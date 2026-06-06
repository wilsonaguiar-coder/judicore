import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StructuralValidator } from "../../src/validators/structural.validator.js";
import { SentencaValidator } from "../../src/validators/sentenca.validator.js";
import { CriminalSentenceValidator } from "../../src/validators/criminal-sentenca.validator.js";
import { makeClassification } from "../helpers/factories.js";

// ── StructuralValidator — ausência de seções obrigatórias em sentença ─────────
// SentencaValidator delega verificação de seções ao StructuralValidator
// (comentário na linha 49 de sentenca.validator.ts), que emite MISSING_STRUCTURE.

describe("StructuralValidator — sentença sem relatório", () => {
  it("deve emitir MISSING_STRUCTURE fatal", () => {
    const v = new StructuralValidator();
    const draft = "FUNDAMENTAÇÃO\nAnálise...\nDISPOSITIVO\nAnte o exposto, julgo procedente. Apelação cabível (art. 1.009 CPC).";
    const result = v.validate(draft, "SENTENCA");
    assert.ok(result.errors.some((e) => e.rule === "MISSING_STRUCTURE" && e.fatal));
  });
});

describe("StructuralValidator — sentença sem dispositivo", () => {
  it("deve emitir MISSING_STRUCTURE fatal", () => {
    const v = new StructuralValidator();
    const draft = "RELATÓRIO\nTrata-se de ação...\nFUNDAMENTAÇÃO\nAnálise dos pontos.";
    const result = v.validate(draft, "SENTENCA");
    assert.ok(result.errors.some((e) => e.rule === "MISSING_STRUCTURE" && e.fatal));
  });
});

describe("SentencaValidator — sentença sem verbo dispositivo", () => {
  it("deve emitir SENTENCA_MISSING_DECISION_VERB fatal", () => {
    const v = new SentencaValidator();
    const draft = "RELATÓRIO\nTrata-se de ação.\nFUNDAMENTAÇÃO\nAnálise.\nDispositivo\nAnte o exposto, encerro o feito.";
    const result = v.validate(draft, makeClassification({ tipo_peca: "SENTENCA" }));
    assert.ok(result.errors.some((e) => e.rule === "SENTENCA_MISSING_DECISION_VERB" && e.fatal));
  });
});

describe("SentencaValidator — sentença completa válida", () => {
  it("não deve emitir erro fatal", () => {
    const v = new SentencaValidator();
    const draft = `RELATÓRIO
Trata-se de ação ajuizada por X em face de Y, com pedido de indenização. ${"Lorem ipsum ".repeat(20)}

FUNDAMENTAÇÃO
A análise do caso revela que o autor demonstrou os elementos necessários. ${"Lorem ipsum ".repeat(50)}

DISPOSITIVO
Ante o exposto, julgo procedente o pedido. Custas pelo réu. Apelação cabível no prazo legal (art. 1.009 CPC).`;
    const result = v.validate(draft, makeClassification({ tipo_peca: "SENTENCA" }));
    assert.equal(result.errors.filter((e) => e.fatal).length, 0, JSON.stringify(result.errors));
  });
});

describe("SentencaValidator — não aplica a outros tipos", () => {
  it("retorna sem erros se não é SENTENCA", () => {
    const v = new SentencaValidator();
    const result = v.validate("qualquer texto", makeClassification({ tipo_peca: "PETICAO_INICIAL" }));
    assert.equal(result.errors.length, 0);
  });
});

// ── CriminalSentenceValidator ────────────────────────────────────────────────

describe("CriminalSentenceValidator — HC com 'julgo improcedente'", () => {
  it("deve emitir HC_WRONG_DISPOSITIVO fatal", () => {
    const v = new CriminalSentenceValidator();
    const draft = "Trata-se de habeas corpus em favor do paciente. Ante o exposto, julgo improcedente o pedido. Apelação criminal (art. 593 CPP).";
    const result = v.validate(draft, makeClassification({
      tipo_peca: "SENTENCA",
      tipo_justica: "CRIMINAL",
      regime_juridico: "CRIMINAL",
      assunto_principal: "habeas corpus impetrado em favor de paciente",
    }));
    assert.ok(result.errors.some((e) => e.rule === "HC_WRONG_DISPOSITIVO" && e.fatal));
  });
});

describe("CriminalSentenceValidator — HC sem 'concedo/denego a ordem'", () => {
  it("deve emitir HC_MISSING_ORDER_VERB fatal", () => {
    const v = new CriminalSentenceValidator();
    const draft = "Trata-se de habeas corpus. Análise dos requisitos. Mantenho a prisão preventiva.";
    const result = v.validate(draft, makeClassification({
      tipo_peca: "SENTENCA",
      tipo_justica: "CRIMINAL",
      regime_juridico: "CRIMINAL",
      assunto_principal: "habeas corpus",
    }));
    assert.ok(result.errors.some((e) => e.rule === "HC_MISSING_ORDER_VERB" && e.fatal));
  });
});

describe("CriminalSentenceValidator — HC com 'denego a ordem'", () => {
  it("NÃO deve emitir HC_MISSING_ORDER_VERB", () => {
    const v = new CriminalSentenceValidator();
    const draft = "Trata-se de habeas corpus em favor do paciente. Ante o exposto, denego a ordem. Cabível recurso em sentido estrito (art. 581 CPP).";
    const result = v.validate(draft, makeClassification({
      tipo_peca: "SENTENCA",
      tipo_justica: "CRIMINAL",
      regime_juridico: "CRIMINAL",
      assunto_principal: "habeas corpus",
    }));
    assert.equal(result.errors.filter((e) => e.rule === "HC_MISSING_ORDER_VERB").length, 0);
  });
});

describe("CriminalSentenceValidator — sentença criminal sem ABSOLVO/CONDENO", () => {
  it("deve emitir CRIMINAL_MISSING_DISPOSITIVO fatal", () => {
    const v = new CriminalSentenceValidator();
    const draft = "Trata-se de ação penal. Ante o exposto, julgo procedente a denúncia. Apelação criminal cabível.";
    const result = v.validate(draft, makeClassification({
      tipo_peca: "SENTENCA",
      tipo_justica: "CRIMINAL",
      regime_juridico: "CRIMINAL",
      assunto_principal: "ação penal por furto",
    }));
    assert.ok(result.errors.some((e) => e.rule === "CRIMINAL_MISSING_DISPOSITIVO" && e.fatal));
  });
});

describe("CriminalSentenceValidator — sentença criminal com art. 85 CPC", () => {
  it("deve emitir CRIMINAL_ARTICLE_85_CPC fatal", () => {
    const v = new CriminalSentenceValidator();
    const draft = "Trata-se de ação penal. Ante o exposto, condeno o réu. Honorários advocatícios nos termos do art. 85 CPC. Apelação criminal (art. 593 CPP).";
    const result = v.validate(draft, makeClassification({
      tipo_peca: "SENTENCA",
      tipo_justica: "CRIMINAL",
      regime_juridico: "CRIMINAL",
      assunto_principal: "ação penal",
    }));
    assert.ok(result.errors.some((e) => e.rule === "CRIMINAL_ARTICLE_85_CPC" && e.fatal));
  });
});

describe("CriminalSentenceValidator — sentença criminal com apelação cível", () => {
  it("deve emitir CRIMINAL_WRONG_APPEAL fatal", () => {
    const v = new CriminalSentenceValidator();
    const draft = "Trata-se de ação penal. Ante o exposto, condeno o réu. Cabível apelação cível no prazo legal.";
    const result = v.validate(draft, makeClassification({
      tipo_peca: "SENTENCA",
      tipo_justica: "CRIMINAL",
      regime_juridico: "CRIMINAL",
      assunto_principal: "ação penal",
    }));
    assert.ok(result.errors.some((e) => e.rule === "CRIMINAL_WRONG_APPEAL" && e.fatal));
  });
});

describe("CriminalSentenceValidator — sentença criminal condenatória sem dosimetria", () => {
  it("deve emitir CRIMINAL_MISSING_DOSIMETRIA (não fatal)", () => {
    const v = new CriminalSentenceValidator();
    const draft = "Trata-se de ação penal por furto. Ante o exposto, condeno o réu João da Silva à pena de 2 anos de reclusão. Apelação criminal (art. 593 CPP).";
    const result = v.validate(draft, makeClassification({
      tipo_peca: "SENTENCA",
      tipo_justica: "CRIMINAL",
      regime_juridico: "CRIMINAL",
      assunto_principal: "ação penal",
    }));
    assert.ok(result.errors.some((e) => e.rule === "CRIMINAL_MISSING_DOSIMETRIA"));
  });
});

describe("CriminalSentenceValidator — não aplica fora de criminal", () => {
  it("retorna sem erros em sentença cível", () => {
    const v = new CriminalSentenceValidator();
    const result = v.validate("qualquer", makeClassification({
      tipo_peca: "SENTENCA",
      tipo_justica: "ESTADUAL",
      regime_juridico: "CIVIL",
    }));
    assert.equal(result.errors.length, 0);
  });
});

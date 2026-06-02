// Fixtures direcionados para o EvidenceStanceValidator em contexto RPPS — paridade.
//
// 4 cenários cobertos:
//   Caso 1 — servidor pré-EC 41, jurisprudência favorável → sem violação
//   Caso 2 — servidor pré-EC 41, jur contrária sem identidade fática + distinguishing → sem violação
//   Caso 3 — servidor 2010, jur contrária aplicável, sentença improcedente → sem violação
//   Caso 4 — servidor 2010, jur contrária aplicável, distinguishing artificial → VIOLATION
//
// Premissas:
//   Sem chamadas de AI — as analyses são fornecidas como fixtures.
//   O validator avalia apenas os padrões textuais do draft.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EvidenceStanceValidator } from "../../src/validators/evidence-stance.validator.js";
import type { EvidenceAnalysis, JurisprudenciaInput } from "../../src/pipeline/types.js";

// ── Fixtures de jurisprudência ────────────────────────────────────────────────

const JUR_CONTRARIO_RPPS: JurisprudenciaInput = {
  id: "jur_stf_re590260",
  tribunal: "STF",
  numero: "RE 590.260/SP",
  tema: "Paridade — EC 41/2003",
  ementa:
    "Servidor que ingressou após EC 41/2003 não faz jus à paridade nem à integralidade, " +
    "salvo regras de transição (ECs 41/2003 e 47/2005).",
  tese: "Sem paridade pós-EC 41/2003",
};

const JUR_FAVORAVEL_RPPS: JurisprudenciaInput = {
  id: "jur_stf_re611929",
  tribunal: "STF",
  numero: "RE 611.929/SP",
  tema: "Paridade — servidor pré-EC 41",
  ementa:
    "Servidor que ingressou antes da EC 41/2003 tem direito à paridade nos " +
    "proventos de aposentadoria, nos termos do art. 40 CF/88 na redação original.",
  tese: "Com paridade pré-EC 41/2003",
};

// ── Fixtures de análise (substituem chamada ao EvidenceAnalyzer) ──────────────

const ANALYSIS_FAVORAVEL: EvidenceAnalysis = {
  id: "jur_stf_re611929",
  stance: "FAVORAVEL",
  use_mode: "FOUNDATION",
  confidence: 0.97,
  tese_extraida: "Garante paridade para servidores pré-EC 41",
  fundamento_da_classificacao: "Decisão reconhece o direito pleiteado",
  pode_citar_na_peca: true,
  regra_de_uso: "Usar como fundamento direto da procedência",
};

const ANALYSIS_CONTRARIO: EvidenceAnalysis = {
  id: "jur_stf_re590260",
  stance: "CONTRARIO",
  use_mode: "COUNTER_ARGUMENT",
  confidence: 0.95,
  tese_extraida: "Nega paridade para servidores pós-EC 41",
  fundamento_da_classificacao: "Decisão é contrária ao pedido do autor",
  pode_citar_na_peca: true,
  regra_de_uso: "Usar apenas para distinguishing ou para fundamentar improcedência",
};

const validator = new EvidenceStanceValidator();

// ── Caso 1 — servidor pré-EC 41, jurisprudência favorável ────────────────────

describe("Caso 1 — RPPS: servidor pré-EC 41, jurisprudência FAVORAVEL → sem violação", () => {
  it("jur favorável usada como fundamento da procedência não deve gerar EVIDENCE_STANCE_VIOLATION", () => {
    const draft =
      "Conforme decidido pelo STF no RE 611.929/SP, o servidor que ingressou antes da " +
      "EC 41/2003 tem direito à paridade nos proventos de aposentadoria. " +
      "O autor ingressou em 01/03/1998, antes da edição da EC 41/2003. " +
      "Portanto, faz jus à paridade integral com os servidores da ativa. " +
      "JULGO PROCEDENTE o pedido formulado na inicial.";

    const errors = validator.validate(draft, [JUR_FAVORAVEL_RPPS], [ANALYSIS_FAVORAVEL]);

    assert.equal(
      errors.filter((e) => e.rule === "EVIDENCE_STANCE_VIOLATION").length,
      0,
      "Jur. favorável usada para procedência não deve gerar violação",
    );
  });
});

// ── Caso 2 — servidor pré-EC 41, jur contrária sem identidade fática ─────────

describe("Caso 2 — RPPS: servidor pré-EC 41, jur CONTRARIA com distinguishing real → sem violação", () => {
  it("distinguishing explícito sobre fatos distintos (pré vs pós EC 41) não deve gerar violação", () => {
    const draft =
      "Embora exista precedente contrário do STF no RE 590.260/SP negando a paridade, " +
      "a hipótese dos autos difere substancialmente: o autor ingressou em 01/03/1998, " +
      "antes da edição da EC 41/2003, enquanto aquele precedente trata de servidores que " +
      "ingressaram após a mencionada emenda. O caso não guarda identidade fática com o " +
      "leading case do STF. " +
      "JULGO PROCEDENTE o pedido de paridade.";

    const errors = validator.validate(draft, [JUR_CONTRARIO_RPPS], [ANALYSIS_CONTRARIO]);

    assert.equal(
      errors.filter((e) => e.rule === "EVIDENCE_STANCE_VIOLATION").length,
      0,
      "Distinguishing real (embora / não guarda identidade) deve afastar a violação",
    );
  });
});

// ── Caso 3 — servidor 2010, jur contrária aplicável, sentença improcedente ───

describe("Caso 3 — RPPS: servidor 2010, jur CONTRARIA aplicável, sentença improcedente → sem violação", () => {
  it("precedente contrário usado para fundamentar improcedência não deve gerar EVIDENCE_STANCE_VIOLATION", () => {
    const draft =
      "O STF no RE 590.260/SP assentou que o servidor que ingressou após a EC 41/2003 " +
      "não faz jus à paridade nem à integralidade, salvo as regras de transição. " +
      "O autor ingressou em 15/06/2010, ou seja, após a edição da EC 41/2003, não " +
      "se enquadrando em nenhuma das regras de transição previstas nas ECs 41/2003 e 47/2005. " +
      "O autor não tem direito à paridade pleiteada. " +
      "JULGO IMPROCEDENTE o pedido formulado na inicial.";

    const errors = validator.validate(draft, [JUR_CONTRARIO_RPPS], [ANALYSIS_CONTRARIO]);

    assert.equal(
      errors.filter((e) => e.rule === "EVIDENCE_STANCE_VIOLATION").length,
      0,
      "Jur. contrária aplicada para negar o pedido (improcedente / não faz jus) não é violação",
    );
  });
});

// ── Caso 4 — servidor 2010, jur contrária aplicável, distinguishing artificial ──

describe("Caso 4 — RPPS: servidor 2010, jur CONTRARIA, distinguishing artificial → EVIDENCE_STANCE_VIOLATION", () => {
  it("linguagem de qualificação vaga sem distinguishing real deve gerar VIOLATION", () => {
    // O draft usa linguagem que parece distinguir ("considerando as especificidades",
    // "atendendo às particularidades") mas não contém nenhuma das expressões de
    // distinguishing reconhecidas nem linguagem de rejeição do pedido.
    // Ao contrário: conclui com PROCEDENTE — citando o precedente contrário como se favorável.
    const draft =
      "Considerando as especificidades do caso concreto e à luz do precedente do STF " +
      "no RE 590.260/SP, atendendo às particularidades da situação do servidor, " +
      "entende-se que há fundamento para reconhecer o direito à paridade pleiteada. " +
      "JULGO PROCEDENTE o pedido formulado na inicial.";

    const errors = validator.validate(draft, [JUR_CONTRARIO_RPPS], [ANALYSIS_CONTRARIO]);

    assert.ok(
      errors.some((e) => e.fatal && e.rule === "EVIDENCE_STANCE_VIOLATION"),
      "Jur. contrária citada sem distinguishing real e sem negar o pedido deve gerar EVIDENCE_STANCE_VIOLATION",
    );
  });
});

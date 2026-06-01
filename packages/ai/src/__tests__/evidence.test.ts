import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { EvidenceStanceValidator } from "../validators/evidence-stance.validator.js";
import type { EvidenceAnalysis, JurisprudenciaInput, ArgumentationMatrix } from "../pipeline/types.js";

function makeJur(overrides: Partial<JurisprudenciaInput> = {}): JurisprudenciaInput {
  return {
    id: "jur_001",
    tribunal: "TRF1",
    numero: "0001234-56.2020.4.01.0000",
    tema: "Paridade pensão por morte",
    ementa: "Nega direito à paridade...",
    tese: "Pensionista não faz jus à paridade nos termos da EC 41/2003",
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<EvidenceAnalysis> = {}): EvidenceAnalysis {
  return {
    id: "jur_001",
    stance: "CONTRARIO",
    use_mode: "COUNTER_ARGUMENT",
    confidence: 0.92,
    tese_extraida: "Nega o direito à paridade",
    fundamento_da_classificacao: "Decisão contrária ao pedido do autor",
    pode_citar_na_peca: true,
    regra_de_uso: "Apenas para distinguishing",
    ...overrides,
  };
}

function makeMatrix(overrides: Partial<ArgumentationMatrix["teses"][0]> = {}): ArgumentationMatrix {
  return {
    teses: [
      {
        id: "tese_001",
        pedido: "Concessão de paridade",
        tese: "É devida a paridade",
        fato: "Ex-servidor falecido em 2003",
        norma: "art. 7º da EC 41/2003",
        ratio: "Direito adquirido",
        jurisprudencia_id: "jur_001",
        conclusao: "Defere-se a paridade",
        ...overrides,
      },
    ],
  };
}

const validator = new EvidenceStanceValidator();

describe("Teste 1: Jurisprudência contrária citada sem distinguishing → erro fatal", () => {
  test("deve retornar erro fatal EVIDENCE_STANCE_VIOLATION", () => {
    const jur = makeJur();
    const analysis = makeAnalysis({ stance: "CONTRARIO", use_mode: "COUNTER_ARGUMENT" });
    // Draft cita TRF1 mas sem linguagem de distinguishing
    const draft = "Conforme entendimento do TRF1 nos autos 0001234-56.2020.4.01.0000, o direito é reconhecido.";
    const errors = validator.validate(draft, [jur], [analysis]);
    assert.ok(errors.length > 0, "Deve haver erros");
    assert.ok(errors.some((e) => e.fatal), "Deve ter erro fatal");
    assert.ok(errors.some((e) => e.rule === "EVIDENCE_STANCE_VIOLATION"));
  });
});

describe("Teste 2: Jurisprudência contrária citada COM distinguishing → sem erro", () => {
  test("não deve retornar erro quando há linguagem de distinguishing", () => {
    const jur = makeJur();
    const analysis = makeAnalysis({ stance: "CONTRARIO", use_mode: "COUNTER_ARGUMENT" });
    const draft = "Embora exista precedente em sentido contrário do TRF1 (0001234-56.2020.4.01.0000), a hipótese dos autos difere porque o servidor faleceu antes da EC 41/2003.";
    const errors = validator.validate(draft, [jur], [analysis]);
    assert.equal(errors.filter((e) => e.rule === "EVIDENCE_STANCE_VIOLATION").length, 0);
  });
});

describe("Teste 3: Jurisprudência CONTRARIO como jurisprudencia_id na matriz → erro fatal", () => {
  test("validateMatrix deve retornar erro fatal EVIDENCE_STANCE_MATRIX", () => {
    const analysis = makeAnalysis({ stance: "CONTRARIO", use_mode: "COUNTER_ARGUMENT" });
    const matrix = makeMatrix({ jurisprudencia_id: "jur_001" });
    const errors = validator.validateMatrix(matrix, [analysis]);
    assert.ok(errors.some((e) => e.fatal && e.rule === "EVIDENCE_STANCE_MATRIX"));
  });
});

describe("Teste 4: Jurisprudência FAVORAVEL como FOUNDATION na matriz → sem erro", () => {
  test("validateMatrix não deve retornar erro para FOUNDATION", () => {
    const analysis = makeAnalysis({ stance: "FAVORAVEL", use_mode: "FOUNDATION" });
    const matrix = makeMatrix({ jurisprudencia_id: "jur_001" });
    const errors = validator.validateMatrix(matrix, [analysis]);
    assert.equal(errors.filter((e) => e.rule === "EVIDENCE_STANCE_MATRIX").length, 0);
  });
});

describe("Teste 5: Jurisprudência não citada na peça → sem erro mesmo sendo CONTRARIO", () => {
  test("deve ignorar jurisprudência contrária não citada no draft", () => {
    const jur = makeJur();
    const analysis = makeAnalysis({ stance: "CONTRARIO" });
    const draft = "A parte autora tem direito à paridade conforme o art. 7º da EC 41/2003 e o entendimento doutrinário majoritário.";
    const errors = validator.validate(draft, [jur], [analysis]);
    assert.equal(errors.filter((e) => e.rule === "EVIDENCE_STANCE_VIOLATION").length, 0);
  });
});

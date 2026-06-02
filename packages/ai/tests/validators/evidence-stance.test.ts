import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { EvidenceStanceValidator } from "../../src/validators/evidence-stance.validator.js";
import type {
  EvidenceAnalysis,
  JurisprudenciaInput,
  ArgumentationMatrix,
} from "../../src/pipeline/types.js";
import { makeTese } from "../helpers/factories.js";

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

function matrixWith(jurId: string | null): ArgumentationMatrix {
  return { teses: [makeTese({ jurisprudencia_id: jurId })] };
}

const validator = new EvidenceStanceValidator();

describe("EvidenceStanceValidator — CONTRARIO citado sem distinguishing", () => {
  test("deve emitir EVIDENCE_STANCE_VIOLATION fatal", () => {
    const draft =
      "Conforme entendimento do TRF1 nos autos 0001234-56.2020.4.01.0000, o direito é reconhecido.";
    const errors = validator.validate(draft, [makeJur()], [makeAnalysis()]);
    assert.ok(errors.some((e) => e.fatal && e.rule === "EVIDENCE_STANCE_VIOLATION"));
  });
});

describe("EvidenceStanceValidator — CONTRARIO citado COM distinguishing", () => {
  test("não deve emitir erro", () => {
    const draft =
      "Embora exista precedente em sentido contrário do TRF1 (0001234-56.2020.4.01.0000), a hipótese dos autos difere porque o servidor faleceu antes da EC 41/2003.";
    const errors = validator.validate(draft, [makeJur()], [makeAnalysis()]);
    assert.equal(errors.filter((e) => e.rule === "EVIDENCE_STANCE_VIOLATION").length, 0);
  });
});

describe("EvidenceStanceValidator — CONTRARIO como jurisprudencia_id na matriz", () => {
  test("validateMatrix deve emitir EVIDENCE_STANCE_MATRIX fatal", () => {
    const errors = validator.validateMatrix(matrixWith("jur_001"), [makeAnalysis()]);
    assert.ok(errors.some((e) => e.fatal && e.rule === "EVIDENCE_STANCE_MATRIX"));
  });
});

describe("EvidenceStanceValidator — FAVORAVEL como FOUNDATION", () => {
  test("validateMatrix não deve emitir erro", () => {
    const analysis = makeAnalysis({ stance: "FAVORAVEL", use_mode: "FOUNDATION" });
    const errors = validator.validateMatrix(matrixWith("jur_001"), [analysis]);
    assert.equal(errors.filter((e) => e.rule === "EVIDENCE_STANCE_MATRIX").length, 0);
  });
});

describe("EvidenceStanceValidator — CONTRARIO não citado no draft", () => {
  test("deve ignorar", () => {
    const draft = "A parte autora tem direito à paridade conforme o art. 7º da EC 41/2003.";
    const errors = validator.validate(draft, [makeJur()], [makeAnalysis()]);
    assert.equal(errors.filter((e) => e.rule === "EVIDENCE_STANCE_VIOLATION").length, 0);
  });
});

describe("EvidenceStanceValidator — CONTRARIO usado para fundamentar improcedência", () => {
  test("NÃO deve emitir EVIDENCE_STANCE_VIOLATION — uso correto do precedente para negar o pedido", () => {
    // Cenário: servidor ingressou em 2010, TRF1 nega paridade, sentença julga improcedente.
    // O precedente contrário é aplicado conforme sua própria tese — não é violação.
    const draft =
      "Conforme o entendimento do TRF1 no processo 0001234-56.2020.4.01.0000, o pensionista não faz jus à paridade após a EC 41/2003. " +
      "Diante disso, JULGO IMPROCEDENTE o pedido formulado na inicial.";
    const errors = validator.validate(draft, [makeJur()], [makeAnalysis()]);
    assert.equal(errors.filter((e) => e.rule === "EVIDENCE_STANCE_VIOLATION").length, 0);
  });

  test("NÃO deve emitir EVIDENCE_STANCE_VIOLATION — precedente nega o direito e denega a ordem em HC", () => {
    const draft =
      "O TRF1 no processo 0001234-56.2020.4.01.0000 assentou que não há amparo legal para o pleito. " +
      "Ante o exposto, denego a ordem impetrada.";
    const errors = validator.validate(draft, [makeJur()], [makeAnalysis()]);
    assert.equal(errors.filter((e) => e.rule === "EVIDENCE_STANCE_VIOLATION").length, 0);
  });

  test("DEVE emitir EVIDENCE_STANCE_VIOLATION — jur. contrária citada como se favorável", () => {
    // O precedente do TRF1 nega paridade, mas o draft diz "o direito é reconhecido" → violação
    const draft =
      "Conforme entendimento do TRF1 nos autos 0001234-56.2020.4.01.0000, o direito é reconhecido. " +
      "JULGO PROCEDENTE o pedido.";
    const errors = validator.validate(draft, [makeJur()], [makeAnalysis()]);
    assert.ok(errors.some((e) => e.fatal && e.rule === "EVIDENCE_STANCE_VIOLATION"));
  });
});

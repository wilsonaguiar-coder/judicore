// Factories para criar objetos de domínio com defaults sensatos, usados
// transversalmente em todos os testes (validators, pipeline mocked, integration).

import type {
  LegalClassification,
  LegalExtraction,
  ArgumentationMatrix,
  LegalAudit,
  EvidenceAnalysis,
  ArgumentacaoTese,
} from "../../src/pipeline/types.js";

export function makeClassification(overrides: Partial<LegalClassification> = {}): LegalClassification {
  return {
    tipo_justica: "ESTADUAL",
    tipo_peca: "SENTENCA",
    regime_juridico: "CIVIL",
    grau: "PRIMEIRO",
    tribunal_competente: "TJSP",
    rito: null,
    assunto_principal: "indenização por danos morais",
    partes: { autor: "Autor A", reu: "Réu B" },
    confianca: 0.9,
    ...overrides,
  };
}

export function makeExtraction(overrides: Partial<LegalExtraction> = {}): LegalExtraction {
  return {
    fatos: [
      "Fato 1 concreto ocorrido em 10/01/2024",
      "Fato 2 detalhado com valor R$ 5.000",
      "Fato 3 com consequência jurídica",
    ],
    pedidos: [
      "Condenação em indenização por danos morais no valor de R$ 10.000",
      "Condenação em custas e honorários",
    ],
    questoes_juridicas: [
      "Responsabilidade civil extracontratual",
      "Nexo causal entre conduta e dano",
    ],
    artigos_citados: ["art. 186 CC/2002", "art. 927 CC/2002"],
    jurisprudencias_relevantes: [],
    qualidade_extracao: "SUFICIENTE",
    ...overrides,
  };
}

export function makeTese(overrides: Partial<ArgumentacaoTese> = {}): ArgumentacaoTese {
  return {
    id: "tese_001",
    pedido: "Indenização por danos morais",
    tese: "É devida indenização por danos morais",
    fato: "Fato 1",
    norma: "art. 186 CC/2002",
    ratio: "Nexo causal comprovado",
    jurisprudencia_id: null,
    conclusao: "Deve ser acolhido",
    ...overrides,
  };
}

export function makeMatrix(overrides: Partial<ArgumentationMatrix> = {}): ArgumentationMatrix {
  return {
    teses: [makeTese()],
    ...overrides,
  };
}

export function makeAudit(overrides: Partial<LegalAudit> = {}): LegalAudit {
  return {
    aprovada: true,
    score: 85,
    erros: [],
    resumo: "Peça aprovada",
    ...overrides,
  };
}

export function makeEvidence(overrides: Partial<EvidenceAnalysis> = {}): EvidenceAnalysis {
  return {
    id: "jur_001",
    stance: "FAVORAVEL",
    use_mode: "FOUNDATION",
    confidence: 0.9,
    tese_extraida: "tese padrão",
    fundamento_da_classificacao: "alinhada com o pedido",
    pode_citar_na_peca: true,
    regra_de_uso: "citar como fundamento",
    ...overrides,
  };
}

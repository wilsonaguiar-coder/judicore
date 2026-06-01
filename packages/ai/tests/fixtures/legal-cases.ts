// Fixtures dos 10 casos jurídicos obrigatórios da suíte de testes.
//
// Cada fixture descreve um cenário e o resultado esperado. A interpretação
// das asserções está em tests/runners/assert-expectations.ts:
//   - mustContain         → string aparece no draft (case-insensitive)
//   - mustNotContain      → string NÃO aparece no draft
//   - mustHaveCriticalErrors    → o array de erros contém regra com esse nome
//                                 (independente de fatal:true/false)
//   - mustNotHaveCriticalErrors → o array de erros NÃO contém regra com esse nome
//   - evidenceStance      → para cada jur.id, a classificação esperada
//   - mode / status       → estado final esperado

import type {
  JurisprudenciaInput,
  TipoPeca,
  GenerationMode,
  DocumentStatus,
  EvidenceStance,
} from "../../src/pipeline/types.js";

export interface CaseFixture {
  id: string;
  name: string;
  documentType: TipoPeca;
  caseDescription: string;
  instruction?: string;
  jurisprudencias: JurisprudenciaInput[];
  expected: {
    mode?: GenerationMode;
    status?: DocumentStatus;
    mustContain?: string[];
    mustNotContain?: string[];
    mustHaveCriticalErrors?: string[];
    mustNotHaveCriticalErrors?: string[];
    evidenceStance?: Record<string, EvidenceStance>;
  };
}

// ── Jurisprudências reutilizáveis ─────────────────────────────────────────────

const JUR_CONTRARIO_PARIDADE: JurisprudenciaInput = {
  id: "jur_contrario_paridade",
  tribunal: "STF",
  numero: "RE 590.260/SP",
  tema: "Paridade — EC 41/2003",
  ementa:
    "Servidor que ingressou após a EC 41/2003 não faz jus à paridade nem à integralidade. A regra de paridade aplica-se exclusivamente aos beneficiários das regras de transição das ECs 41/2003 e 47/2005 que atendam aos requisitos específicos.",
  tese: "Servidores que ingressaram após EC 41/2003 NÃO têm direito à paridade",
  relator: "Min. Ricardo Lewandowski",
  dataJulgamento: "2009-11-04",
};

const JUR_FAVORAVEL_DANOS_MORAIS: JurisprudenciaInput = {
  id: "jur_favoravel_danos",
  tribunal: "STJ",
  numero: "REsp 1.234.567/SP",
  tema: "Dano moral — inscrição indevida em cadastro restritivo",
  ementa:
    "A inscrição indevida do nome do consumidor em cadastros de proteção ao crédito gera dano moral in re ipsa, dispensando a prova efetiva do prejuízo.",
  tese: "Inscrição indevida em SPC/Serasa gera dano moral in re ipsa",
  relator: "Min. Nancy Andrighi",
  dataJulgamento: "2018-05-15",
};

// ── Casos ─────────────────────────────────────────────────────────────────────

export const FIXTURES: CaseFixture[] = [
  // 1. RPPS paridade com jurisprudência contrária
  {
    id: "case_01_rpps_paridade_contraria",
    name: "RPPS paridade com jurisprudência contrária deve detectar stance e não usar como fundamento favorável",
    documentType: "PETICAO_INICIAL",
    caseDescription:
      "Ex-servidor estadual ingressou no serviço público em 2008, falecido em 2023. Viúva requer pensão por morte com paridade aos vencimentos do cargo do falecido, com base no art. 40 CF/88 e regime RPPS estadual. O servidor ingressou após a EC 41/2003.",
    jurisprudencias: [JUR_CONTRARIO_PARIDADE],
    expected: {
      evidenceStance: { [JUR_CONTRARIO_PARIDADE.id]: "CONTRARIO" },
      mustNotHaveCriticalErrors: [],
    },
  },

  // 2. RPPS com art. 201 CF
  {
    id: "case_02_rpps_art_201_cf",
    name: "RPPS citando art. 201 CF deve emitir regra RPPS_WRONG_ARTICLE",
    documentType: "PETICAO_INICIAL",
    caseDescription:
      "Servidor público estadual estatutário (regime RPPS) requer aposentadoria por invalidez permanente.",
    jurisprudencias: [],
    expected: {
      mustHaveCriticalErrors: ["RPPS_WRONG_ARTICLE"],
    },
  },

  // 3. Trabalhista com apelação
  {
    id: "case_03_trabalho_apelacao",
    name: "Recurso trabalhista usando 'apelação' deve emitir INCOMPATIBLE_APPEAL",
    documentType: "RECURSO",
    caseDescription:
      "Reclamante busca reforma de sentença de improcedência em reclamação trabalhista de horas extras não pagas.",
    jurisprudencias: [],
    expected: {
      mustHaveCriticalErrors: ["INCOMPATIBLE_APPEAL"],
    },
  },

  // 4. STJ em matéria trabalhista
  {
    id: "case_04_trabalho_stj",
    name: "Menção ao STJ em peça trabalhista deve emitir WRONG_SUPERIOR_COURT",
    documentType: "RECURSO",
    caseDescription:
      "Reclamante pretende interpor recurso contra acórdão do TRT em ação trabalhista de verbas rescisórias.",
    jurisprudencias: [],
    expected: {
      mustHaveCriticalErrors: ["WRONG_SUPERIOR_COURT", "INCOMPATIBLE_APPEAL"],
    },
  },

  // 5. Habeas corpus com "julgo improcedente"
  {
    id: "case_05_hc_julgo_improcedente",
    name: "HC com 'julgo improcedente' deve emitir CRIMINAL_WRONG_TERM",
    documentType: "SENTENCA",
    caseDescription:
      "Habeas corpus impetrado em favor de paciente preso preventivamente. Magistrado vai denegar a ordem.",
    jurisprudencias: [],
    expected: {
      mustHaveCriticalErrors: ["CRIMINAL_WRONG_TERM"],
    },
  },

  // 6. JEF com apelação
  {
    id: "case_06_jef_apelacao",
    name: "Recurso em JEF usando 'apelação' deve emitir JEF_JEC_WRONG_APPEAL",
    documentType: "RECURSO",
    caseDescription:
      "Segurado do INSS pretende recorrer de sentença proferida em Juizado Especial Federal sobre auxílio-doença.",
    jurisprudencias: [],
    expected: {
      mustHaveCriticalErrors: ["JEF_JEC_WRONG_APPEAL"],
    },
  },

  // 7. Despacho com "defiro"
  {
    id: "case_07_despacho_defiro",
    name: "Despacho com 'defiro' deve emitir DESPACHO_WITH_DECISION_LANGUAGE",
    documentType: "DESPACHO",
    caseDescription:
      "Juiz deve emitir despacho de impulso processual determinando a intimação das partes para audiência.",
    jurisprudencias: [],
    expected: {
      mustHaveCriticalErrors: ["DESPACHO_WITH_DECISION_LANGUAGE"],
    },
  },

  // 8. Peça genérica — TEMPLATE_MODEL ou SAFE_SKELETON
  {
    id: "case_08_input_generico",
    name: "Input genérico (sem fatos concretos) deve virar TEMPLATE_MODEL ou SAFE_SKELETON",
    documentType: "PETICAO_INICIAL",
    caseDescription: "Direito civil",
    jurisprudencias: [],
    expected: {
      // O pipeline deve degradar para um modo "modelo" — não FINAL_DRAFT.
      // status sempre APROVADA COM RESSALVAS nesses modos.
      status: "APROVADA COM RESSALVAS",
    },
  },

  // 9. Caso completo — FINAL_DRAFT
  {
    id: "case_09_caso_completo",
    name: "Caso completo com fatos concretos e jurisprudência favorável deve virar FINAL_DRAFT",
    documentType: "PETICAO_INICIAL",
    caseDescription:
      "Maria da Silva, CPF 123.456.789-00, residente em Rua A, 100, São Paulo/SP. Em 15/03/2024, teve seu nome inscrito indevidamente nos cadastros de SPC e Serasa pela Loja XYZ Ltda. (CNPJ 12.345.678/0001-00), no valor de R$ 1.847,32, referente a contrato de compra que jamais celebrou. A inscrição perdurou por 60 dias até sua remoção judicial. Pretende ajuizar ação de indenização por danos morais no valor de R$ 15.000,00 e declaração de inexistência do débito.",
    jurisprudencias: [JUR_FAVORAVEL_DANOS_MORAIS],
    expected: {
      mode: "FINAL_DRAFT",
      evidenceStance: { [JUR_FAVORAVEL_DANOS_MORAIS.id]: "FAVORAVEL" },
    },
  },

  // 10. Peça com score 85 — APROVADA COM RESSALVAS
  {
    id: "case_10_score_85_ressalvas",
    name: "Peça com score 85 deve resultar em APROVADA COM RESSALVAS (não REPROVADA)",
    documentType: "SENTENCA",
    caseDescription:
      "Sentença de improcedência em ação de indenização por danos morais por descumprimento contratual leve.",
    jurisprudencias: [],
    // Este caso é validado isoladamente em finalvalidator.test.ts, sem rodar a pipeline.
    expected: {
      status: "APROVADA COM RESSALVAS",
    },
  },
];

export function getFixture(id: string): CaseFixture {
  const fx = FIXTURES.find((f) => f.id === id);
  if (!fx) throw new Error(`Fixture "${id}" não encontrada`);
  return fx;
}

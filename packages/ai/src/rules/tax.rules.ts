// Regras específicas de Direito Tributário e Execução Fiscal

export const TAX_KEY_ARTICLES = [
  "art. 150 CF/88 — limitações ao poder de tributar",
  "art. 155 CF/88 — impostos estaduais",
  "art. 156 CF/88 — impostos municipais",
  "art. 3º CTN — conceito de tributo",
  "art. 97 CTN — reserva de lei (legalidade tributária)",
  "art. 106 CTN — irretroatividade tributária",
  "art. 113 CTN — obrigação tributária principal e acessória",
  "art. 142 CTN — lançamento tributário",
  "art. 156 CTN — causas de extinção do crédito tributário",
  "art. 168 CTN — prazo prescricional tributário",
  "art. 174 CTN — prescrição da cobrança do crédito tributário",
  "art. 6º Lei 6.830/80 — petição inicial da execução fiscal",
  "art. 34 Lei 6.830/80 — apelação em execução fiscal (valor até 50 OTN)",
];

export const EXECUCAO_FISCAL_RULES = {
  lei_principal: "Lei 6.830/80 (LEF)",
  diploma_subsidiario: "CPC/2015 (subsidiário nos termos do art. 1º LEF)",
  prazo_embargos: "30 dias após garantia do juízo (art. 16 LEF)",
  garantia_obrigatoria: "penhora, depósito ou fiança bancária antes dos embargos",
  prescricao: "5 anos (art. 174 CTN)",
  competencia_federal: "Vara Federal ou JEF (até 60 SM)",
  competencia_estadual: "Vara de Fazenda Pública ou Vara da Fazenda Estadual",
};

export const TAX_DEFENSES = [
  "Prescrição (art. 174 CTN) — executivo fiscal",
  "Decadência (art. 150 §4º e art. 173 CTN) — prazo para lançamento",
  "Nulidade do lançamento (art. 142 CTN)",
  "Imunidade tributária (art. 150 VI CF/88)",
  "Isenção legal",
  "Bis in idem / bitributação",
  "Violação ao princípio da legalidade (art. 150 I CF/88 c/c art. 97 CTN)",
  "Violação à anterioridade (art. 150 III b/c CF/88)",
];

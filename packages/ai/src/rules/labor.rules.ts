// Regras específicas da Justiça do Trabalho e regime CLT

export const LABOR_BLOCKED_TERMS = [
  "apelação",
  "apelação cível",
  "stj",
  "tribunal de justiça",
  "art. 85 cpc",
  "art. 85 §2º cpc",
  "embargos infringentes",
  "art. 475-j cpc",
  "vara cível",
  "juiz de direito",
];

export const LABOR_REQUIRED_RESOURCES = [
  "Recurso Ordinário (art. 895 CLT) — prazo 8 dias corridos",
  "Recurso de Revista (art. 896 CLT) — prazo 8 dias corridos",
  "Agravo de Instrumento (art. 897 CLT)",
  "Embargos de Declaração (art. 897-A CLT) — prazo 5 dias",
];

export const LABOR_HONORARIOS_RULES = {
  fundamento: "art. 791-A CLT (pós-Reforma Trabalhista — Lei 13.467/2017)",
  percentual: "5% a 15% sobre o valor que resultar da liquidação da sentença",
  sucumbencia_parcial: "pode ser arbitrado proporcionalmente conforme êxito",
  isento: "beneficiário de justiça gratuita, salvo créditos suficientes no processo",
  artigos_proibidos: ["art. 85 CPC", "art. 85 §2º CPC", "art. 85 §3º CPC"],
};

export const LABOR_CUSTAS_RULES = {
  fundamento: "art. 789 CLT",
  percentual: "2% sobre o valor da condenação",
  minimo: "R$ 10,64",
  isento_beneficio: "sim, para beneficiário da justiça gratuita",
};

export const LABOR_IMPORTANT_ARTICLES = [
  "art. 7º CF/88 — direitos dos trabalhadores urbanos e rurais",
  "art. 8º CF/88 — liberdade sindical",
  "art. 114 CF/88 — competência da Justiça do Trabalho",
  "art. 482 CLT — justa causa",
  "art. 483 CLT — rescisão indireta",
  "art. 477 CLT — rescisão do contrato",
  "art. 795-A CLT — honorários advocatícios trabalhistas",
  "art. 895 CLT — Recurso Ordinário (prazo 8 dias)",
];

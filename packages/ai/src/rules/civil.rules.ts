// Regras específicas de Direito Civil e Processo Civil

export const CIVIL_KEY_ARTICLES = [
  "art. 186 CC/2002 — ato ilícito",
  "art. 187 CC/2002 — abuso de direito",
  "art. 927 CC/2002 — responsabilidade civil",
  "art. 421 CC/2002 — função social do contrato",
  "art. 422 CC/2002 — boa-fé objetiva",
  "art. 489 §1º CPC — fundamentação adequada",
  "art. 300 CPC — tutela de urgência",
  "art. 319 CPC — requisitos da petição inicial",
  "art. 330 CPC — indeferimento da petição inicial",
  "art. 485 CPC — sentença sem resolução do mérito",
  "art. 487 CPC — sentença com resolução do mérito",
  "art. 85 CPC — honorários advocatícios (cível/federal)",
  "art. 82 CPC — custas processuais",
  "art. 292 CPC — valor da causa",
  "art. 1.009 CPC — apelação (prazo 15 dias)",
];

export const CIVIL_PIECE_RULES: Record<string, string[]> = {
  PETICAO_INICIAL: [
    "Endereçamento correto ao juízo competente",
    "Qualificação completa das partes (art. 319 I CPC)",
    "Narração dos fatos (art. 319 III CPC)",
    "Fundamentos jurídicos (art. 319 IV CPC)",
    "Pedido com suas especificações (art. 319 IV CPC)",
    "Valor da causa (art. 292 CPC)",
    "Documentos essenciais (art. 320 CPC)",
  ],
  SENTENCA_CIVEL: [
    "Estrutura obrigatória: Relatório, Fundamentação, Dispositivo",
    "Fundamentação: analisar TODOS os pedidos (art. 489 CPC)",
    "Honorários: art. 85 CPC (mín. 10%, máx. 20%)",
    "Custas: art. 82 CPC",
    "Recurso cabível: Apelação, 15 dias",
  ],
};

export const CIVIL_NULLITY_GROUNDS = [
  "Ausência de fundamentação (art. 489 §1º CPC)",
  "Ausência de análise de pedido (omissão — art. 1.022 CPC)",
  "Contradição entre fundamentação e dispositivo",
  "Decisão extra petita / ultra petita",
  "Violação ao contraditório (art. 10 CPC)",
];

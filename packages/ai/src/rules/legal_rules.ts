export const LEGAL_RULES = {
  TRABALHO: {
    descricao: "Justiça do Trabalho",
    tribunal_primeiro_grau: "VARA DO TRABALHO",
    tribunal_segundo_grau: "TRT",
    tribunal_superior: "TST",
    artigos_bloqueados: [
      "art. 85 CPC",
      "art. 85 §2º CPC",
      "apelação",
      "apelação cível",
      "embargos infringentes",
      "art. 475-J CPC",
    ],
    diplomas_prioritarios: ["CLT", "CF/88 art. 7º", "CPC subsidiário"],
    recursos_validos: ["Recurso Ordinário", "Recurso de Revista", "Agravo de Instrumento", "Embargos de Declaração"],
    honorarios_artigo: "art. 791-A CLT",
    custas_artigo: "art. 789 CLT",
  },
  FEDERAL: {
    descricao: "Justiça Federal",
    tribunal_primeiro_grau: "VARA FEDERAL",
    tribunal_segundo_grau: "TRF",
    tribunal_superior: "STJ / STF",
    artigos_bloqueados: [] as string[],
    diplomas_prioritarios: ["CPC/2015", "CF/88", "Leis especiais federais"],
    recursos_validos: ["Apelação", "Agravo de Instrumento", "Recurso Especial", "Recurso Extraordinário"],
    honorarios_artigo: "art. 85 CPC/2015",
    custas_artigo: "art. 82 CPC/2015",
  },
  ESTADUAL: {
    descricao: "Justiça Estadual",
    tribunal_primeiro_grau: "VARA CÍVEL / VARA CRIMINAL",
    tribunal_segundo_grau: "TJXX",
    tribunal_superior: "STJ / STF",
    artigos_bloqueados: [] as string[],
    diplomas_prioritarios: ["CPC/2015", "CF/88", "Código Civil/2002", "CPP (se criminal)"],
    recursos_validos: ["Apelação", "Apelação Criminal (CPP art. 593)", "RESE", "Habeas Corpus", "Agravo de Instrumento", "Recurso Especial"],
    honorarios_artigo: "art. 85 CPC/2015 (cível) | sem honorários (criminal)",
    custas_artigo: "art. 82 CPC/2015",
  },
  INDETERMINADA: {
    descricao: "Jurisdição não identificada com segurança",
    tribunal_primeiro_grau: "[A DETERMINAR]",
    tribunal_segundo_grau: "[A DETERMINAR]",
    tribunal_superior: "[A DETERMINAR]",
    artigos_bloqueados: [] as string[],
    diplomas_prioritarios: [] as string[],
    recursos_validos: [] as string[],
    honorarios_artigo: "[A DETERMINAR conforme jurisdição]",
    custas_artigo: "[A DETERMINAR conforme jurisdição]",
  },
} as const;

export const FORBIDDEN_COMBINATIONS = [
  {
    id: "fc_001",
    descricao: "RPPS incompatível com Justiça do Trabalho",
    condicao_justica: "TRABALHO" as const,
    condicao_regime: "RPPS" as const,
    erro: "Servidores em regime RPPS são julgados pela Justiça Federal ou Estadual, não pela Justiça do Trabalho.",
    fatal: true,
  },
  {
    id: "fc_002",
    descricao: "RGPS incompatível com Justiça do Trabalho",
    condicao_justica: "TRABALHO" as const,
    condicao_regime: "RGPS" as const,
    erro: "Benefícios RGPS (INSS) são processados pela Justiça Federal, não pela Justiça do Trabalho.",
    fatal: true,
  },
  {
    id: "fc_003",
    descricao: "RPPS usa art. 40 CF, não art. 201 CF",
    condicao_regime: "RPPS" as const,
    descricao_erro: "Regime RPPS é regulado pelo art. 40 da CF/88 (servidor público). Art. 201 CF regula RGPS (INSS). Verifique se há citação incorreta de art. 201 em caso de servidor público.",
    fatal: false,
  },
] as const;

// ── Requisitos estruturais por tipo de peça ──────────────────────────────────

type PiecePattern = { pattern: RegExp; label: string; fatal: boolean };
type PieceStructuralRequirements = {
  required_text_patterns: PiecePattern[];
  required_structural_patterns: PiecePattern[];
  forbidden_patterns: PiecePattern[];
};

export const STRUCTURAL_REQUIREMENTS: Record<string, PieceStructuralRequirements> = {
  SENTENCA: {
    required_text_patterns: [
      { pattern: /relat[oó]rio/i, label: "Seção de Relatório", fatal: true },
      { pattern: /fundament[aã]/i, label: "Seção de Fundamentação", fatal: true },
      { pattern: /ante\s+o\s+exposto|julgo\s+(procedente|improcedente|extinto|parcialmente)/i, label: "Dispositivo (julgo procedente/improcedente)", fatal: true },
    ],
    required_structural_patterns: [
      { pattern: /processo\s+n[°oº.]/i, label: "Número do processo no cabeçalho", fatal: false },
    ],
    forbidden_patterns: [
      { pattern: /excelent[íi]ssimo/i, label: '"Excelentíssimo" proibido em sentença', fatal: true },
    ],
  },
  DECISAO: {
    required_text_patterns: [
      { pattern: /[ée]\s+o\s+relat[oó]rio\.?\s*(decido|passo\s+a\s+decidir)/i, label: '"É o relatório. Decido."', fatal: true },
      { pattern: /ante\s+o\s+exposto|defiro|indefiro|determino|indefiro\s+o\s+pedido|defiro\s+o\s+pedido/i, label: "Dispositivo (defiro/indefiro/determino)", fatal: true },
    ],
    required_structural_patterns: [
      { pattern: /processo\s+n[°oº.]/i, label: "Número do processo no cabeçalho", fatal: false },
    ],
    forbidden_patterns: [
      { pattern: /excelent[íi]ssimo/i, label: '"Excelentíssimo" proibido em decisão', fatal: true },
    ],
  },
  DESPACHO: {
    required_text_patterns: [
      { pattern: /processo\s+n[°oº.]|processo\s+em\s+ep[ií]grafe/i, label: "Referência ao número do processo", fatal: false },
    ],
    required_structural_patterns: [],
    forbidden_patterns: [
      { pattern: /excelent[íi]ssimo/i, label: '"Excelentíssimo" proibido em despacho', fatal: true },
      { pattern: /analis[eo]\s+(as?\s+provas?|o\s+m[eé]rito|probat[oó]rio)/i, label: "Análise probatória/mérito proibida em despacho", fatal: true },
      { pattern: /julgamento\s+de\s+m[eé]rito|m[eé]rito\s+da\s+causa/i, label: "Decisão de mérito proibida em despacho", fatal: true },
    ],
  },
  RECURSO: {
    required_text_patterns: [
      { pattern: /decis[aã]o\s+recorrida|senten[cç]a\s+(de|recorrida)|acord[aã]o\s+recorrido|decis[aã]o\s+de\s+primeiro/i, label: "Identificação da decisão recorrida", fatal: true },
      { pattern: /requer(-se)?|pedido\s+(recursal|de\s+reforma)|pede\s+(deferimento|provimento)|pede\-se/i, label: "Pedido recursal", fatal: true },
    ],
    required_structural_patterns: [],
    forbidden_patterns: [],
  },
  PETICAO_INICIAL: {
    required_text_patterns: [
      { pattern: /dos\s+fatos|i\.?\s*[—-]?\s*dos\s+fatos|dos\s+fatos\s+e/i, label: "Seção de Fatos", fatal: true },
      { pattern: /dos\s+pedidos|iv\.?\s*[—-]?\s*dos\s+pedidos|dos\s+requerimentos|v\.?\s*[—-]?\s*dos\s+pedidos/i, label: "Seção de Pedidos", fatal: true },
      { pattern: /valor\s+da\s+causa|d[ao]\s+valor\s+da\s+causa/i, label: "Valor da Causa", fatal: true },
    ],
    required_structural_patterns: [],
    forbidden_patterns: [],
  },
};

// ── Detector de conteúdo genérico ─────────────────────────────────────────────

export const GENERIC_EXPRESSIONS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bo\s+direito\s+alegado\b/gi, label: '"o direito alegado" sem especificação do direito concreto' },
  { pattern: /\breconhecimento\s+do\s+direito\s+alegado\b/gi, label: '"reconhecimento do direito alegado" — genérico demais' },
  { pattern: /\bpretens[aã]o\s+da\s+parte\s+(recorrente|autora|r[eé])\b/gi, label: '"pretensão da parte" sem identificar o pedido concreto' },
  { pattern: /\bcumprimento\s+d[ao]\s+obriga[cç][aã]o\b/gi, label: '"cumprimento da obrigação" sem identificar qual obrigação' },
  { pattern: /\bdireito\s+material\s+postulado\b/gi, label: '"direito material postulado" sem especificação' },
  { pattern: /\bmat[eé]ria\s+c[ií]vel\b/gi, label: '"matéria cível" — verifique se o caso não é criminal ou trabalhista' },
  { pattern: /\ba[cç][aã]o\s+declarat[oó]ria\b.*\b(flagrante|habeas|criminal|penal|pris[aã]o)/gis, label: '"ação declaratória" em contexto criminal — tipo de ação incorreto' },
  { pattern: /\bpesquisa\s+livre\b/gi, label: '"pesquisa livre" — descrição genérica, sem fatos reais' },
];

// ── Proibições absolutas no modo TEMPLATE_MODEL ───────────────────────────────

export const TEMPLATE_MODEL_PROHIBITIONS = [
  "julgo procedente",
  "julgo improcedente",
  "julgo extinto",
  "julgo parcialmente procedente",
  "defiro o pedido",
  "indefiro o pedido",
  "nego provimento",
  "dou provimento",
  "concedo a ordem",
  "denego a ordem",
  "condeno o réu",
  "condeno a parte ré",
  "condeno o reclamado",
  "condeno o requerido",
  "condeno o réu ao pagamento",
] as const;

// ── Templates de peças ────────────────────────────────────────────────────────

export const PIECE_TEMPLATES = {
  PETICAO_INICIAL: {
    estrutura: [
      "Endereçamento (nome do juízo, vara e comarca/estado competentes)",
      "Qualificação das partes (autor e réu com nome, CPF/CNPJ, endereço completos)",
      "Dos Fatos (narração cronológica e detalhada dos fatos concretos do caso)",
      "Do Direito (fundamentos jurídicos com artigos e normas específicas aplicáveis)",
      "Dos Pedidos (pedidos individualizados, específicos e com fundamento legal)",
      "Do Valor da Causa (valor em reais com fundamento legal — art. 292 CPC)",
      "Fechamento (local, data, assinatura do advogado com número OAB/UF)",
    ],
    endereçamento_obrigatorio: true,
    min_teses: 4,
    min_pedidos: 4,
    tom: "persuasivo",
    proibicoes: ["inventar fatos", "inventar pedidos não inferíveis do caso"],
  },
  RECURSO: {
    estrutura: [
      "Endereçamento ao tribunal competente (com número do processo e identificação das partes)",
      "Identificação da decisão recorrida (data, tipo, juízo de origem e síntese do que foi decidido)",
      "Razões de impugnação (fundamentos específicos do erro da decisão recorrida, ponto a ponto)",
      "Do pedido de reforma (o que especificamente deve ser modificado e por quê)",
      "Pedido final (conhecer e dar provimento ao recurso; pedidos acessórios)",
    ],
    endereçamento_obrigatorio: true,
    min_pontos_impugnacao: 2,
    tom: "técnico e combativo",
    proibicoes: ["aceitar premissas da decisão recorrida", "menos de 2 pontos autônomos de impugnação"],
  },
  SENTENCA: {
    estrutura: [
      "Cabeçalho (número do processo, nome das partes, tribunal e vara)",
      "Relatório (síntese dos fatos, alegações das partes e provas produzidas)",
      "Fundamentação (análise jurídica detalhada de cada tese, com normas e jurisprudência)",
      "Dispositivo (decisão final: julga procedente/improcedente; condenações; custas e honorários; recurso cabível)",
    ],
    cabecalho_obrigatorio: "Processo nº [...]",
    endereçamento_obrigatorio: false,
    min_paragrafos_por_tese: 4,
    tom: "imparcial e técnico",
    proibicoes: ["Excelentíssimo", "endereçamento a outro juiz", "omitir análise de qualquer pedido formulado"],
  },
  DECISAO: {
    estrutura: [
      "Cabeçalho (número do processo, nome das partes, tribunal e vara)",
      "Síntese do pedido (descrição objetiva do que está sendo decidido)",
      'Frase obrigatória: "É o relatório. Decido."',
      "Fundamentação (análise objetiva e sucinta do pedido com embasamento jurídico)",
      "Dispositivo (decisão: defiro / indefiro / determino — conforme o pedido)",
    ],
    cabecalho_obrigatorio: "Processo nº [...]",
    endereçamento_obrigatorio: false,
    tom: "objetivo e direto",
    proibicoes: ["Excelentíssimo", "estrutura completa de sentença — use decisão interlocutória sucinta"],
  },
  DESPACHO: {
    estrutura: [
      "Cabeçalho (número do processo e partes)",
      "Ordem processual (determinação de impulso do feito — sem análise de mérito, fatos ou provas)",
    ],
    cabecalho_obrigatorio: "Processo nº [...]",
    endereçamento_obrigatorio: false,
    tom: "conciso e direto",
    proibicoes: ["Excelentíssimo", "fundamentação extensa", "análise de mérito", "apreciação probatória", "estrutura de sentença"],
  },
} as const;

export const APPEAL_RULES = {
  SENTENCA: {
    TRABALHO:      { recurso: "Recurso Ordinário", sigla: "RO", prazo_dias: 8, tribunal_destino: "TRT", fundamento: "art. 895 CLT" },
    FEDERAL:       { recurso: "Apelação", sigla: "AC", prazo_dias: 15, tribunal_destino: "TRF", fundamento: "art. 1.009 CPC/2015" },
    ESTADUAL:      { recurso: "Apelação (cível: art. 1.009 CPC) ou Apelação Criminal (criminal: art. 593 CPP)", sigla: "APL", prazo_dias: 15, tribunal_destino: "TJXX", fundamento: "art. 1.009 CPC/2015 ou art. 593 CPP" },
    INDETERMINADA: { recurso: "[A DETERMINAR conforme jurisdição]", sigla: "?", prazo_dias: 0, tribunal_destino: "[A DETERMINAR]", fundamento: "[A DETERMINAR]" },
  },
  ACORDAO_TRT: { recurso: "Recurso de Revista", sigla: "RR", prazo_dias: 8, tribunal_destino: "TST", fundamento: "art. 896 CLT" },
  ACORDAO_TRF: { recurso: "Recurso Especial", sigla: "REsp", prazo_dias: 15, tribunal_destino: "STJ", fundamento: "art. 105 III CF/88" },
  ACORDAO_TJ:  { recurso: "Recurso Especial", sigla: "REsp", prazo_dias: 15, tribunal_destino: "STJ", fundamento: "art. 105 III CF/88" },
} as const;

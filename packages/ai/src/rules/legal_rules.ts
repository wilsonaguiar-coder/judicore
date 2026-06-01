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
    tribunal_primeiro_grau: "VARA CÍVEL",
    tribunal_segundo_grau: "TJXX",
    tribunal_superior: "STJ / STF",
    artigos_bloqueados: [] as string[],
    diplomas_prioritarios: ["CPC/2015", "CF/88", "Código Civil/2002"],
    recursos_validos: ["Apelação", "Agravo de Instrumento", "Recurso Especial", "Recurso Extraordinário"],
    honorarios_artigo: "art. 85 CPC/2015",
    custas_artigo: "art. 82 CPC/2015",
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
    id: "fc_003",
    descricao: "RPPS não usa art. 201 CF",
    condicao_regime: "RPPS" as const,
    artigos_bloqueados: ["art. 201 CF", "art. 201 da CF"],
    fatal: false,
  },
  {
    id: "fc_004",
    descricao: "Apelação não existe na Justiça do Trabalho",
    condicao_justica: "TRABALHO" as const,
    termos_bloqueados: ["apelação", "apelação cível"],
    fatal: false,
  },
] as const;

export const PIECE_TEMPLATES = {
  PETICAO_INICIAL: {
    estrutura: ["ENDEREÇAMENTO", "QUALIFICACAO_PARTES", "FATOS", "DIREITO", "PEDIDOS", "VALOR_CAUSA", "FECHAMENTO"],
    endereçamento_obrigatorio: true,
    min_teses: 4,
    min_pedidos: 4,
    tom: "persuasivo",
    proibicoes: ["inventar fatos", "inventar pedidos não inferíveis"],
  },
  RECURSO: {
    estrutura: ["ENDEREÇAMENTO_TRIBUNAL", "RAZOES_IMPUGNACAO", "PEDIDO_PROVIMENTO"],
    endereçamento_obrigatorio: true,
    min_pontos_impugnacao: 2,
    tom: "técnico e combativo",
    proibicoes: ["aceitar premissas da decisão recorrida", "menos de 2 pontos autônomos de impugnação"],
  },
  SENTENCA: {
    estrutura: ["CABECALHO_PROCESSO", "RELATORIO", "FUNDAMENTACAO", "DISPOSITIVO"],
    cabecalho_obrigatorio: "Processo nº [...]",
    endereçamento_obrigatorio: false,
    min_paragrafos_por_tese: 4,
    tom: "imparcial e técnico",
    proibicoes: ["Excelentíssimo", "endereçamento a outro juiz", "omitir análise dos pedidos"],
  },
  DECISAO: {
    estrutura: ["CABECALHO_PROCESSO", "FUNDAMENTACAO_BREVE", "DISPOSITIVO"],
    cabecalho_obrigatorio: "Processo nº [...]",
    endereçamento_obrigatorio: false,
    tom: "objetivo e direto",
    proibicoes: ["Excelentíssimo", "estrutura de sentença completa"],
  },
  DESPACHO: {
    estrutura: ["CABECALHO_PROCESSO", "ORDEM_OU_IMPULSO"],
    cabecalho_obrigatorio: "Processo nº [...]",
    endereçamento_obrigatorio: false,
    tom: "conciso e direto",
    proibicoes: ["Excelentíssimo", "fundamentação extensa", "estrutura de sentença"],
  },
} as const;

export const APPEAL_RULES = {
  SENTENCA: {
    TRABALHO: { recurso: "Recurso Ordinário", sigla: "RO", prazo_dias: 8, tribunal_destino: "TRT", fundamento: "art. 895 CLT" },
    FEDERAL:  { recurso: "Apelação", sigla: "AC", prazo_dias: 15, tribunal_destino: "TRF", fundamento: "art. 1.009 CPC/2015" },
    ESTADUAL: { recurso: "Apelação", sigla: "APL", prazo_dias: 15, tribunal_destino: "TJXX", fundamento: "art. 1.009 CPC/2015" },
  },
  ACORDAO_TRT: { recurso: "Recurso de Revista", sigla: "RR", prazo_dias: 8, tribunal_destino: "TST", fundamento: "art. 896 CLT" },
  ACORDAO_TRF: { recurso: "Recurso Especial", sigla: "REsp", prazo_dias: 15, tribunal_destino: "STJ", fundamento: "art. 105 III CF/88" },
  ACORDAO_TJ:  { recurso: "Recurso Especial", sigla: "REsp", prazo_dias: 15, tribunal_destino: "STJ", fundamento: "art. 105 III CF/88" },
} as const;

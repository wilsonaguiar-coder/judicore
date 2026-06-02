// Ponto de entrada central das regras jurídicas do JudiCore.
// Importa e re-exporta todos os módulos especializados.

export { TRIBUNAL_RULES as LEGAL_RULES } from "./tribunal.rules.js";
import { TRIBUNAL_RULES } from "./tribunal.rules.js";
import type { JurisdicaoRule } from "./base.rules.js";
export { FORBIDDEN_COMBINATIONS } from "./base.rules.js";
export type { JurisdicaoRule, ForbiddenCombination } from "./base.rules.js";
export { APPEAL_BY_JUSTICE, INCOMPATIBLE_APPEALS, SUPERIOR_COURT_ROUTES } from "./appeal.rules.js";
export type { AppealRule } from "./appeal.rules.js";
export { LABOR_BLOCKED_TERMS, LABOR_REQUIRED_RESOURCES, LABOR_HONORARIOS_RULES } from "./labor.rules.js";
export { RPPS_RULES, RGPS_RULES, PREVIDENCIARIO_COMMON_ERRORS } from "./previdenciario.rules.js";
export { CRIMINAL_BLOCKED_TERMS, CRIMINAL_PIECE_RULES, CRIMINAL_KEY_ARTICLES, CRIMINAL_HONORARIOS_RULE, FLAGRANTE_LEGALITY_CHECKLIST } from "./criminal.rules.js";
export { CIVIL_KEY_ARTICLES, CIVIL_PIECE_RULES } from "./civil.rules.js";
export { TAX_KEY_ARTICLES, EXECUCAO_FISCAL_RULES } from "./tax.rules.js";

// ── Requisitos estruturais por tipo de peça ──────────────────────────────────

type PiecePattern = { pattern: RegExp; label: string; fatal: boolean; rule?: string };
type PieceStructuralRequirements = {
  required_text_patterns: PiecePattern[];
  required_structural_patterns: PiecePattern[];
  forbidden_patterns: PiecePattern[];
};

export const STRUCTURAL_REQUIREMENTS: Record<string, PieceStructuralRequirements> = {
  SENTENCA: {
    required_text_patterns: [
      // Aceita "RELATÓRIO" literal ou narrativa inicial equivalente (trata-se de / cuida-se de)
      // — sentenças criminais frequentemente abrem com a narrativa sem título explícito
      {
        pattern: /relat[oó]rio|trata[\s-]se\s+de|cuida[\s-]se\s+de|trata\s+o\s+feito/i,
        label: "Relatório ou narrativa inicial dos fatos",
        fatal: true,
      },
      // Aceita "FUNDAMENTAÇÃO" ou seções equivalentes: MOTIVAÇÃO, ANÁLISE DO MÉRITO, FUNDAMENTO
      {
        pattern: /fundamenta[cç][aã]o|motiva[cç][aã]o|an[aá]lise\s+do\s+m[eé]rito|\bfundamento\b/i,
        label: "Fundamentação ou seção equivalente (MOTIVAÇÃO / ANÁLISE DO MÉRITO / FUNDAMENTO)",
        fatal: true,
      },
      // Dispositivo de sentença — cobre todos os tipos:
      //   cível/trabalhista/previdenciário: julgo procedente/improcedente/extinto
      //   penal de mérito: absolvo, condeno, desclassifico, declaro extinta a punibilidade
      //   HC: concedo/denego a ordem
      //   incidentais criminais: defiro/indefiro/revogo/mantenho/relaxo/decreto a
      {
        pattern:
          /ante\s+o\s+exposto|julgo\s+(procedente|improcedente|extinto|parcialmente)|absolvo|condeno|desclassifico|declaro\s+extinta?\s+a\s+punibilidade|defiro|indefiro|revogo|mantenho|concedo\s+(parcialmente\s+)?a?\s*ordem|denego\s+a?\s*ordem|decreto\s+a|relaxo/i,
        label: "Dispositivo (julgo/absolvo/condeno/desclassifico/declaro extinta/defiro/indefiro/revogo/mantenho/concedo a ordem)",
        fatal: true,
      },
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
      // "É o relatório. Decido." é fórmula do CPC — comum em interlocutórias civis/previdenciárias,
      // mas não obrigatória em decisões criminais (HC, cautelares, execução penal). Non-fatal.
      {
        pattern: /[ée]\s+o\s+relat[oó]rio\.?\s*(decido|passo\s+a\s+decidir)/i,
        label: '"É o relatório. Decido." (recomendado em interlocutórias civis)',
        fatal: false,
      },
      // Dispositivo ampliado: cobre HC (concedo/denego a ordem), liberdade provisória e
      // cautelares criminais (revogo/mantenho/substituo), execução penal (relaxo/decreto),
      // interlocutórias civis (defiro/indefiro/determino), gerais (ante o exposto).
      {
        pattern: /ante\s+o\s+exposto|defiro|indefiro|determino|revogo|mantenho|substituo|relaxo|decreto\s+a|torno\s+sem\s+efeito|concedo\s+(parcialmente\s+)?a?\s*ordem|denego\s+a?\s*ordem/i,
        label: 'Dispositivo (defiro/indefiro/determino/revogo/mantenho/concedo a ordem/denego a ordem/relaxo/substituo)',
        fatal: true,
      },
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
      { pattern: /\bjulgo\b/i, label: '"julgo" proibido em despacho', fatal: true },
      {
        pattern: /\b(defiro|indefiro|rejeito|acolho|condeno|absolvo|nego\s+provimento|dou\s+provimento)\b/i,
        label: "Despacho não deve conter linguagem decisória ou análise de mérito.",
        rule: "DESPACHO_WITH_DECISION_LANGUAGE",
        fatal: true,
      },
    ],
  },
  RECURSO: {
    required_text_patterns: [
      { pattern: /decis[aã]o\s+recorrida|senten[cç]a\s+(de|recorrida)|acord[aã]o\s+recorrido|decis[aã]o\s+de\s+primeiro/i, label: "Identificação da decisão recorrida", fatal: false },
      { pattern: /requer(-se)?|pedido\s+(recursal|de\s+reforma)|pede\s+(deferimento|provimento)|pede\-se/i, label: "Pedido recursal", fatal: false },
    ],
    required_structural_patterns: [],
    forbidden_patterns: [],
  },
  PETICAO_INICIAL: {
    required_text_patterns: [
      { pattern: /dos\s+fatos|i\.?\s*[—\-]?\s*dos\s+fatos|dos\s+fatos\s+e/i, label: "Seção de Fatos", fatal: false },
      { pattern: /dos\s+pedidos|iv\.?\s*[—\-]?\s*dos\s+pedidos|dos\s+requerimentos|v\.?\s*[—\-]?\s*dos\s+pedidos/i, label: "Seção de Pedidos", fatal: false },
      { pattern: /valor\s+da\s+causa|d[ao]\s+valor\s+da\s+causa/i, label: "Valor da Causa", fatal: false },
    ],
    required_structural_patterns: [],
    forbidden_patterns: [],
  },
};

// ── Detector de conteúdo genérico ─────────────────────────────────────────────

// Não usar flag `g` nestas expressões: .test() com `g` mantém lastIndex entre chamadas,
// causando falsos negativos quando o mesmo padrão é testado mais de uma vez por chamada.
export const GENERIC_EXPRESSIONS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bo\s+direito\s+alegado\b/i, label: '"o direito alegado" sem especificação do direito concreto' },
  { pattern: /\breconhecimento\s+do\s+direito\s+alegado\b/i, label: '"reconhecimento do direito alegado" — genérico demais' },
  { pattern: /\bpretens[aã]o\s+da\s+parte\s+(recorrente|autora|r[eé])\b/i, label: '"pretensão da parte" sem identificar o pedido concreto' },
  // "cumprimento da obrigação" removido do array estático — verificação contextual
  // em GenericityValidator.detect() para não disparar em ação de obrigação de fazer,
  // cumprimento de sentença, art. 536 CPC e variantes legítimas.
  { pattern: /\bdireito\s+material\s+postulado\b/i, label: '"direito material postulado" sem especificação' },
  { pattern: /\bmat[eé]ria\s+c[ií]vel\b/i, label: '"matéria cível" — verifique se o caso não é criminal ou trabalhista' },
  { pattern: /\ba[cç][aã]o\s+declarat[oó]ria\b.*\b(flagrante|habeas|criminal|penal|pris[aã]o)/is, label: '"ação declaratória" em contexto criminal — tipo de ação incorreto' },
  { pattern: /\bpesquisa\s+livre\b/i, label: '"pesquisa livre" — descrição genérica, sem fatos reais' },
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
  "absolvo o réu",
  "condeno o acusado",
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
      "Dispositivo (decisão final: julga procedente/improcedente ou absolve/condena; custas e honorários; recurso cabível)",
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

// Helper para acessar regras de jurisdição com fallback seguro
export function getJurisdicaoRules(tipoJustica: string): JurisdicaoRule {
  const rules = (TRIBUNAL_RULES as Record<string, JurisdicaoRule | undefined>)[tipoJustica];
  if (rules) return rules;
  const fallback = (TRIBUNAL_RULES as Record<string, JurisdicaoRule | undefined>)["INDETERMINADA"];
  if (fallback) return fallback;
  return { descricao: "Indeterminado", tribunal_primeiro_grau: "?", tribunal_segundo_grau: "?", tribunal_superior: "?", artigos_bloqueados: [], diplomas_prioritarios: [], recursos_validos: [], honorarios_artigo: "[A DETERMINAR]", custas_artigo: "[A DETERMINAR]" };
}

// Re-exporta APPEAL_RULES no formato legado para compatibilidade
export const APPEAL_RULES = {
  SENTENCA: {
    TRABALHO:      { recurso: "Recurso Ordinário", sigla: "RO", prazo_dias: 8, tribunal_destino: "TRT", fundamento: "art. 895 CLT" },
    FEDERAL:       { recurso: "Apelação", sigla: "AC", prazo_dias: 15, tribunal_destino: "TRF", fundamento: "art. 1.009 CPC/2015" },
    ESTADUAL:      { recurso: "Apelação (cível) ou Apelação Criminal (art. 593 CPP)", sigla: "APL", prazo_dias: 15, tribunal_destino: "TJXX", fundamento: "art. 1.009 CPC/2015 ou art. 593 CPP" },
    JEF:           { recurso: "Recurso Inominado", sigla: "RI", prazo_dias: 10, tribunal_destino: "Turma Recursal Federal", fundamento: "art. 42 Lei 9.099/95" },
    JEC:           { recurso: "Recurso Inominado", sigla: "RI", prazo_dias: 10, tribunal_destino: "Turma Recursal Estadual", fundamento: "art. 42 Lei 9.099/95" },
    CRIMINAL:      { recurso: "Apelação Criminal", sigla: "APL", prazo_dias: 5, tribunal_destino: "TJXX/TRF", fundamento: "art. 593 CPP" },
    EXECUCAO_FISCAL: { recurso: "Apelação", sigla: "AC", prazo_dias: 15, tribunal_destino: "TRF/TJXX", fundamento: "art. 34 LEF ou art. 1.009 CPC" },
    INDETERMINADA: { recurso: "[A DETERMINAR]", sigla: "?", prazo_dias: 0, tribunal_destino: "[A DETERMINAR]", fundamento: "[A DETERMINAR]" },
  },
  ACORDAO_TRT: { recurso: "Recurso de Revista", sigla: "RR", prazo_dias: 8, tribunal_destino: "TST", fundamento: "art. 896 CLT" },
  ACORDAO_TRF: { recurso: "Recurso Especial", sigla: "REsp", prazo_dias: 15, tribunal_destino: "STJ", fundamento: "art. 105 III CF/88" },
  ACORDAO_TJ:  { recurso: "Recurso Especial", sigla: "REsp", prazo_dias: 15, tribunal_destino: "STJ", fundamento: "art. 105 III CF/88" },
} as const;

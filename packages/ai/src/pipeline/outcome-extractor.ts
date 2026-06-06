import type { DecidedOutcome, TipoPeca } from "./types.js";

// ── Padrões de extração de direção decisória ─────────────────────────────────

const OUTCOME_PATTERNS: Array<{ pattern: RegExp; outcome: DecidedOutcome }> = [
  // Habeas corpus
  { pattern: /\bconcedo\s+(?:a\s+)?ordem\b|\bconceder\s+(?:a\s+)?ordem\b|\bhc\s+concedido\b|\border\s+concedida\b/i, outcome: "CONCEDO_ORDEM" },
  { pattern: /\bdenego\s+(?:a\s+)?(?:ordem|seguran[cç]a)\b|\bdenegar\s+(?:a\s+)?(?:ordem|seguran[cç]a)\b|\bhc\s+denegado\b|\border\s+denegada\b|\bseguran[cç]a\s+denegada\b/i, outcome: "DENEGO_ORDEM" },
  // Criminal
  { pattern: /\bcondeno\b|\bcondenar\b|\bcondena[cç][aã]o\b/i, outcome: "CONDENO" },
  { pattern: /\babsolvo\b|\babsolver\b|\babsolvendo\b|\babsolvição\b/i, outcome: "ABSOLVO" },
  // Decisão interlocutória
  { pattern: /\bindefiro\b|\bindeferido\b|\bindefiro\s+o\s+pedido\b/i, outcome: "INDEFIRO" },
  { pattern: /\bdefiro\b|\bdeferido\b|\bdefiro\s+o\s+pedido\b/i, outcome: "DEFIRO" },
  // Sentença cível/previdenciária/trabalhista — parcialmente procedente primeiro (mais específico)
  { pattern: /\bparcialmente\s+procedente\b|\bprocedente\s+em\s+parte\b|\bprocedência\s+parcial\b/i, outcome: "PARCIALMENTE_PROCEDENTE" },
  { pattern: /\bimprocedente\b|\bimprocedência\b|\bimprocedentes?\b|\bjulgar\s+improcedente\b|\bsentença\s+de\s+improcedência\b/i, outcome: "IMPROCEDENTE" },
  { pattern: /\bprocedente\b|\bprocedência\b|\bjulgar\s+procedente\b|\bsentença\s+de\s+procedência\b/i, outcome: "PROCEDENTE" },
];

/**
 * Extrai a direção decisória da instrução do usuário.
 * Retorna undefined quando a instrução não contém nenhuma indicação de direção.
 */
export function extractDecidedOutcome(instruction?: string): DecidedOutcome | undefined {
  if (!instruction?.trim()) return undefined;
  for (const { pattern, outcome } of OUTCOME_PATTERNS) {
    if (pattern.test(instruction)) return outcome;
  }
  return undefined;
}

// ── Mapeamento de outcome para padrões esperados no dispositivo ───────────────

interface OutcomeExpectation {
  label: string;
  positivePatterns: RegExp[];
  negativePatterns: RegExp[];
}

const OUTCOME_EXPECTATIONS: Record<DecidedOutcome, OutcomeExpectation> = {
  PROCEDENTE: {
    label: "PROCEDENTE",
    positivePatterns: [/julg(?:o|amos)\s+procedente/i, /\bprocedência\s+(?:total|integral|d[oa]s?\s+pedidos?)\b/i],
    negativePatterns: [/julg(?:o|amos)\s+improcedente/i],
  },
  IMPROCEDENTE: {
    label: "IMPROCEDENTE",
    positivePatterns: [/julg(?:o|amos)\s+improcedente/i, /\bimprocedência\s+(?:d[oa]s?\s+pedidos?)\b/i],
    negativePatterns: [/julg(?:o|amos)\s+procedente/i],
  },
  PARCIALMENTE_PROCEDENTE: {
    label: "PARCIALMENTE PROCEDENTE",
    positivePatterns: [/julg(?:o|amos)\s+parcialmente\s+procedente/i, /parcial(?:mente)?\s+procedente/i],
    negativePatterns: [],
  },
  DEFIRO: {
    label: "DEFIRO",
    positivePatterns: [/\bdefiro\b/i, /\bdeferido\b/i],
    negativePatterns: [/\bindefiro\b/i, /\bindeferido\b/i],
  },
  INDEFIRO: {
    label: "INDEFIRO",
    positivePatterns: [/\bindefiro\b/i, /\bindeferido\b/i],
    negativePatterns: [/\bdefiro\b(?!\s+em\s+parte)/i],
  },
  CONCEDO_ORDEM: {
    label: "CONCEDO A ORDEM",
    positivePatterns: [/\bconcedo\s+(?:a\s+)?ordem\b/i, /\border\s+concedida\b/i],
    negativePatterns: [/\bdenego\s+(?:a\s+)?ordem\b/i],
  },
  DENEGO_ORDEM: {
    label: "DENEGO A ORDEM",
    positivePatterns: [/\bdenego\s+(?:a\s+)?ordem\b/i, /\border\s+denegada\b/i],
    negativePatterns: [/\bconcedo\s+(?:a\s+)?ordem\b/i],
  },
  CONDENO: {
    label: "CONDENO",
    positivePatterns: [/\bcondeno\b/i],
    negativePatterns: [/\babsolvo\b/i],
  },
  ABSOLVO: {
    label: "ABSOLVO",
    positivePatterns: [/\babsolvo\b/i],
    negativePatterns: [/\bcondeno\b/i],
  },
};

export function getOutcomeExpectation(outcome: DecidedOutcome): OutcomeExpectation {
  return OUTCOME_EXPECTATIONS[outcome];
}

// ── Gerador do bloco "SENTIDO DO JULGAMENTO" ─────────────────────────────────

const OUTCOME_LABEL: Record<DecidedOutcome, string> = {
  PROCEDENTE:            "PROCEDENTE",
  IMPROCEDENTE:          "IMPROCEDENTE",
  PARCIALMENTE_PROCEDENTE: "PARCIALMENTE PROCEDENTE",
  DEFIRO:                "DEFIRO (deferido)",
  INDEFIRO:              "INDEFIRO (indeferido)",
  CONCEDO_ORDEM:         "CONCEDO A ORDEM",
  DENEGO_ORDEM:          "DENEGO A ORDEM",
  CONDENO:               "CONDENO",
  ABSOLVO:               "ABSOLVO",
};

const OUTCOME_DISPOSITIVO: Record<DecidedOutcome, string> = {
  PROCEDENTE:            '"Julgo PROCEDENTE o pedido" ou "Julgo PROCEDENTE os pedidos"',
  IMPROCEDENTE:          '"Julgo IMPROCEDENTE o pedido" ou "Julgo IMPROCEDENTE os pedidos"',
  PARCIALMENTE_PROCEDENTE: '"Julgo PARCIALMENTE PROCEDENTE o pedido" especificando quais pedidos são acolhidos e quais são rejeitados',
  DEFIRO:                '"Defiro o pedido" ou "Defiro o requerimento"',
  INDEFIRO:              '"Indefiro o pedido" ou "Indefiro o requerimento"',
  CONCEDO_ORDEM:         '"Concedo a ordem" com indicação do efeito prático',
  DENEGO_ORDEM:          '"Denego a ordem"',
  CONDENO:               '"Condeno o réu [NOME] pela prática do art. [X]..." com dosimetria completa',
  ABSOLVO:               '"Absolvo o réu [NOME], da imputação do art. [X], com fundamento no art. 386, [INCISO], do CPP"',
};

/**
 * Gera o bloco de diretiva decisória que deve ser inserido no início do prompt,
 * antes de qualquer outro conteúdo gerado.
 */
export function buildDecisionDirectiveBlock(outcome: DecidedOutcome, tipoPeca: TipoPeca): string {
  const label = OUTCOME_LABEL[outcome];
  const dispositivo = OUTCOME_DISPOSITIVO[outcome];

  return `
╔══════════════════════════════════════════════════════╗
║         DIREÇÃO DECISÓRIA — OBRIGATÓRIA              ║
╚══════════════════════════════════════════════════════╝

O resultado obrigatório desta ${tipoPeca} é: ${label}

REGRAS ABSOLUTAS E INVIOLÁVEIS:
1. O DISPOSITIVO desta peça DEVE obrigatoriamente refletir o resultado ${label}.
   Forma correta: ${dispositivo}
2. É ABSOLUTAMENTE PROIBIDO gerar dispositivo com resultado diferente de ${label}.
3. A fundamentação jurídica DEVE conduzir logicamente ao resultado ${label}.
4. Se a jurisprudência fornecida apoiar resultado diferente de ${label}, use-a para distinguishing ou omita-a completamente — NUNCA a use para contradizer a direção decisória.
5. Esta diretiva tem PRECEDÊNCIA ABSOLUTA sobre qualquer outra instrução deste prompt.

`;
}

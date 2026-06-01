// Detecta o contexto em que um artigo constitucional é citado para distinguir
// entre uso direto (fundamento) vs. uso distintivo (contraste entre regimes).
//
// Uso típico:
//   const ctx = detectArticleContext(draft, "201");
//   if (ctx === "DIRECT_FOUNDATION") → erro CRITICAL/fatal
//   if (ctx === "DISTINCTION") → sem erro
//   if (ctx === "AMBIGUOUS") → aviso (não fatal)

// Janela de contexto ao redor da menção (chars antes/depois)
const CONTEXT_WINDOW = 250;

// Expressões que indicam uso para DISTINGUIR regimes (RPPS vs RGPS)
const DISTINCTION_MARKERS = [
  /não\s+se\s+confunde/i,
  /distingue-se/i,
  /diferentemente/i,
  /ao\s+contrário/i,
  /regime\s+distinto/i,
  /não\s+se\s+aplica/i,
  /enquanto\s+(o\s+)?(art\.|regime)/i,
  /diversamente/i,
  /em\s+oposição/i,
  /rpps/i,
  /rgps/i,
  /regime\s+próprio/i,
  /regime\s+geral/i,
];

// Expressões que indicam uso COMO FUNDAMENTO DIRETO do pedido
const DIRECT_USE_MARKERS = [
  /com\s+fundamento\s+no\s+art\.\s*\d+/i,
  /nos\s+termos\s+do\s+art\.\s*\d+/i,
  /assegurado\s+pelo\s+art\.\s*\d+/i,
  /amparado\s+pelo\s+art\.\s*\d+/i,
  /previsto\s+no\s+art\.\s*\d+/i,
  /faz\s+jus.*nos\s+termos\s+do\s+art\.\s*\d+/i,
  /direito\s+(à|a)\s+.*art\.\s*\d+/i,
  /conforme\s+(o\s+)?art\.\s*\d+/i,
  /pleiteia.*art\.\s*\d+/i,
];

export type ArticleContext = "DIRECT_FOUNDATION" | "DISTINCTION" | "AMBIGUOUS" | "NOT_PRESENT";

/**
 * Determina o contexto em que um artigo da CF é citado no draft.
 *
 * @param draft  Texto da peça
 * @param article  Número do artigo (ex: "201", "40")
 * @returns       Contexto detectado
 */
export function detectArticleContext(draft: string, article: string): ArticleContext {
  const articleRegex = new RegExp(
    `art\\.\\s*${article}\\s*(?:[ºo°]|\\b)(?:[^a-zA-Z]|\\s)*?(?:da\\s+)?(?:cf|constitui[çc][ãa]o)`,
    "gi",
  );
  const matches: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = articleRegex.exec(draft)) !== null) {
    matches.push(m.index);
  }
  if (matches.length === 0) return "NOT_PRESENT";

  let hasDirect = false;
  let hasDistinction = false;

  for (const idx of matches) {
    const start = Math.max(0, idx - CONTEXT_WINDOW);
    const end = Math.min(draft.length, idx + CONTEXT_WINDOW);
    const window = draft.slice(start, end);

    const isDistinction = DISTINCTION_MARKERS.some((re) => re.test(window));
    const isDirect = DIRECT_USE_MARKERS.some((re) => re.test(window));

    if (isDirect && !isDistinction) hasDirect = true;
    else if (isDistinction && !isDirect) hasDistinction = true;
    // Quando ambos batem ou nenhum bate → ambíguo (não conta para nenhum lado)
  }

  if (hasDirect) return "DIRECT_FOUNDATION";
  if (hasDistinction) return "DISTINCTION";
  return "AMBIGUOUS";
}

/**
 * Helper especializado: o artigo está sendo usado para distinguir regimeA de regimeB?
 */
export function isArticleUsedAsDistinction(
  draft: string,
  article: string,
  regimeA: string,
  regimeB: string,
): boolean {
  if (detectArticleContext(draft, article) === "DISTINCTION") return true;
  // Reforço: se os dois nomes de regime aparecem dentro da janela, é distinção
  const articleRegex = new RegExp(`art\\.\\s*${article}`, "gi");
  let m: RegExpExecArray | null;
  while ((m = articleRegex.exec(draft)) !== null) {
    const start = Math.max(0, m.index - CONTEXT_WINDOW);
    const end = Math.min(draft.length, m.index + CONTEXT_WINDOW);
    const window = draft.slice(start, end).toLowerCase();
    if (window.includes(regimeA.toLowerCase()) && window.includes(regimeB.toLowerCase())) return true;
  }
  return false;
}

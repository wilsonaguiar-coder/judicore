// RichnessValidator — qualidade argumentativa das peças geradas.
//
// FASE 4.5 — ArgumentRichnessAnalyzer:
//   Substitui checagens binárias por score 0-100.
//   FINAL_DRAFT_WEAK_ARGUMENTATION só dispara quando score < 70.
//   Elimina falsos positivos causados por peças juridicamente sólidas
//   que apenas não seguem os padrões de formatação esperados.

import type { ValidationError } from "../pipeline/types.js";

// ── Pontuação máxima por dimensão ─────────────────────────────────────────────
const SCORES = {
  normativeVariety:       30,  // arts./leis/decretos únicos citados
  sectionStructure:       25,  // seções argumentativas desenvolvidas
  jurisprudentialVariety: 20,  // tribunais/precedentes citados
  objectionHandling:      15,  // enfrentamento de objeções/teses contrárias
  noGenericExpressions:   10,  // ausência de expressões genéricas proibidas
};

// ── Expressões proibidas (genéricas) ─────────────────────────────────────────

const BANNED_EXPRESSIONS = [
  "direito alegado",
  "pretensão da parte",
  "reconhecimento do direito",
  "matéria cível",
];

// ── Detectores ─────────────────────────────────────────────────────────────────

const SECTION_MARKERS_RE =
  /\bTese\s+\d+|^\s*\d+\.\s+\S|^\s*[IVX]+\s*[.—\-\):;]|^\s*D[AO]S?\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚ]{3}/gim;

const TUTELA_KEYWORDS_RE =
  /previdenci|pensão\s+por\s+morte|benefício|servidor\s+públic|alimentar|saúde|remuneratório|salarial|vencimentos|proventos|aposentadori|paridade|reajuste/i;

const OBJECTION_HANDLING_RE =
  /(?:poder[-\s]se[-\s]ia\s+(?:alegar|sustentar|objetar|arguir)|eventual\s+(?:alegação|objeção|argumento|sustentação)|argumento\s+(?:em\s+contrário|contrário|da\s+(?:parte\s+)?ré|do\s+réu)|tese\s+(?:contrária|da\s+defesa|adversa)|em\s+resposta\s+(?:a\s+eventual|ao\s+argumento)|pode[-\s]se\s+(?:alegar|objetar)|a\s+(?:parte\s+)?(?:ré|recorrida|requerida)\s+(?:poderá?|poderão|argumentará?|sustentará?)|n[ãa]o\s+(?:é|será)\s+suficiente\s+(?:alegar|arguir)|ainda\s+que\s+se\s+alegue|mesmo\s+que\s+(?:se\s+)?(?:invoque|sustente|alegue)|contrarrazões?\s+(?:que\s+)?(?:podem|deverão?\s+ser))/i;

// ── ArgumentRichnessAnalyzer ──────────────────────────────────────────────────

export interface RichnessScoreDetail {
  total: number;
  normativeVariety: number;
  sectionStructure: number;
  jurisprudentialVariety: number;
  objectionHandling: number;
  noGenericExpressions: number;
  bannedExpressionsFound: string[];
}

export function analyzeArgumentRichness(
  draft: string,
  tipoPeca?: string,
): RichnessScoreDetail {
  // ── 1. Variedade normativa (0-30) ─────────────────────────────────────────
  const artMatches = [...new Set(
    (draft.match(/art(?:igo)?\.\s*\d+[\w\-º°]*/gi) ?? [])
      .map(m => m.toLowerCase().replace(/\s/g, "")),
  )];
  const lawMatches = [...new Set([
    ...(draft.match(/lei\s+(?:n[.°º]?\s*)?\d[\d.,\/]*/gi) ?? []),
    ...(draft.match(/decreto[\s-]lei\s+n[.°º]?\s*\d+/gi) ?? []),
    ...(draft.match(/EC\s+\d+\/\d+|emenda\s+constitucional\s+n[.°º]?\s*\d+/gi) ?? []),
    ...(draft.match(/\bCPC\/\d{4}|\bCF\/\d{2}\b|\bCDC\b/gi) ?? []),
  ].map(m => m.toLowerCase().replace(/\s/g, "")))];
  const normCount = artMatches.length + lawMatches.length;
  const normScore =
    normCount >= 8 ? SCORES.normativeVariety :
    normCount >= 5 ? Math.round(SCORES.normativeVariety * 0.83) :
    normCount >= 3 ? Math.round(SCORES.normativeVariety * 0.5) :
    normCount >= 1 ? Math.round(SCORES.normativeVariety * 0.17) : 0;

  // ── 2. Estrutura de seções (0-25) ─────────────────────────────────────────
  const sectionCount = (draft.match(SECTION_MARKERS_RE) ?? []).length;
  const sectionScore =
    sectionCount >= 6 ? SCORES.sectionStructure :
    sectionCount >= 4 ? Math.round(SCORES.sectionStructure * 0.72) :
    sectionCount >= 2 ? Math.round(SCORES.sectionStructure * 0.4) :
    sectionCount >= 1 ? Math.round(SCORES.sectionStructure * 0.2) : 0;

  // ── 3. Variedade jurisprudencial (0-20) ───────────────────────────────────
  const courts = new Set<string>();
  if (/\bSTF\b/.test(draft)) courts.add("stf");
  if (/\bSTJ\b/.test(draft)) courts.add("stj");
  if (/\bTST\b/.test(draft)) courts.add("tst");
  if (/\bTNU\b/.test(draft)) courts.add("tnu");
  if (/\bTRF\b/.test(draft)) courts.add("trf");
  if (/\bTJ[A-Z]{2}\b/.test(draft)) courts.add("tj");
  if (/\bTRT\b/.test(draft)) courts.add("trt");
  const precedentMatches = new Set(
    (draft.match(/(?:Tema\s+(?:STF|STJ)\s+\d+|REsp\.?\s*[\d.\/]+|RE\s+[\d.\/]+|Súmula\s+(?:n[.°º]?\s*)?\d+|EREsp\.?\s*[\d.\/]+)/gi) ?? [])
      .map(m => m.toLowerCase()),
  );
  const jurCount = courts.size + precedentMatches.size;
  const jurScore =
    jurCount >= 3 ? SCORES.jurisprudentialVariety :
    jurCount >= 2 ? Math.round(SCORES.jurisprudentialVariety * 0.6) :
    jurCount >= 1 ? Math.round(SCORES.jurisprudentialVariety * 0.25) : 0;

  // ── 4. Enfrentamento de objeções (0-15) ───────────────────────────────────
  const objectionScore = OBJECTION_HANDLING_RE.test(draft) ? SCORES.objectionHandling : 0;

  // ── 5. Ausência de expressões genéricas (0-10) ────────────────────────────
  const lower = draft.toLowerCase();
  const isSentenca = tipoPeca === "SENTENCA";
  const fundamentacaoStart = isSentenca
    ? (() => {
        const idx = lower.search(/fundamenta[cç][aã]o|motiva[cç][aã]o|an[aá]lise\s+do\s+m[eé]rito|\bfundamento\b/i);
        return idx >= 0 ? idx : lower.length;
      })()
    : 0;
  const checkText = lower.slice(fundamentacaoStart);

  const banned = BANNED_EXPRESSIONS.filter(expr => {
    if (expr === "reconhecimento do direito" && isSentenca) return checkText.includes(expr);
    return lower.includes(expr);
  });
  const genericScore =
    banned.length === 0 ? SCORES.noGenericExpressions :
    banned.length === 1 ? Math.round(SCORES.noGenericExpressions * 0.5) : 0;

  const total = normScore + sectionScore + jurScore + objectionScore + genericScore;

  return {
    total: Math.min(100, total),
    normativeVariety: normScore,
    sectionStructure: sectionScore,
    jurisprudentialVariety: jurScore,
    objectionHandling: objectionScore,
    noGenericExpressions: genericScore,
    bannedExpressionsFound: banned,
  };
}

// ── Contexto para calibração ──────────────────────────────────────────────────

export interface RichnessContext {
  tipo_peca?: string | undefined;
  regime_juridico?: string | null | undefined;
  assunto_principal?: string | undefined;
  pedidos?: string[] | undefined;
}

// ── RichnessValidator ─────────────────────────────────────────────────────────

export class RichnessValidator {
  static readonly MIN_SCORE = 70;

  validate(draft: string, ctx?: RichnessContext): ValidationError[] {
    const score = analyzeArgumentRichness(draft, ctx?.tipo_peca);
    const errors: ValidationError[] = [];

    if (score.total < RichnessValidator.MIN_SCORE) {
      const breakdown = [
        `normas=${score.normativeVariety}/${SCORES.normativeVariety}`,
        `seções=${score.sectionStructure}/${SCORES.sectionStructure}`,
        `jurisprudência=${score.jurisprudentialVariety}/${SCORES.jurisprudentialVariety}`,
        `objeções=${score.objectionHandling}/${SCORES.objectionHandling}`,
        `expressões=${score.noGenericExpressions}/${SCORES.noGenericExpressions}`,
      ].join(" | ");

      errors.push({
        rule: "FINAL_DRAFT_WEAK_ARGUMENTATION",
        message:
          `Score de riqueza argumentativa: ${score.total}/100 (mínimo: ${RichnessValidator.MIN_SCORE}). ` +
          `Detalhamento: ${breakdown}. ` +
          (score.bannedExpressionsFound.length > 0
            ? `Expressões genéricas: ${score.bannedExpressionsFound.map(e => `"${e}"`).join(", ")}.`
            : "Aumentar: variedade normativa, seções, jurisprudência e/ou enfrentamento de objeções."),
        fatal: false,
      });
    }

    if (ctx?.tipo_peca === "PETICAO_INICIAL") {
      errors.push(...this.validatePeticaoInicial(draft, ctx));
    }

    return errors;
  }

  private validatePeticaoInicial(draft: string, ctx: RichnessContext): ValidationError[] {
    const errors: ValidationError[] = [];
    if (this.needsTutelaUrgencia(ctx)) {
      const hasTutela = /tutela\s+de\s+urgência|tutela\s+urgente|tutela\s+antecipada/i.test(draft);
      if (!hasTutela) {
        errors.push({
          rule: "FINAL_DRAFT_WEAK_ARGUMENTATION",
          message:
            "Seção DA TUTELA DE URGÊNCIA ausente — caso alimentar/previdenciário/remuneratório " +
            "exige tutela estruturada (art. 300 CPC/2015)",
          fatal: false,
        });
      }
    }
    return errors;
  }

  private needsTutelaUrgencia(ctx: RichnessContext): boolean {
    if (["RPPS", "RGPS"].includes(ctx.regime_juridico ?? "")) return true;
    const combined = [ctx.assunto_principal ?? "", ...(ctx.pedidos ?? [])].join(" ");
    return TUTELA_KEYWORDS_RE.test(combined);
  }
}

import type { ValidationError } from "../pipeline/types.js";
import { DomainRichnessAnalyzer } from "./domain-richness/domain-richness.analyzer.js";
import type { DomainScoreDetail } from "./domain-richness/domain-richness.types.js";

// ── Re-exports para compatibilidade ──────────────────────────────────────────

export type { DomainScoreDetail as RichnessScoreDetail };

// ── RichnessContext ───────────────────────────────────────────────────────────

export interface RichnessContext {
  tipo_peca?: string | undefined;
  regime_juridico?: string | null | undefined;
  assunto_principal?: string | undefined;
  pedidos?: string[] | undefined;
  /** FASE 4.6 — perfil de domínio explícito (ex.: "EXECUCAO_CUMPRIMENTO", "RPPS"). */
  area?: string | undefined;
}

// ── analyzeArgumentRichness — delegação ao DomainRichnessAnalyzer ─────────────

const _analyzer = new DomainRichnessAnalyzer();

export function analyzeArgumentRichness(
  draft: string,
  tipoPeca?: string,
  ctx?: Pick<RichnessContext, "area" | "regime_juridico" | "assunto_principal">,
): DomainScoreDetail {
  return _analyzer.analyze(draft, ctx?.area, ctx?.regime_juridico, ctx?.assunto_principal, tipoPeca);
}

// ── Tutela de urgência ────────────────────────────────────────────────────────

const TUTELA_KEYWORDS_RE =
  /previdenci|pensão\s+por\s+morte|benefício|servidor\s+públic|alimentar|saúde|remuneratório|salarial|vencimentos|proventos|aposentadori|paridade|reajuste/i;

// ── RichnessValidator ─────────────────────────────────────────────────────────

export class RichnessValidator {
  static readonly MIN_SCORE = 70;

  private analyzer = new DomainRichnessAnalyzer();

  validate(draft: string, ctx?: RichnessContext): ValidationError[] {
    const score = this.analyzer.analyze(
      draft,
      ctx?.area,
      ctx?.regime_juridico,
      ctx?.assunto_principal,
      ctx?.tipo_peca,
    );
    const errors: ValidationError[] = [];

    if (score.total < RichnessValidator.MIN_SCORE) {
      const breakdown = score.dimensions
        .map((d) => `${d.key}=${d.score}/${d.max}`)
        .join(" | ");

      const profileLabel = score.profile !== "CIVEL_GERAL" ? ` [perfil: ${score.profile}]` : "";

      errors.push({
        rule: "FINAL_DRAFT_WEAK_ARGUMENTATION",
        message:
          `Score de riqueza argumentativa: ${score.total}/100 (mínimo: ${RichnessValidator.MIN_SCORE})${profileLabel}. ` +
          `Detalhamento: ${breakdown}. ` +
          (score.bannedExpressionsFound.length > 0
            ? `Expressões genéricas: ${score.bannedExpressionsFound.map((e) => `"${e}"`).join(", ")}.`
            : "Aumentar: variedade normativa, seções, jurisprudência e/ou dimensões específicas do domínio."),
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

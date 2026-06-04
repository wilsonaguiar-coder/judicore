// StanceContradictionValidator — detecção pós-draft de contradições semânticas.
//
// Complementa o EvidenceStanceValidator (que exige jur citada pelo número)
// detectando casos em que o DRAFT sustenta uma tese e simultaneamente
// contém linguagem que demonstra a improcedência, independentemente de
// qual jurisprudência é citada no corpo do texto.
//
// Regra:
//   STANCE_CONTRADICTION (fatal) dispara quando:
//   1. O draft é uma peça de advocacia (petição ou recurso);
//   2. O draft contém afirmação do pedido principal;
//   3. O draft contém, no mesmo corpo, afirmação legal que barra o pedido;
//   4. Ausência de distinguishing ou tese subsidiária que resolva a contradição.

import type { ValidationError } from "../pipeline/types.js";

// ── Detectores de contexto ───────────────────────────────────────────────────

/** Peça de advocacia — contém linguagem de requerimento pelo autor/recorrente. */
const ADVOCACY_RE =
  /\b(requer(?:-se)?|pleiteia?|postula?|interpõe?\s+(?:o\s+presente\s+)?recurso|o\s+(?:autor|recorrente|reclamante|impetrante)\s+(?:pede|requer|pleiteia|postula)|em\s+face\s+do\s+exposto.{0,60}requer)\b/i;

/** Distinguishing ou afastamento explícito do obstáculo. */
const DISTINGUISHING_RE =
  /\b(distinguishing|caso\s+concreto.{0,40}(?:diferente|distinto)|situação\s+fática\s+distinta|peculiaridade\s+(?:do\s+caso|fática)|hipótese\s+(?:dos\s+autos\s+)?(?:difere|é\s+distinta)|inaplicável\s+(?:ao\s+caso|à\s+hipótese)|não\s+guarda\s+identidade\s+com|fatos?\s+distintos?)\b/i;

/** Tese subsidiária válida — há pedido alternativo. */
const SUBSIDIARY_RE =
  /\b(alternativamente|subsidiariamente|pedido\s+subsidiário|em\s+caso\s+de\s+não\s+(?:provimento|procedência))\b/i;

// ── Padrões de contradição por domínio ───────────────────────────────────────

interface ContradictionSpec {
  rule: string;
  description: string;
  claimRe: RegExp;     // afirmação do pedido principal no draft
  barRe: RegExp;       // afirmação do impedimento legal no mesmo draft
}

const CONTRADICTION_SPECS: ContradictionSpec[] = [
  {
    rule: "STANCE_CONTRADICTION_RPPS",
    description:
      "Peça sustenta paridade/integralidade RPPS mas o próprio texto reconhece que a EC 41/2003 " +
      "veda o direito para ingressantes posteriores — contradição lógica interna (art. 40 CF/88; " +
      "RE 590.260 STF). Use distinguishing para afastar o precedente ou reconheça a improcedência.",
    claimRe:
      /\b(requer.{0,120}paridade|pleiteia?.{0,120}paridade|faz\s+jus\s+(?:à|a)\s+paridade|tem\s+direito\s+(?:à|a)\s+paridade|paridade\s+(?:deve\s+ser\s+)?(?:concedida?|reconhecida?|garantida?)|requer.{0,120}integralidade|faz\s+jus\s+(?:à|a)\s+integralidade)\b/i,
    barRe:
      /\b(não\s+faz\s+jus\s+(?:à|a)\s+(?:paridade|integralidade)|EC\s*41.{0,100}(?:afasta|veda|impede|não\s+garante|não\s+assegura).{0,80}paridade|paridade.{0,100}(?:afastada?|vedada?)\s+pela?\s+EC\s*41|servidor.{0,100}ingressou.{0,100}após.{0,100}EC\s*41.{0,100}sem\s+(?:direito|paridade)|sem\s+paridade\s+pós[-\s]EC\s*41)\b/i,
  },
  {
    rule: "STANCE_CONTRADICTION_RGPS",
    description:
      "Peça requer benefício previdenciário RGPS mas o próprio texto reconhece perda da qualidade " +
      "de segurado ou carência insuficiente — contradição lógica interna (arts. 15/24 Lei 8.213/91). " +
      "O pressuposto de elegibilidade não está preenchido.",
    claimRe:
      /\b(requer.{0,120}(?:auxílio|benefício|aposentadoria|pensão\s+por\s+morte)|faz\s+jus\s+(?:ao|à)\s+(?:auxílio|benefício|aposentadoria)|pleiteia?.{0,120}(?:auxílio|benefício|aposentadoria))\b/i,
    barRe:
      /\b(perdeu?\s+(?:a\s+)?qualidade\s+de\s+segurado|sem\s+qualidade\s+de\s+segurado|não\s+mantinha\s+qualidade\s+de\s+segurado|carência\s+insuficiente|não\s+cumpri[ou]\s+(?:a\s+)?carência|período\s+de\s+carência\s+(?:não\s+)?(?:implementado|cumprido|atingido))\b/i,
  },
  {
    rule: "STANCE_CONTRADICTION_JEF",
    description:
      "Peça sustenta procedência no Juizado Especial mas o próprio texto reconhece que o valor " +
      "da causa excede o limite de competência sem renúncia ao excedente, ou que a matéria é " +
      "excluída — contradição com os pressupostos de admissibilidade (art. 3º Lei 9.099/95).",
    claimRe:
      /\b(requer.{0,120}(?:procedência|deferimento|concessão)|pleiteia?.{0,120}(?:procedência|deferimento)|juizado\s+especial.{0,200}requer)\b/i,
    barRe:
      /\b(valor.{0,80}(?:acima\s+de\s+(?:40|60)\s+salários?|excede.{0,40}(?:limite|teto)|superior\s+ao?\s+limite).{0,80}(?:juizado|JEF|JEC)|sem\s+renúncia\s+(?:expressa\s+)?ao\s+(?:valor\s+)?excedente.{0,80}juizado|matéria\s+excluída?.{0,80}(?:juizado|JEF)|incompetência.{0,80}(?:juizado|JEF))\b/i,
  },
];

// ── StanceContradictionValidator ──────────────────────────────────────────────

export class StanceContradictionValidator {
  /**
   * Verifica contradições semânticas no DRAFT gerado.
   *
   * Disparado apenas para peças de advocacia (PETICAO_INICIAL e RECURSO).
   * Para SENTENCA/DECISAO/DESPACHO, a linguagem de rejeição é esperada
   * e não constitui contradição.
   */
  validate(draft: string): ValidationError[] {
    // Só faz sentido para peças de advocacia
    if (!ADVOCACY_RE.test(draft)) return [];

    // Distinguishing ou tese subsidiária resolve a contradição
    if (DISTINGUISHING_RE.test(draft) || SUBSIDIARY_RE.test(draft)) return [];

    const errors: ValidationError[] = [];

    for (const spec of CONTRADICTION_SPECS) {
      if (spec.claimRe.test(draft) && spec.barRe.test(draft)) {
        errors.push({
          rule: spec.rule,
          message: spec.description,
          fatal: true,
        });
      }
    }

    return errors;
  }
}

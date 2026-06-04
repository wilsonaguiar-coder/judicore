// StanceContradictionValidator — detecção pós-draft de contradições semânticas.
//
// FASE 4.4.2 — padrões RPPS/RGPS reforçados; verificação por-especificação
// com janela de contexto (não mais bail-out global de distinguishing).
//
// Problema anterior: DISTINGUISHING_RE global permitia que palavras como
// "embora" e "não obstante" (presentes em qualquer parte do draft) bypassassem
// TODAS as verificações, gerando falsos negativos sistêmicos.
//
// Solução: cada spec verifica distinguishing em janela (±400 chars) ao redor
// do trecho que dispara o barRe, com padrão narrow que exige substância real.

import type { ValidationError } from "../pipeline/types.js";

// ── Detectores de contexto ───────────────────────────────────────────────────

/** Peça de advocacia — contém linguagem de requerimento pelo autor/recorrente. */
const ADVOCACY_RE =
  /\b(requer(?:-se)?|pleiteia?|postula?|pede(?:-se)?|pugna(?:-se)?|propõe?\s+(?:a\s+presente\s+)?ação|interpõe?\s+(?:o\s+presente\s+)?recurso|o\s+(?:autor|recorrente|reclamante|impetrante|requerente)\s+(?:pede|requer|pleiteia|postula|pugna)|em\s+face\s+do\s+exposto.{0,60}requer|diante\s+do\s+exposto.{0,60}requer|dos\s+fundamentos\s+expostos.{0,60}requer)\b/i;

/**
 * Distinguishing VÁLIDO — exige substância real (diferença fática explicada),
 * NÃO apenas palavras de transição como "embora", "não obstante", "em que pese".
 * Verificado em janela de ±400 chars ao redor do impedimento.
 */
const VALID_DISTINGUISHING_RE =
  /\b(distinguishing|o\s+(?:presente\s+)?caso\s+(?:em\s+tela\s+)?(?:difere\s+do\s+precedente|apresenta\s+peculiaridade\s+que\s+o\s+distingue|é\s+distinto\s+do\s+paradigma)|hipótese\s+dos\s+autos\s+(?:difere|é\s+distinta)\s+(?:do\s+precedente|do\s+caso\s+paradigma)|situação\s+fática\s+(?:é\s+)?distinta\s+(?:do\s+precedente|do\s+caso)|peculiaridade\s+(?:fática|concreta)\s*[:—]\s*|inaplicabilidade\s+do\s+precedente\s+(?:ao\s+caso\s+concreto|pela\s+diferença\s+fática)|o\s+presente\s+(?:caso|processo)\s+(?:possui|apresenta|tem)\s+(?:peculiaridade|característica)\s+(?:fática\s+)?distinta\s+que)\b/i;

/** Tese subsidiária válida — há pedido alternativo. */
const SUBSIDIARY_RE =
  /\b(alternativamente|subsidiariamente|pedido\s+subsidiário|tese\s+subsidiária|em\s+caso\s+de\s+(?:não\s+)?(?:provimento|procedência)|ou,\s+caso\s+(?:assim|não)\s+(?:entenda|seja))\b/i;

// ── Padrões de contradição por domínio ───────────────────────────────────────

interface ContradictionSpec {
  rule: string;
  description: string;
  claimRe: RegExp;   // afirmação do pedido principal no draft
  barRe: RegExp;     // afirmação do impedimento legal no mesmo draft
}

const CONTRADICTION_SPECS: ContradictionSpec[] = [

  // ── RPPS — paridade/integralidade pós-EC 41/2003 (REFORÇADO 4.4.2) ───────────
  {
    rule: "STANCE_CONTRADICTION_RPPS",
    description:
      "Peça sustenta paridade/integralidade RPPS mas o próprio texto reconhece que a EC 41/2003 " +
      "veda o direito para ingressantes posteriores — contradição lógica interna (art. 40 CF/88; " +
      "RE 590.260 STF). Use distinguishing para afastar o precedente ou reconheça a improcedência.",
    // Claim: basta mencionar paridade/integralidade em qualquer parte da peça
    claimRe: /\b(paridade|integralidade\s+(?:dos\s+)?proventos?)\b/i,
    // Bar: reconhece EC 41/2003 como impedimento de paridade/integralidade
    barRe: new RegExp(
      // 1: EC 41 + verbo de vedação + paridade/integralidade
      // [\s\S]{0,200} em vez de .{0,200} para cruzar quebras de linha
      "(?:EC\\s*41|emenda\\s+constitucional\\s+41)[\\s\\S]{0,200}(?:não\\s+faz\\s+jus|afasta|veda|impede|suprime|elimina|não\\s+(?:tem|possui|assegura|garante)\\s+direito|não\\s+é\\s+(?:devida?|garantida?|assegurada?))[\\s\\S]{0,120}(?:paridade|integralidade)" +
      "|" +
      // 2: sem paridade / sem integralidade pós-EC 41
      "sem\\s+(?:paridade|integralidade)\\s+pós[-\\s]EC\\s*41" +
      "|" +
      // 3: não faz jus à paridade/integralidade (standalone)
      "não\\s+faz\\s+jus\\s+(?:à|a)\\s+(?:paridade|integralidade)" +
      "|" +
      // 3b: não há direito à paridade/integralidade (CASO 1 — formulação vernacular)
      "não\\s+h[aá]\\s+direito\\s+(?:à|a)\\s+(?:paridade|integralidade)" +
      "|" +
      // 3c: inexistência de direito à paridade
      "inexist[eê]ncia\\s+(?:do|de)\\s+direito\\s+(?:à|a)\\s+(?:paridade|integralidade)" +
      "|" +
      // 4: paridade/integralidade afastada/vedada EC 41 ([\s\S] para cruzar linhas)
      "(?:paridade|integralidade)[\\s\\S]{0,120}(?:afastada?|vedada?|suprimida?|extinta?|não\\s+(?:é\\s+)?(?:devida?|garantida?|assegurada?))[\\s\\S]{0,80}(?:EC\\s*41|emenda\\s+constitucional\\s+41)" +
      "|" +
      "(?:EC\\s*41|emenda\\s+constitucional\\s+41)[\\s\\S]{0,80}(?:paridade|integralidade)[\\s\\S]{0,80}(?:afastada?|vedada?|suprimida?)" +
      "|" +
      // 5: ingresso após EC 41 / 31/12/2003 + sem paridade ([\s\S] para cruzar linhas)
      "ingressou?[\\s\\S]{0,150}(?:após|posterior|depois\\s+d[ae])[\\s\\S]{0,80}(?:EC\\s*41|31\\/12\\/2003|dezembro\\s+de\\s+2003)[\\s\\S]{0,200}(?:paridade|integralidade)[\\s\\S]{0,80}(?:afastada?|vedada?|não\\s+devida?|não\\s+(?:se\\s+)?aplica)" +
      "|" +
      // 6: o texto literal do JUR_CONTRARIO_PARIDADE tese
      "sem\\s+paridade\\s+pós[-\\s]EC\\s*41" +
      "|" +
      // 7: ingresso posterior à EC 41 como fato impeditivo
      "ingresso[\\s\\S]{0,80}(?:após|posterior|depois)[\\s\\S]{0,80}(?:EC\\s*41|vigência\\s+da\\s+emenda)[\\s\\S]{0,80}(?:não\\s+(?:faz\\s+jus|tem\\s+direito|h[aá]\\s+direito)|paridade[\\s\\S]{0,40}(?:afastada?|vedada?|não\\s+cabível))" +
      "|" +
      // 8: afasta a paridade/integralidade (verbo — EC 41, STF ou doutrina como sujeito)
      "(?:EC\\s*41|emenda\\s+constitucional\\s+41|STF|Supremo\\s+Tribunal\\s+Federal|jurisprud[êe]ncia|doutrina|orienta[cç][aã]o)[\\s\\S]{0,150}afasta\\s+a?\\s*(?:paridade|integralidade)" +
      "|" +
      "afasta\\s+a?\\s*(?:paridade|integralidade)\\s+(?:para\\s+servidores?|dos\\s+servidores?|para\\s+os\\s+dependentes?)" +
      "|" +
      // 9: STF firmou / tem entendimento contrário/oposto
      "(?:STF|Supremo\\s+Tribunal\\s+Federal)[\\s\\S]{0,200}(?:firmou|tem|possui|firmando|consolidou)\\s+entendimento\\s+(?:em\\s+sentido\\s+)?(?:contrário|oposto)" +
      "|" +
      "entendimento\\s+(?:consolidado|firmado|pac[íi]fico|dominante)[\\s\\S]{0,80}(?:em\\s+sentido\\s+(?:contrário|oposto)|contrário\\s+(?:à|a)\\s+pretens[ãa]o|oposto\\s+(?:à|a)\\s+pretens[ãa]o)" +
      "|" +
      // 10: não obstante o entendimento do STF / não obstante a EC 41/2003
      "não\\s+obstante[\\s\\S]{0,80}entendimento[\\s\\S]{0,80}(?:STF|Supremo)" +
      "|" +
      "não\\s+obstante\\s+a\\s+EC\\s*41" +
      "|" +
      // 11: precedente contrário / pretensão incompatível / paridade afastada pela EC 41
      "precedente\\s+contrário\\s+(?:à|a)\\s+pretens[ãa]o" +
      "|" +
      "pretens[ãa]o\\s+incompatível\\s+com\\s+a?\\s*EC\\s*41" +
      "|" +
      "(?:paridade|integralidade)\\s+afastada\\s+pela\\s+EC\\s*41" +
      "|" +
      // 12: sentido oposto à pretensão (sem mencionar STF explicitamente)
      "entendimento\\s+(?:em\\s+sentido\\s+)?oposto\\s+(?:à|a)\\s+pretens[ãa]o" +
      "|" +
      "firmado\\s+entendimento\\s+(?:em\\s+sentido\\s+)?(?:contrário|oposto)",
      "i",
    ),
  },

  // ── RGPS — benefício com perda de qualidade / carência (REFORÇADO 4.4.2) ─────
  {
    rule: "STANCE_CONTRADICTION_RGPS",
    description:
      "Peça requer benefício previdenciário RGPS mas o próprio texto reconhece perda da qualidade " +
      "de segurado, carência insuficiente ou ausência de recolhimentos — contradição lógica interna " +
      "(arts. 15/24 Lei 8.213/91). O pressuposto de elegibilidade não está preenchido.",
    // Claim: qualquer pedido de benefício RGPS
    claimRe:
      /\b(requer(?:-se)?|pleiteia?|postula?|pede(?:-se)?|pugna|tem\s+direito\s+ao?|faz\s+jus\s+ao?).{0,200}(auxílio|aposentadoria|benefício|pensão\s+por\s+morte|salário[-\s]maternidade)|\b(auxílio|aposentadoria|benefício|pensão\s+por\s+morte|salário[-\s]maternidade).{0,200}(requer(?:-se)?|pleiteia?|deve\s+ser\s+(?:concedid[oa]|deferido))/i,
    // Bar: reconhece inelegibilidade no mesmo draft
    barRe: new RegExp(
      // 1: perda da qualidade de segurado
      "perdeu?\\s+(?:a\\s+)?qualidade\\s+de\\s+segurado" +
      "|" +
      "sem\\s+qualidade\\s+de\\s+segurado" +
      "|" +
      "não\\s+(?:mantinha|manteve|possui|possuía)\\s+(?:a\\s+)?qualidade\\s+de\\s+segurado" +
      "|" +
      "qualidade\\s+de\\s+segurado.{0,80}(?:perdida?|não\\s+mantida?|expirada?|cessada?)" +
      "|" +
      // 2: período de graça encerrado
      "período\\s+de\\s+graça.{0,100}(?:expirou|encerrou|findou|venceu|esgotou|(?:já\\s+)?(?:está|estava|tinha)\\s+(?:expirado|encerrado|vencido|esgotado|findo))" +
      "|" +
      "(?:expirou|encerrou|findou|venceu|esgotou).{0,80}período\\s+de\\s+graça" +
      "|" +
      "período\\s+de\\s+graça\\s+de\\s+(?:12|doze|24|vinte\\s+e\\s+quatro)\\s+meses.{0,80}(?:expirou|encerrou|findou)" +
      "|" +
      // 3: ausência de recolhimentos / última contribuição distante
      "última\\s+contribuição.{0,150}(?:há\\s+(?:mais\\s+de\\s+)?\\d+\\s+meses|em\\s+\\d{4}|há\\s+mais\\s+de\\s+(?:\\d+|dois|três|quatro|cinco)\\s+anos)" +
      "|" +
      "sem\\s+(?:recolhimento|contribuição)\\s+(?:há|por)\\s+(?:mais\\s+de\\s+)?\\d+\\s+(?:meses|anos)" +
      "|" +
      "ausência\\s+de\\s+recolhimentos?.{0,100}(?:por|há)\\s+(?:mais\\s+de\\s+)?\\d+\\s+(?:meses|anos)" +
      "|" +
      "há\\s+(?:mais\\s+de\\s+)?\\d+\\s+(?:meses|anos)\\s+sem\\s+(?:recolhimento|contribuição|vínculo)" +
      "|" +
      "não\\s+(?:recolhia|contribuía|efetuou\\s+contribuições?)\\s+(?:há|por)\\s+(?:mais\\s+de\\s+)?\\d+\\s+(?:meses|anos)" +
      "|" +
      // 4: carência insuficiente
      "carência\\s+(?:insuficiente|não\\s+(?:cumprida|implementada|atingida|completada))" +
      "|" +
      "não\\s+cumpri[ou]\\s+(?:a\\s+)?(?:carência|período\\s+de\\s+carência)" +
      "|" +
      "período\\s+de\\s+carência.{0,80}(?:não\\s+)?(?:implementado|cumprido|completado|atingido)" +
      "|" +
      "faltam.{0,80}(?:contribuições?|meses)\\s+(?:para\\s+(?:a\\s+)?carência|para\\s+completar)" +
      "|" +
      "carência\\s+de\\s+(?:180|cento\\s+e\\s+oitenta)\\s+(?:meses|contribuições?).{0,80}(?:não\\s+(?:atingida|cumprida))" +
      "|" +
      "(?:180|cento\\s+e\\s+oitenta)\\s+contribuições?.{0,80}(?:não\\s+atingiu?|insuficiente|faltam)",
      "i",
    ),
  },

  // ── JEF — valor acima da competência / matéria excluída ──────────────────────
  {
    rule: "STANCE_CONTRADICTION_JEF",
    description:
      "Peça sustenta procedência no Juizado Especial mas o próprio texto reconhece que o valor " +
      "da causa excede o limite de competência sem renúncia ao excedente, ou que a matéria é " +
      "excluída — contradição com os pressupostos de admissibilidade (art. 3º Lei 9.099/95).",
    claimRe:
      /\b(requer(?:-se)?|pleiteia?|postula?).{0,200}(?:procedência|deferimento|concessão)|\b(?:procedência|deferimento|concessão).{0,200}(?:juizado\s+especial|JEF|JEC)/i,
    barRe:
      /\b(valor.{0,80}(?:acima\s+de\s+(?:40|60)\s+salários?|excede.{0,40}(?:limite|teto)|superior\s+ao?\s+limite).{0,80}(?:juizado|JEF|JEC)|sem\s+renúncia\s+(?:expressa\s+)?ao\s+(?:valor\s+)?excedente.{0,80}juizado|matéria\s+excluída?.{0,80}(?:juizado|JEF)|incompetência.{0,80}(?:juizado|JEF)|acima\s+de\s+(?:40|60)\s+salários?\s+mínimos?\s+sem\s+renúncia)\b/i,
  },
];

// ── StanceContradictionValidator ──────────────────────────────────────────────

export class StanceContradictionValidator {
  /**
   * Verifica contradições semânticas no DRAFT gerado.
   *
   * FASE 4.4.2: verificação por-especificação com janela de contexto.
   * Distinguishing é verificado EM JANELA ao redor do impedimento detectado,
   * não mais com bail-out global (que causava falsos negativos sistêmicos).
   */
  validate(draft: string): ValidationError[] {
    // Só faz sentido para peças de advocacia
    if (!ADVOCACY_RE.test(draft)) return [];

    // Tese subsidiária resolve globalmente (pedido subsidiário é exceção legítima)
    if (SUBSIDIARY_RE.test(draft)) return [];

    const errors: ValidationError[] = [];

    for (const spec of CONTRADICTION_SPECS) {
      // 1. Verificar se o draft contém a afirmação do pedido (claim)
      if (!spec.claimRe.test(draft)) continue;

      // 2. Verificar se o draft contém o impedimento legal (bar)
      const barMatch = spec.barRe.exec(draft);
      if (!barMatch) continue;

      // 3. Verificar distinguishing VÁLIDO em janela de ±400 chars ao redor do impedimento.
      //    "embora", "não obstante", "em que pese" NÃO contam — exige substância real.
      const windowStart = Math.max(0, barMatch.index - 400);
      const windowEnd = Math.min(draft.length, barMatch.index + barMatch[0].length + 400);
      const window = draft.slice(windowStart, windowEnd);

      if (VALID_DISTINGUISHING_RE.test(window)) continue;

      // 4. Contradição confirmada → emitir erro fatal
      errors.push({
        rule: spec.rule,
        message:
          spec.description +
          ` | Trecho impeditivo: "${barMatch[0].slice(0, 120).trim()}"`,
        fatal: true,
      });
    }

    return errors;
  }
}

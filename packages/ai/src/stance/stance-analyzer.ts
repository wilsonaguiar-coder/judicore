// StanceAnalyzer — análise determinística de coerência posicional PRÉ-OpenAI.
//
// Detecta contradições entre a tese pretendida e as autoridades jurídicas
// disponíveis usando exclusivamente pattern-matching (sem chamada ao modelo).
//
// Fluxo no pipeline: Extração → STANCE CHECK → Análise de Evidências → Matriz → Geração
//
// Se blockGeneration = true → pipeline aborta antes de qualquer chamada GPT.

import {
  StanceResult,
  type StanceInput,
  type StanceAnalysis,
  type ContradictionPattern,
} from "./stance-types.js";

// ── Padrões de distinguishing / afastamento ───────────────────────────────────

const DISTINGUISHING_RE =
  /\b(distinguishing|caso\s+concreto\s+(?:é\s+)?(?:diferente|distinto)|situação\s+fática\s+distinta|peculiaridade\s+(?:do\s+caso|fática)|hipótese\s+(?:dos\s+autos\s+)?(?:difere|é\s+distinta)|inaplicável\s+(?:ao\s+caso|à\s+hipótese)|fundamento\s+(?:jurídico\s+)?diverso|não\s+guarda\s+identidade\s+com|ausente\s+(?:a\s+)?identidade|situação\s+peculiar|fatos\s+distintos\s+dos|caso\s+(?:em\s+tela|concreto)\s+(?:difere|apresenta)\s+(?:peculiaridade|característica)\s+distinta)\b/i;

// ── Padrões de tese subsidiária ───────────────────────────────────────────────

const SUBSIDIARY_RE =
  /\b(alternativamente|subsidiariamente|pedido\s+subsidiário|tese\s+subsidiária|em\s+caso\s+de\s+(?:não\s+)?(?:provimento|procedência)|ou,\s+caso\s+(?:assim|não)\s+(?:entenda|seja)|subsidiariamente\s+(?:requer|pede|pugna))\b/i;

// ── Padrões de autoridade favorável ──────────────────────────────────────────

const FAVORABLE_RE =
  /\b(faz\s+jus|tem\s+direito|deve\s+ser\s+(?:concedid[oa]|deferido|reconhecid[oa])|direito\s+reconhecido|procedência\s+(?:é\s+)?cabível|procedente|deve\s+ser\s+provido|procedência\s+do\s+pedido)\b/i;

// ── Catálogo de padrões de contradição por domínio ───────────────────────────

const CONTRADICTION_PATTERNS: ContradictionPattern[] = [
  // RPPS — paridade vedada pós-EC 41/2003
  {
    name: "RPPS_PARIDADE_EC41",
    description: "Paridade/integralidade RPPS — EC 41/2003 afasta o direito para ingressantes posteriores",
    claimRe: /\b(paridade|integralidade)\b.*\b(RPPS|servidor|pensão|proventos)\b|\b(RPPS|servidor|pensão|proventos)\b.*\b(paridade|integralidade)\b/i,
    contraryRe: /\b(EC\s*41|emenda\s+constitucional\s+41)\b.{0,120}\b(não\s+faz\s+jus|afasta|veda|impede|não\s+tem\s+direito)\b.{0,80}\b(paridade|integralidade)\b|\b(sem\s+paridade|sem\s+integralidade)\b.{0,80}\b(EC\s*41|2003)\b|\bservidor.{0,60}ingressou.{0,60}após.{0,60}EC\s*41.{0,80}(não\s+faz\s+jus|sem\s+direito)\b/i,
    reason: "Jurisprudência do STF (RE 590.260) afasta paridade/integralidade para servidores ingressos após EC 41/2003",
  },
  // RPPS — integralidade vedada (variante isolada)
  {
    name: "RPPS_INTEGRALIDADE_EC41",
    description: "Integralidade RPPS — EC 41/2003 afasta integralidade para ingressantes posteriores",
    claimRe: /\bintegralidade\b/i,
    contraryRe: /EC\s*41.{0,80}(não\s+faz\s+jus|afasta|veda).{0,60}integralidade|sem\s+integralidade.{0,80}EC\s*41|ingressou.{0,60}após.{0,60}EC\s*41.{0,80}sem\s+direito/i,
    reason: "Integralidade afastada pela EC 41/2003 para servidores ingressos após sua vigência",
  },
  // RGPS — perda da qualidade de segurado
  {
    name: "RGPS_PERDA_QUALIDADE_SEGURADO",
    description: "RGPS — segurado perdeu a qualidade de segurado antes do sinistro",
    claimRe: /\b(auxílio|aposentadoria|benefício\s+previdenciário|pensão\s+por\s+morte|RGPS)\b/i,
    contraryRe: /\b(perdeu?\s+(?:a\s+)?qualidade\s+de\s+segurado|sem\s+qualidade\s+de\s+segurado|não\s+mantinha\s+qualidade\s+de\s+segurado|carência\s+(?:do\s+)?período\s+de\s+graça\s+esgotada?|período\s+de\s+graça\s+expirado?)\b/i,
    reason: "Segurado perdeu a qualidade de segurado antes do sinistro — requisito de elegibilidade não preenchido",
  },
  // RGPS — carência insuficiente
  {
    name: "RGPS_CARENCIA_INSUFICIENTE",
    description: "RGPS — período de carência não cumprido para o benefício pretendido",
    claimRe: /\b(auxílio|aposentadoria|salário-maternidade|benefício)\b/i,
    contraryRe: /\b(carência\s+insuficiente|não\s+cumpri[ou]\s+(?:a\s+)?carência|carência\s+(?:não\s+(?:cumprida|implementada|atingida))|período\s+de\s+carência\s+(?:não\s+)?(?:implementado|cumprido|completado))\b/i,
    reason: "Carência insuficiente — segurado não implementou o período mínimo de contribuições exigido",
  },
  // JEF — valor acima do limite de competência
  {
    name: "JEF_VALOR_EXCEDE_COMPETENCIA",
    description: "JEF — valor da causa supera o limite de 40/60 SM sem renúncia ao excedente",
    claimRe: /\b(juizado\s+especial|JEF|JEC|rito\s+sumar[íi]ssimo)\b/i,
    contraryRe: /\b(acima\s+de\s+(?:40|60)\s+salários?\s+mínimos?|excede\s+(?:o\s+)?(?:limite|teto)\s+(?:de\s+competência\s+)?do\s+juizado|valor\s+excede\s+(?:a\s+)?competência|superior\s+ao?\s+limite\s+do\s+juizado|sem\s+renúncia\s+ao\s+excedente)\b/i,
    reason: "Valor da causa excede o limite de competência do Juizado Especial sem renúncia expressa ao excedente",
  },
  // JEF — matéria excluída da competência
  {
    name: "JEF_MATERIA_EXCLUIDA",
    description: "JEF — matéria excluída da competência por art. 3º §2º Lei 9.099/95",
    claimRe: /\b(juizado\s+especial|JEF|JEC)\b/i,
    contraryRe: /\b(excluído?\s+(?:da\s+)?competência\s+do\s+juizado|incompetência\s+do\s+juizado|matéria\s+excluída?\s+(?:do|da\s+competência\s+do)\s+juizado|art\.\s*3[oº]\s+§\s*2[oº]|imóvel\s+(?:rústico|urbano).{0,60}juizado|não\s+(?:é|está)\s+(?:no\s+)?rol\s+das\s+(?:causas|matérias)\s+(?:do|aceitas?\s+pelo)\s+juizado)\b/i,
    reason: "Matéria excluída da competência dos Juizados Especiais por art. 3º §2º Lei 9.099/95",
  },
];

// ── StanceAnalyzer ────────────────────────────────────────────────────────────

export class StanceAnalyzer {
  /**
   * Analisa a coerência entre a tese pretendida e as autoridades jurídicas
   * disponíveis, sem fazer chamadas ao modelo de linguagem.
   */
  analyze(input: StanceInput): StanceAnalysis {
    const allAuthorities = [
      ...input.jurisprudence,
      ...input.legislation,
    ];

    const contraryAuthorities: string[] = [];
    const blockingIssues: string[] = [];
    const detectedContradictions: string[] = [];

    // Verificar cada padrão de contradição
    for (const pattern of CONTRADICTION_PATTERNS) {
      if (!pattern.claimRe.test(input.claim)) continue;

      const contraryMatches = allAuthorities.filter((t) => pattern.contraryRe.test(t));
      if (contraryMatches.length > 0) {
        detectedContradictions.push(pattern.reason);
        // Registrar trecho da autoridade contrária (max 200 chars)
        for (const m of contraryMatches.slice(0, 2)) {
          contraryAuthorities.push(m.slice(0, 200));
        }
      }
    }

    // Autoridades favoráveis
    const supportingAuthorities = allAuthorities
      .filter((t) => FAVORABLE_RE.test(t))
      .slice(0, 3)
      .map((t) => t.slice(0, 200));

    // Distinguishing no claim ou nas evidências
    const distinguishingFound =
      DISTINGUISHING_RE.test(input.claim) ||
      input.evidence.some((e) => DISTINGUISHING_RE.test(e)) ||
      input.jurisprudence.some((j) => DISTINGUISHING_RE.test(j));

    // Tese subsidiária
    const subsidiaryThesisFound = SUBSIDIARY_RE.test(input.claim);

    // Classificar resultado
    let result: StanceResult;
    let confidence: number;

    if (detectedContradictions.length === 0) {
      if (supportingAuthorities.length > 0) {
        result = StanceResult.SUPPORTED;
        confidence = 0.65;
      } else {
        result = StanceResult.UNKNOWN;
        confidence = 0.30;
      }
    } else if (supportingAuthorities.length > 0 && detectedContradictions.length === 1) {
      result = StanceResult.MIXED;
      confidence = 0.60;
    } else {
      result = StanceResult.CONTRADICTED;
      confidence = detectedContradictions.length > 1 ? 0.90 : 0.78;
    }

    const blockGeneration =
      result === StanceResult.CONTRADICTED &&
      !distinguishingFound &&
      !subsidiaryThesisFound;

    if (blockGeneration) {
      blockingIssues.push(...detectedContradictions);
    }

    const reasons =
      detectedContradictions.length > 0
        ? detectedContradictions
        : supportingAuthorities.length > 0
          ? ["Autoridade jurídica favorável encontrada — geração permitida"]
          : ["Análise inconclusiva — elementos insuficientes para classificar a tese"];

    return {
      result,
      confidence,
      reasons,
      blockingIssues,
      supportingAuthorities,
      contraryAuthorities,
      blockGeneration,
      distinguishingFound,
      subsidiaryThesisFound,
    };
  }

  /**
   * Converte jurisprudências do formato do pipeline para strings de análise.
   * Concatena tese + ementa para máxima cobertura dos padrões.
   */
  static toJurisprudenceTexts(
    jurs: Array<{ tese: string; ementa: string }>,
  ): string[] {
    return jurs.map((j) => `${j.tese} ${j.ementa}`.trim());
  }
}

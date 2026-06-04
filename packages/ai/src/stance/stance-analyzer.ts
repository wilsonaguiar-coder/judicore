// StanceAnalyzer — análise determinística de coerência posicional PRÉ-OpenAI.
//
// FASE 4.4.2 — padrões RPPS e RGPS reforçados; diagnóstico detalhado.
//
// Fluxo no pipeline: Extração → STANCE CHECK → Análise de Evidências → Matriz → Geração
// Se blockGeneration = true → pipeline aborta antes de qualquer chamada GPT adicional.

import {
  StanceResult,
  type StanceInput,
  type StanceAnalysis,
  type ContradictionPattern,
} from "./stance-types.js";

// ── Padrões de distinguishing válido (narrow — requer substância, não apenas "embora") ──

const DISTINGUISHING_RE =
  /\b(distinguishing|o\s+(?:presente\s+)?caso\s+(?:em\s+tela\s+)?(?:difere\s+do\s+precedente|apresenta\s+peculiaridade\s+que\s+o\s+distingue|é\s+distinto\s+do\s+paradigma)|hipótese\s+dos\s+autos\s+(?:difere|é\s+distinta)\s+(?:do\s+precedente|do\s+caso\s+paradigma)|situação\s+fática\s+(?:é\s+)?distinta\s+(?:do\s+precedente|do\s+caso)|peculiaridade\s+(?:fática|concreta)\s*[:—]\s*|inaplicabilidade\s+do\s+precedente\s+(?:ao\s+caso\s+concreto|pela\s+diferença\s+fática)|o\s+presente\s+(?:caso|processo)\s+(?:possui|apresenta|tem)\s+(?:peculiaridade|característica)\s+(?:fática\s+)?distinta\s+que)\b/i;

// ── Padrões de tese subsidiária ───────────────────────────────────────────────

const SUBSIDIARY_RE =
  /\b(alternativamente|subsidiariamente|pedido\s+subsidiário|tese\s+subsidiária|em\s+caso\s+de\s+(?:não\s+)?(?:provimento|procedência)|ou,\s+caso\s+(?:assim|não)\s+(?:entenda|seja)|subsidiariamente\s+(?:requer|pede|pugna))\b/i;

// ── Padrões de autoridade favorável ──────────────────────────────────────────

const FAVORABLE_RE =
  /\b(faz\s+jus|tem\s+direito|deve\s+ser\s+(?:concedid[oa]|deferido|reconhecid[oa])|direito\s+reconhecido|procedência\s+(?:é\s+)?cabível|procedente|deve\s+ser\s+provido|procedência\s+do\s+pedido)\b/i;

// ── Catálogo de padrões de contradição por domínio ───────────────────────────

const CONTRADICTION_PATTERNS: ContradictionPattern[] = [

  // ── RPPS — paridade/integralidade pós-EC 41/2003 (REFORÇADO FASE 4.4.2) ──────
  {
    name: "RPPS_PARIDADE_EC41",
    description: "Paridade/integralidade RPPS — EC 41/2003 afasta o direito para ingressantes posteriores",
    // Claim: basta mencionar paridade ou integralidade (o contexto RPPS vem do caso)
    claimRe: /\b(paridade|integralidade)\b/i,
    // Contrary: qualquer afirmação que conecte EC 41/2003 (ou ingresso posterior) à vedação da paridade
    contraryRe: new RegExp(
      // Padrão 1: EC 41 + verbo de vedação + paridade/integralidade
      "EC\\s*41.{0,150}(?:não\\s+faz\\s+jus|afasta|veda|impede|suprime|elimina|não\\s+(?:tem|possui|assegura|garante)\\s+direito).{0,80}(?:paridade|integralidade)" +
      "|" +
      // Padrão 2: sem paridade / sem integralidade + contexto EC 41 / 2003
      "sem\\s+(?:paridade|integralidade)\\s+pós[-\\s]EC\\s*41" +
      "|" +
      "sem\\s+(?:paridade|integralidade).{0,80}(?:EC\\s*41|2003|ingressantes?\\s+posteriores?)" +
      "|" +
      // Padrão 3: ingresso após EC 41 / 31/12/2003 → sem paridade
      "ingressou?.{0,100}(?:após|posterior|depois\\s+d[ae]).{0,60}(?:EC\\s*41|31\\/12\\/2003|dezembro\\s+de\\s+2003).{0,150}(?:sem\\s+(?:direito|paridade)|não\\s+faz\\s+jus|paridade.{0,40}(?:afastada?|vedada?|não\\s+(?:é\\s+)?devida?))" +
      "|" +
      // Padrão 4: ingresso após EC 41 + paridade afastada (sem requerer proximidade com "não faz jus")
      "(?:EC\\s*41|emenda\\s+constitucional\\s+41).{0,80}(?:paridade|integralidade).{0,80}(?:afastada?|vedada?|suprimida?|extinta?|não\\s+(?:é\\s+)?(?:devida?|garantida?|assegurada?))" +
      "|" +
      // Padrão 5: paridade afastada pela EC 41 (inversão de ordem)
      "(?:paridade|integralidade).{0,100}(?:afastada?|vedada?|suprimida?|extinta?).{0,80}(?:EC\\s*41|emenda\\s+constitucional\\s+41)" +
      "|" +
      // Padrão 6: texto literal do JUR_CONTRARIO_PARIDADE
      "não\\s+faz\\s+jus\\s+(?:à|a)\\s+(?:paridade|integralidade)",
      "i",
    ),
    reason: "Paridade/integralidade RPPS vedada pela EC 41/2003 — servidor ingressou após 31/12/2003 (RE 590.260 STF)",
  },

  // ── RGPS — perda da qualidade de segurado (REFORÇADO FASE 4.4.2) ─────────────
  {
    name: "RGPS_PERDA_QUALIDADE_SEGURADO",
    description: "RGPS — segurado perdeu a qualidade de segurado antes do sinistro",
    claimRe: /\b(auxílio|aposentadoria|benefício|pensão\s+por\s+morte|salário-maternidade)\b/i,
    contraryRe: new RegExp(
      // Padrão 1: perdeu a qualidade de segurado
      "perdeu?\\s+(?:a\\s+)?qualidade\\s+de\\s+segurado" +
      "|" +
      "sem\\s+qualidade\\s+de\\s+segurado" +
      "|" +
      "não\\s+(?:mantinha|manteve)\\s+(?:a\\s+)?qualidade\\s+de\\s+segurado" +
      "|" +
      // Padrão 2: período de graça encerrado/expirado/esgotado
      "período\\s+de\\s+graça.{0,80}(?:expirou|encerrou|findou|venceu|esgotou|(?:já\\s+)?(?:está|estava)\\s+(?:expirado|encerrado|vencido|esgotado))" +
      "|" +
      "(?:expirou|encerrou|findou|venceu|esgotou).{0,80}período\\s+de\\s+graça" +
      "|" +
      // Padrão 3: ausência de recolhimentos por período
      "última\\s+contribuição.{0,120}(?:há\\s+(?:mais\\s+de\\s+)?\\d+\\s+meses|em\\s+\\d{4}|já\\s+faz\\s+(?:mais\\s+de\\s+)?\\d+\\s+meses)" +
      "|" +
      "sem\\s+(?:recolhimento|contribuição)\\s+(?:há|por)\\s+(?:mais\\s+de\\s+)?\\d+\\s+(?:meses|anos)" +
      "|" +
      "ausência\\s+de\\s+recolhimentos?\\s+(?:por|há)\\s+(?:mais\\s+de\\s+)?\\d+\\s+(?:meses|anos)" +
      "|" +
      "há\\s+mais\\s+de\\s+\\d+\\s+meses\\s+sem\\s+(?:recolhimento|contribuição)" +
      "|" +
      // Padrão 4: carência insuficiente
      "carência\\s+(?:não\\s+)?(?:insuficiente|não\\s+(?:cumprida|implementada|atingida|completada))" +
      "|" +
      "não\\s+cumpri[ou]\\s+(?:a\\s+)?(?:carência|período\\s+de\\s+carência)" +
      "|" +
      "faltam.{0,60}(?:contribuições?|meses\\s+de\\s+carência)\\s+para" +
      "|" +
      "carência\\s+de\\s+(?:cento\\s+e\\s+oitenta|180)\\s+meses.{0,80}(?:não\\s+(?:atingida|cumprida|implementada))" +
      "|" +
      "(?:180|cento\\s+e\\s+oitenta)\\s+contribuições?.{0,80}(?:não\\s+atingiu?|insuficiente)",
      "i",
    ),
    reason: "Segurado perdeu a qualidade de segurado ou não cumpriu a carência — elegibilidade comprometida",
  },

  // ── RGPS — carência insuficiente (padrão independente) ────────────────────────
  {
    name: "RGPS_CARENCIA_INSUFICIENTE",
    description: "RGPS — período de carência não cumprido",
    claimRe: /\b(auxílio|aposentadoria|salário-maternidade|benefício\s+previdenciário)\b/i,
    contraryRe: /carência\s+(?:insuficiente|não\s+(?:cumprida|implementada|atingida))|não\s+cumpri[ou]\s+(?:a\s+)?carência|período\s+de\s+carência.{0,80}(?:não\s+)?(?:implementado|cumprido|completado)|faltam.{0,40}(?:contribuições?|meses)\s+para\s+a\s+carência/i,
    reason: "Carência insuficiente — segurado não completou o período mínimo de contribuições exigido",
  },

  // ── JEF — valor acima do limite de competência ───────────────────────────────
  {
    name: "JEF_VALOR_EXCEDE_COMPETENCIA",
    description: "JEF — valor da causa supera o limite de 40/60 SM sem renúncia ao excedente",
    claimRe: /\b(juizado\s+especial|JEF|JEC|rito\s+sumar[íi]ssimo)\b/i,
    contraryRe: /\b(acima\s+de\s+(?:40|60)\s+salários?\s+mínimos?|excede\s+(?:o\s+)?(?:limite|teto)\s+(?:de\s+competência\s+)?do\s+juizado|valor\s+excede\s+(?:a\s+)?competência|superior\s+ao?\s+limite\s+do\s+juizado|sem\s+renúncia\s+ao\s+excedente)\b/i,
    reason: "Valor da causa excede o limite de competência do Juizado Especial sem renúncia ao excedente",
  },

  // ── JEF — matéria excluída da competência ────────────────────────────────────
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
   * Analisa a coerência entre a tese pretendida e as autoridades jurídicas.
   * Retorna diagnóstico detalhado: premissa, evidência, razão do bloqueio.
   */
  analyze(input: StanceInput): StanceAnalysis {
    const allAuthorities = [...input.jurisprudence, ...input.legislation];

    const contraryAuthorities: string[] = [];
    const blockingEvidence: string[] = [];
    const blockingIssues: string[] = [];
    const detectedContradictions: string[] = [];
    let blockingPremise: string | null = null;

    for (const pattern of CONTRADICTION_PATTERNS) {
      if (!pattern.claimRe.test(input.claim)) continue;

      for (const text of allAuthorities) {
        const match = pattern.contraryRe.exec(text);
        if (!match) continue;

        // Registrar contradição
        if (!detectedContradictions.includes(pattern.reason)) {
          detectedContradictions.push(pattern.reason);
          if (!blockingPremise) blockingPremise = pattern.name;
        }

        // Extrair trecho exato + contexto (40 chars antes e depois do match)
        const start = Math.max(0, match.index - 40);
        const end = Math.min(text.length, match.index + match[0].length + 40);
        const excerpt = `[${pattern.name}] ...${text.slice(start, end).trim()}...`;
        if (!blockingEvidence.includes(excerpt)) {
          blockingEvidence.push(excerpt);
        }
        contraryAuthorities.push(text.slice(0, 200));
        break; // um match por texto já é suficiente
      }
    }

    // Verificar evidências (fatos do caso) como fonte adicional de contradição RPPS/RGPS
    for (const evText of input.evidence) {
      for (const pattern of CONTRADICTION_PATTERNS) {
        if (!pattern.claimRe.test(input.claim)) continue;
        const match = pattern.contraryRe.exec(evText);
        if (!match) continue;
        if (!detectedContradictions.includes(pattern.reason)) {
          detectedContradictions.push(pattern.reason);
          if (!blockingPremise) blockingPremise = pattern.name;
        }
        const start = Math.max(0, match.index - 40);
        const end = Math.min(evText.length, match.index + match[0].length + 40);
        const excerpt = `[${pattern.name}/fatos] ...${evText.slice(start, end).trim()}...`;
        if (!blockingEvidence.includes(excerpt)) {
          blockingEvidence.push(excerpt);
        }
        break;
      }
    }

    // Autoridades favoráveis
    const supportingAuthorities = allAuthorities
      .filter((t) => FAVORABLE_RE.test(t))
      .slice(0, 3)
      .map((t) => t.slice(0, 200));

    // Distinguishing no claim ou nas evidências (definição narrow)
    const distinguishingFound =
      DISTINGUISHING_RE.test(input.claim) ||
      input.evidence.some((e) => DISTINGUISHING_RE.test(e));

    const subsidiaryThesisFound = SUBSIDIARY_RE.test(input.claim);

    // Classificar resultado
    let result: StanceResult;
    let confidence: number;

    if (detectedContradictions.length === 0) {
      result = supportingAuthorities.length > 0 ? StanceResult.SUPPORTED : StanceResult.UNKNOWN;
      confidence = supportingAuthorities.length > 0 ? 0.65 : 0.30;
    } else if (supportingAuthorities.length > 0 && detectedContradictions.length === 1) {
      result = StanceResult.MIXED;
      confidence = 0.60;
    } else {
      result = StanceResult.CONTRADICTED;
      confidence = detectedContradictions.length > 1 ? 0.92 : 0.80;
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
      blockingPremise: blockGeneration ? blockingPremise : null,
      blockingEvidence: blockGeneration ? blockingEvidence : [],
      supportingAuthorities,
      contraryAuthorities,
      blockGeneration,
      distinguishingFound,
      subsidiaryThesisFound,
    };
  }

  /**
   * Converte jurisprudências do pipeline para strings de análise.
   * Concatena tese + ementa para máxima cobertura dos padrões.
   */
  static toJurisprudenceTexts(
    jurs: Array<{ tese: string; ementa: string }>,
  ): string[] {
    return jurs.map((j) => `${j.tese} ${j.ementa}`.trim());
  }
}

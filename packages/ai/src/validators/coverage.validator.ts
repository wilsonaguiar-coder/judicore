// coverage.validator.ts — FASE 5.6
// Detecta omissão de tema essencial em peças de domínio específico.
//
// Tipo de alerta: MISSING_ESSENTIAL_TOPIC — não fatal, severidade ATENCAO.
// Isolado dos validators existentes; não altera score nem classificação.
//
// Domínios cobertos nesta fase: RGPS, TRIBUTÁRIO, FAMÍLIA, CONSUMIDOR.
// Não cobre: RPPS, Trabalhista, Ambiental, Criminal, Fazenda, Cível Geral.

import type { LegalClassification, ValidationError } from "../pipeline/types.js";

// ── Guards globais ────────────────────────────────────────────────────────────

const MIN_USEFUL_LENGTH = 800; // textos muito curtos → skip

/** Verifica se o draft deve ser ignorado (curto demais ou repleto de placeholders). */
function shouldSkip(draft: string): boolean {
  const useful = draft.replace(/\[[^\]]{3,}\]/g, "").replace(/\s+/g, " ").trim();
  if (useful.length < MIN_USEFUL_LENGTH) return true;

  // Template com muitos placeholders já é tratado por UNFILLED_TEMPLATE_PLACEHOLDERS
  const lines = draft.split(/\n/);
  const placeholderLines = lines.filter((l) => /\[[A-ZÁÀÂÃÉÊÍÓÔÕÚÇa-záàâãéêíóôõúç0-9\s.,;:!?/_-]{3,}\]/i.test(l)).length;
  if (lines.length > 0 && placeholderLines / lines.length > 0.15) return true;

  return false;
}

// ── 1. RGPS — Aposentadoria Especial ─────────────────────────────────────────

const TRIGGER_RGPS_ESPECIAL =
  /aposentadoria\s+especial|tempo\s+especial|atividade\s+especial|agente\s+nocivo|\bPPP\b|\bLTCAT\b|enquadramento\s+especial/i;
const COVERAGE_EXPOSICAO =
  /exposi[cç][aã]o|agente\s+nocivo|insalubridade|periculosidade|ru[ií]do|calor\s+excessivo|qu[ií]mico|biol[oó]gico|nocivo/i;
const COVERAGE_HABITUAL_PERMANENTE =
  /habitual|permanente|n[aã]o\s+ocasional|n[aã]o\s+intermitente/i;
const COVERAGE_PROVA_TECNICA =
  /\bPPP\b|\bLTCAT\b|laudo\s+t[eé]cnico|perfil\s+profissiogr[aá]fico/i;

function validateRgpsEspecial(draft: string): ValidationError | null {
  if (!TRIGGER_RGPS_ESPECIAL.test(draft)) return null;
  const hasExposicao   = COVERAGE_EXPOSICAO.test(draft);
  const hasHabitual    = COVERAGE_HABITUAL_PERMANENTE.test(draft);
  const hasProva       = COVERAGE_PROVA_TECNICA.test(draft);
  // Dispara se faltar pelo menos 2 dos 3 blocos de cobertura
  const missing = [!hasExposicao, !hasHabitual, !hasProva].filter(Boolean).length;
  if (missing < 2) return null;
  return {
    rule: "MISSING_ESSENTIAL_TOPIC",
    message: "A peça trata de aposentadoria especial/tempo especial, mas não enfrenta de forma mínima a exposição habitual e permanente a agente nocivo.",
    fatal: false,
  };
}

// ── 2. TRIBUTÁRIO — Anulação de Débito Fiscal ─────────────────────────────────

const TRIGGER_TRIB_DEBITO =
  /d[eé]bito\s+fiscal|cr[eé]dito\s+tribut[aá]rio|auto\s+de\s+infra[cç][aã]o|\bCDA\b|lan[cç]amento\s+tribut[aá]rio|execu[cç][aã]o\s+fiscal/i;
const COVERAGE_LANCAMENTO =
  /lan[cç]amento|constitui[cç][aã]o\s+d[ao]\s+cr[eé]dito|constitui[cç][aã]o\s+definitiva|notifica[cç][aã]o\s+fiscal|auto\s+de\s+infra[cç][aã]o/i;

function validateTribDebito(draft: string): ValidationError | null {
  if (!TRIGGER_TRIB_DEBITO.test(draft)) return null;
  if (COVERAGE_LANCAMENTO.test(draft)) return null;
  return {
    rule: "MISSING_ESSENTIAL_TOPIC",
    message: "A peça trata de anulação de débito fiscal, mas não enfrenta minimamente o lançamento ou a constituição do crédito tributário.",
    fatal: false,
  };
}

// ── 3. FAMÍLIA — Guarda ───────────────────────────────────────────────────────

const TRIGGER_FAMILY_GUARDA =
  /\bguarda\s+(?:unilateral|compartilhada|provisória|definitiva)\b|disputa\s+de\s+guarda|regulamentar\s+(?:a\s+)?guarda/i;
const COVERAGE_MELHOR_INTERESSE =
  /melhor\s+interesse|interesse\s+(?:superior\s+)?d[ae]\s+(?:crian[cç]a|adolescente)|prote[cç][aã]o\s+integral|prioridade\s+absoluta|bem[-\s]estar\s+(?:d[ae]\s+)?(?:crian[cç]a|menor)|desenvolvimento\s+(?:integral|d[ae]\s+(?:crian[cç]a|menor))/i;
const COVERAGE_CONDICOES_GENITORES =
  // Nota: não inclui "genitor/genitora" isolados — aparecem em qualquer texto de guarda
  // como referência à outra parte, sem discutir condições.
  /\bcapacidade\s+parental\b|cond[ií](?:ç[oõ]es|c[ãa]o)\s+(?:de\s+)?(?:vida|criar|cuidar|moradia)|rotina\s+d[ae]\s+(?:crian[cç]a|menor)|v[ií]nculo\s+afetivo|afeto\s+(?:com\s+)?(?:a\s+)?(?:crian[cç]a|filho|menor)|cuidado\s+(?:com\s+)?(?:o?\s+)?(?:filho|menor|crian[cç]a)|ambiente\s+familiar\s+(?:saud[aá]vel|prop[ií]cio)/i;

function validateFamiliaGuarda(draft: string): ValidationError | null {
  if (!TRIGGER_FAMILY_GUARDA.test(draft)) return null;
  const hasMelhorInteresse = COVERAGE_MELHOR_INTERESSE.test(draft);
  const hasCondicoes       = COVERAGE_CONDICOES_GENITORES.test(draft);
  // Só dispara se AMBOS ausentes (regra conservadora)
  if (hasMelhorInteresse || hasCondicoes) return null;
  return {
    rule: "MISSING_ESSENTIAL_TOPIC",
    message: "A peça trata de guarda, mas não enfrenta minimamente o melhor interesse da criança/adolescente ou as condições concretas dos genitores.",
    fatal: false,
  };
}

// ── 4. CONSUMIDOR — Dano Moral / Restituição ──────────────────────────────────

const TRIGGER_CONSUMIDOR_COBERTURA =
  /cobran[cç]a\s+indevida|restitui[cç][aã]o\s+(?:de\s+)?valores?|repeti[cç][aã]o\s+d[ao]\s+ind[eé]bito|dano\s+moral\s+(?:(?:ao?\s+)?consumidor|consumerista)|vício\s+d[ao]\s+produto|defeito\s+d[ao]\s+servi[cç]o/i;
const COVERAGE_FALHA =
  // Nota: não inclui "cobrança indevida" — está no TRIGGER, gerando auto-satisfação.
  // Cobertura requer EXPLICAÇÃO da falha, não apenas nomeação da pretensão.
  /falha\s+na\s+presta[cç][aã]o|defeito\s+d[ao]\s+servi[cç]o|v[ií]cio\s+d[ao]\s+produto|servi[cç]o\s+defeituoso|produto\s+defeituoso|conduta\s+il[ií]cita|pr[aá]tica\s+abusiva|irregularidade\s+(?:na\s+presta[cç][aã]o|do\s+servi[cç]o)/i;
const COVERAGE_NEXO_DANO =
  /nexo\s+causal|dano(?:\s+moral|\s+material|\s+sofrido)?|preju[ií]zo|abalo\s+moral|transtorno|restitui[cç][aã]o|ind[eé]bito|pagamento\s+indevido/i;

function validateConsumidorPretensao(draft: string): ValidationError | null {
  if (!TRIGGER_CONSUMIDOR_COBERTURA.test(draft)) return null;
  const hasFalha = COVERAGE_FALHA.test(draft);
  const hasNexo  = COVERAGE_NEXO_DANO.test(draft);
  if (hasFalha && hasNexo) return null;
  return {
    rule: "MISSING_ESSENTIAL_TOPIC",
    message: "A peça trata de pretensão consumerista, mas não enfrenta minimamente a falha do serviço/vício do produto ou o nexo causal.",
    fatal: false,
  };
}

// ── API pública ───────────────────────────────────────────────────────────────

export function validateCoverage(
  draft: string,
  classification: LegalClassification,
): ValidationError[] {
  if (shouldSkip(draft)) return [];

  const results: ValidationError[] = [];

  // 1. RGPS — detectado via regime_juridico (confiável mesmo no modo RAPIDA)
  if (classification.regime_juridico === "RGPS") {
    const r = validateRgpsEspecial(draft);
    if (r) results.push(r);
  }

  // 2. TRIBUTÁRIO — detectado via tipo_justica ou assunto ou fallback no draft
  const isTributario =
    classification.tipo_justica === "EXECUCAO_FISCAL" ||
    (classification.regime_juridico as string) === "TRIBUTARIO" ||
    /tribut[aá]rio|CTN\b|d[eé]bito\s+fiscal|lan[cç]amento\s+fiscal|execu[cç][aã]o\s+fiscal/i.test(classification.assunto_principal ?? "") ||
    /CTN\b|lan[cç]amento\s+tribut[aá]rio|d[eé]bito\s+fiscal|execu[cç][aã]o\s+fiscal|\bCDA\b/i.test(draft.slice(0, 3000));
  if (isTributario) {
    const r = validateTribDebito(draft);
    if (r) results.push(r);
  }

  // 3. FAMÍLIA — detectado via assunto
  const isFamilia =
    /alimentos?|guarda|divórcio|uni[aã]o\s+estável|parti[lh]a|famil(?:ia|iar)|interdição|curatela|adoção/i.test(classification.assunto_principal ?? "");
  if (isFamilia) {
    const r = validateFamiliaGuarda(draft);
    if (r) results.push(r);
  }

  // 4. CONSUMIDOR — detectado via assunto ou tipo_justica JEC com CDC no draft
  const isConsumidor =
    /consumidor|CDC\b|fornecedor|produto\s+defeituoso|servi[cç]o\s+defeituoso|cobran[cç]a\s+indevida/i.test(classification.assunto_principal ?? "") ||
    (classification.tipo_justica === "JEC" && /consumidor|CDC\b|fornecedor/i.test(draft.slice(0, 2000)));
  if (isConsumidor) {
    const r = validateConsumidorPretensao(draft);
    if (r) results.push(r);
  }

  return results;
}

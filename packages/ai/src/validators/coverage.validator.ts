// coverage.validator.ts — FASE 5.6 / hardening 5.6.1
//
// Detecta omissão de tema essencial em peças de domínio específico.
// Alerta: MISSING_ESSENTIAL_TOPIC — não fatal, severidade ATENCAO.
//
// Hardenings 5.6.1:
//   - normalizeForCoverage(): funciona com texto sem acento
//   - looksLikeOnlyJurisprudence(): skip em ementas coladas
//   - hasTemplateMarkers(): skip em templates com {{, ____, etc.
//   - Deduplicação por chave domain:topic
//   - details auditável em cada alerta
//
// Domínios: RGPS, TRIBUTÁRIO, FAMÍLIA, CONSUMIDOR.
// Não altera score, classificação, RPPS, Trabalhista ou validators existentes.

import type { LegalClassification, ValidationError } from "../pipeline/types.js";

// ── Interfaces de details ─────────────────────────────────────────────────────

interface CoverageDetails {
  topic: string;
  missing: string[];
  matchedTriggers: string[];
  checkedBlocks: string[];
  skipped: boolean;
}

// ── Helper: normalização leve (remove diacríticos, lowercase) ─────────────────
// Usado apenas internamente — não altera o draft original nem o relatório.

export function normalizeForCoverage(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ── Helper: detecta texto que parece só jurisprudência colada ─────────────────

function looksLikeOnlyJurisprudence(text: string): boolean {
  const lower = text.toLowerCase();
  const JUR_SIGNALS = [
    /\bementa\b/, /\bacordao\b|\bacórdão\b/, /\brelator\b/, /\bturma\b/,
    /julgado\s+em/, /\bdje\b/, /\bstj\b/, /\bstf\b/, /\btrf\b/, /\btst\b/, /\bprecedente\b/,
  ];
  const PIECE_SIGNALS = [
    /dos\s+fatos/, /do\s+direito/, /fundamenta/, /dispositivo/,
    /ante\s+o\s+exposto/, /diante\s+do\s+exposto/, /\brequer\b/,
    /\bjulgo\b/, /\bdefiro\b/, /\bindefiro\b/, /\bcondeno\b/,
  ];
  const jurCount   = JUR_SIGNALS.filter((re) => re.test(lower)).length;
  const pieceCount = PIECE_SIGNALS.filter((re) => re.test(lower)).length;
  return jurCount >= 4 && pieceCount <= 1;
}

// ── Helper: detecta markers de template incompleto ────────────────────────────

function hasTemplateMarkers(text: string): boolean {
  return /\{\{|}}\s*|^\s*_{4,}\s*$|\[PREENCHER\]|\[NOME\s|\[DATA\s|\[CPF\s|\bXXX\b/im.test(text);
}

// ── Guard global ─────────────────────────────────────────────────────────────

const MIN_USEFUL_LENGTH = 800;

function shouldSkip(draft: string): boolean {
  // Texto útil muito curto (remove placeholders e whitespace extra antes de medir)
  const useful = draft.replace(/\[[^\]]{3,}\]/g, "").replace(/\s+/g, " ").trim();
  if (useful.length < MIN_USEFUL_LENGTH) return true;

  // Template com markers explícitos ({{, ____, [PREENCHER], etc.)
  if (hasTemplateMarkers(draft)) return true;

  // Alta proporção de placeholders entre colchetes → já tratado por UNFILLED_TEMPLATE_PLACEHOLDERS
  const lines = draft.split(/\n/);
  const placeholderLines = lines.filter((l) =>
    /\[[A-ZÁÀÂÃÉÊÍÓÔÕÚÇa-záàâãéêíóôõúç0-9\s.,;:!?/_-]{3,}\]/i.test(l),
  ).length;
  if (lines.length > 0 && placeholderLines / lines.length > 0.15) return true;

  // Parece apenas jurisprudência colada (sem estrutura de peça)
  if (looksLikeOnlyJurisprudence(draft)) return true;

  return false;
}

// ── Helper: extrai primeiro match visível de um regex ────────────────────────

function firstMatch(re: RegExp, text: string): string | null {
  const m = re.exec(text);
  return m ? m[0].trim().slice(0, 40) : null;
}

// ── Helper: cria ValidationError com details auditável ───────────────────────

function makeIssue(message: string, details: CoverageDetails): ValidationError {
  return { rule: "MISSING_ESSENTIAL_TOPIC", message, fatal: false, details: details as unknown as Record<string, unknown> };
}

// ── 1. RGPS — Aposentadoria Especial ─────────────────────────────────────────
// Regexes sobre texto NORMALIZADO (sem acentos, lowercase)

const TRIGGER_RGPS_N    = /aposentadoria\s+especial|tempo\s+especial|atividade\s+especial|agente\s+nocivo|\bppp\b|\bltcat\b|enquadramento\s+especial/i;
const COV_EXPOSICAO_N   = /exposicao|agente\s+nocivo|insalubridade|periculosidade|ruido|calor\s+excessivo|quimico|biologico|nocivo/i;
const COV_HABITUAL_N    = /habitual|permanente|nao\s+ocasional|nao\s+intermitente/i;
const COV_PROVA_N       = /\bppp\b|\bltcat\b|laudo\s+tecnico|perfil\s+profissiografico/i;

function validateRgpsEspecial(norm: string): ValidationError | null {
  const triggerMatch = firstMatch(TRIGGER_RGPS_N, norm);
  if (!triggerMatch) return null;

  const hasExposicao = COV_EXPOSICAO_N.test(norm);
  const hasHabitual  = COV_HABITUAL_N.test(norm);
  const hasProva     = COV_PROVA_N.test(norm);

  const missingBlocks: string[] = [];
  if (!hasExposicao) missingBlocks.push("exposicao_agente_nocivo");
  if (!hasHabitual)  missingBlocks.push("habitualidade_permanencia");
  if (!hasProva)     missingBlocks.push("prova_tecnica_ppp_ltcat");

  if (missingBlocks.length < 2) return null;

  return makeIssue(
    "A peça trata de aposentadoria especial/tempo especial, mas não enfrenta de forma mínima a exposição habitual e permanente a agente nocivo.",
    {
      topic: "aposentadoria_especial",
      missing: missingBlocks,
      matchedTriggers: [triggerMatch],
      checkedBlocks: ["exposicao_agente_nocivo", "habitualidade_permanencia", "prova_tecnica_ppp_ltcat"],
      skipped: false,
    },
  );
}

// ── 2. TRIBUTÁRIO — Anulação de Débito Fiscal ─────────────────────────────────

const TRIGGER_TRIB_N   = /debito\s+fiscal|credito\s+tributario|auto\s+de\s+infracao|\bcda\b|lancamento\s+tributario|execucao\s+fiscal/i;
const COV_LANCAMENTO_N = /lancamento|constituicao\s+d[ao]\s+credito|constituicao\s+definitiva|notificacao\s+fiscal|auto\s+de\s+infracao/i;

function validateTribDebito(norm: string): ValidationError | null {
  const triggerMatch = firstMatch(TRIGGER_TRIB_N, norm);
  if (!triggerMatch) return null;
  if (COV_LANCAMENTO_N.test(norm)) return null;

  return makeIssue(
    "A peça trata de anulação de débito fiscal, mas não enfrenta minimamente o lançamento ou a constituição do crédito tributário.",
    {
      topic: "anulacao_debito_fiscal",
      missing: ["lancamento_constituicao_credito"],
      matchedTriggers: [triggerMatch],
      checkedBlocks: ["lancamento_constituicao_credito"],
      skipped: false,
    },
  );
}

// ── 3. FAMÍLIA — Guarda ───────────────────────────────────────────────────────

const TRIGGER_GUARDA_N  = /\bguarda\s+(?:unilateral|compartilhada|provisoria|definitiva)\b|disputa\s+de\s+guarda|regulamentar\s+(?:a\s+)?guarda/i;
const COV_INTERESSE_N   = /melhor\s+interesse|interesse\s+(?:superior\s+)?d[ae]\s+(?:crianca|adolescente)|protecao\s+integral|prioridade\s+absoluta|bem.?estar\s+(?:d[ae]\s+)?(?:crianca|menor)|desenvolvimento\s+(?:integral|d[ae]\s+(?:crianca|menor))/i;
const COV_CONDICOES_N   =
  // Não inclui "genitor/genitora" isolados — aparecem em qualquer texto sem discutir condições
  /capacidade\s+parental|condicoes\s+(?:de\s+)?(?:vida|criar|cuidar|moradia)|rotina\s+d[ae]\s+(?:crianca|menor)|vinculo\s+afetivo|afeto\s+(?:com\s+)?(?:a\s+)?(?:crianca|filho|menor)|cuidado\s+(?:com\s+)?(?:o\s+)?(?:filho|menor|crianca)|ambiente\s+familiar\s+(?:saudavel|propicio)/i;

function validateFamiliaGuarda(norm: string): ValidationError | null {
  const triggerMatch = firstMatch(TRIGGER_GUARDA_N, norm);
  if (!triggerMatch) return null;

  const hasMelhorInteresse = COV_INTERESSE_N.test(norm);
  const hasCondicoes       = COV_CONDICOES_N.test(norm);

  // Só dispara se AMBOS ausentes (regra conservadora)
  if (hasMelhorInteresse || hasCondicoes) return null;

  const missing = ["melhor_interesse_crianca", "condicoes_genitores"];

  return makeIssue(
    "A peça trata de guarda, mas não enfrenta minimamente o melhor interesse da criança/adolescente ou as condições concretas dos genitores.",
    {
      topic: "guarda_crianca",
      missing,
      matchedTriggers: [triggerMatch],
      checkedBlocks: ["melhor_interesse_crianca", "condicoes_genitores"],
      skipped: false,
    },
  );
}

// ── 4. CONSUMIDOR — Dano Moral / Restituição ──────────────────────────────────

const TRIGGER_CONSUMIDOR_N =
  /cobranca\s+indevida|restituicao\s+(?:de\s+)?valores?|repeticao\s+d[ao]\s+indebito|dano\s+moral\s+(?:(?:ao?\s+)?consumidor|consumerista)|vicio\s+d[ao]\s+produto|defeito\s+d[ao]\s+servico/i;
const COV_FALHA_N =
  // Não inclui "cobrança indevida" (está no trigger — auto-satisfação)
  /falha\s+na\s+prestacao|defeito\s+d[ao]\s+servico|vicio\s+d[ao]\s+produto|servico\s+defeituoso|produto\s+defeituoso|conduta\s+ilicita|pratica\s+abusiva|irregularidade\s+(?:na\s+prestacao|do\s+servico)/i;
const COV_NEXO_N =
  /nexo\s+causal|dano(?:\s+moral|\s+material|\s+sofrido)?|prejuizo|abalo\s+moral|transtorno|restituicao|indebito|pagamento\s+indevido/i;

function validateConsumidorPretensao(norm: string): ValidationError | null {
  const triggerMatch = firstMatch(TRIGGER_CONSUMIDOR_N, norm);
  if (!triggerMatch) return null;

  const hasFalha = COV_FALHA_N.test(norm);
  const hasNexo  = COV_NEXO_N.test(norm);

  if (hasFalha && hasNexo) return null;

  const missing: string[] = [];
  if (!hasFalha) missing.push("falha_servico_vicio_produto");
  if (!hasNexo)  missing.push("nexo_causal_dano");

  return makeIssue(
    "A peça trata de pretensão consumerista, mas não enfrenta minimamente a falha do serviço/vício do produto ou o nexo causal.",
    {
      topic: "pretensao_consumerista",
      missing,
      matchedTriggers: [triggerMatch],
      checkedBlocks: ["falha_servico_vicio_produto", "nexo_causal_dano"],
      skipped: false,
    },
  );
}

// ── API pública ───────────────────────────────────────────────────────────────

export function validateCoverage(
  draft: string,
  classification: LegalClassification,
): ValidationError[] {
  if (shouldSkip(draft)) return [];

  // Normaliza uma única vez — usada por todos os validators de cobertura
  const norm = normalizeForCoverage(draft);

  const results: ValidationError[] = [];
  const seen = new Set<string>(); // deduplicação por domain:topic

  const push = (domain: string, topic: string, err: ValidationError | null) => {
    if (!err) return;
    const key = `MISSING_ESSENTIAL_TOPIC:${domain}:${topic}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(err);
  };

  // 1. RGPS
  if (classification.regime_juridico === "RGPS") {
    push("RGPS", "aposentadoria_especial", validateRgpsEspecial(norm));
  }

  // 2. TRIBUTÁRIO
  const isTributario =
    classification.tipo_justica === "EXECUCAO_FISCAL" ||
    (classification.regime_juridico as string) === "TRIBUTARIO" ||
    /tributario|ctn\b|debito\s+fiscal|lancamento\s+fiscal|execucao\s+fiscal/i.test(
      normalizeForCoverage(classification.assunto_principal ?? ""),
    ) ||
    /ctn\b|lancamento\s+tributario|debito\s+fiscal|execucao\s+fiscal|\bcda\b/i.test(
      normalizeForCoverage(draft.slice(0, 3000)),
    );
  if (isTributario) {
    push("TRIBUTARIO", "anulacao_debito_fiscal", validateTribDebito(norm));
  }

  // 3. FAMÍLIA
  const isFamilia =
    /alimentos?|guarda|divorcio|uniao\s+estavel|partilha|famil(?:ia|iar)|interdicao|curatela|adocao/i.test(
      normalizeForCoverage(classification.assunto_principal ?? ""),
    );
  if (isFamilia) {
    push("FAMILIA", "guarda_crianca", validateFamiliaGuarda(norm));
  }

  // 4. CONSUMIDOR
  const isConsumidor =
    /consumidor|cdc\b|fornecedor|produto\s+defeituoso|servico\s+defeituoso|cobranca\s+indevida/i.test(
      normalizeForCoverage(classification.assunto_principal ?? ""),
    ) ||
    (classification.tipo_justica === "JEC" &&
      /consumidor|cdc\b|fornecedor/i.test(normalizeForCoverage(draft.slice(0, 2000))));
  if (isConsumidor) {
    push("CONSUMIDOR", "pretensao_consumerista", validateConsumidorPretensao(norm));
  }

  return results;
}

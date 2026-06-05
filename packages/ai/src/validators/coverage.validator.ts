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
  // ̀-ͯ = combining diacritical marks (NFD decomposition → remove → ASCII)
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

// ── 5. RPPS — Benefício Estatutário ──────────────────────────────────────────

const TRIGGER_RPPS_COV_N = /rpps|regime\s+proprio|servidor\s+publico|cargo\s+efetivo|aposentadoria\s+(?:de\s+servidor|voluntaria|por\s+incapacidade\s+permanente)|pensao\s+por\s+morte\s+de\s+servidor|paridade|integralidade|abono\s+de\s+permanencia/i;
// Cobertura: requisitos específicos do benefício
// art. 40 NÃO incluso — citação genérica em todo texto RPPS, não indica cobertura de requisito
const COV_RPPS_REQUISITOS_N = /tempo\s+de\s+contribuicao|tempo\s+de\s+servico|idade\s+minima|requisito\s+(?:legal|d[ao]\s+beneficio)|incapacidade\s+permanente|laudo\s+medico|dependencia\s+economica|obito\s+do\s+instituidor|vinculo\s+estatutario\s+comprovado|cargo\s+efetivo\s+(?:ha|por)/i;

function validateRpps(norm: string): ValidationError | null {
  const triggerMatch = firstMatch(TRIGGER_RPPS_COV_N, norm);
  if (!triggerMatch) return null;
  if (COV_RPPS_REQUISITOS_N.test(norm)) return null;
  return makeIssue(
    "A peça trata de benefício no regime próprio (RPPS), mas não enfrenta minimamente os requisitos específicos do benefício estatutário.",
    { topic: "beneficio_rpps", missing: ["requisitos_beneficio_rpps"], matchedTriggers: [triggerMatch], checkedBlocks: ["requisitos_beneficio_rpps"], skipped: false },
  );
}

// ── 6. TRABALHISTA — Vínculo / Rescisão / Horas Extras ────────────────────────

// A — Vínculo de emprego
const TRIGGER_TRAB_VINCULO_N = /vinculo\s+de\s+emprego|reconhecimento\s+de\s+vinculo|relacao\s+de\s+emprego|configuracao\s+d[ao]\s+(?:vinculo|relacao)/i;
const COV_TRAB_VINCULO_N     = /subordinacao|pessoalidade|habitualidade|nao\s+eventualidade|onerosidade|\bsalario\s+(?:mensal|fixo|base)\b/i;

function validateTrabVinculo(norm: string): ValidationError | null {
  const triggerMatch = firstMatch(TRIGGER_TRAB_VINCULO_N, norm);
  if (!triggerMatch) return null;
  if (COV_TRAB_VINCULO_N.test(norm)) return null;
  return makeIssue(
    "A peça trata de vínculo de emprego, mas não enfrenta minimamente os requisitos da relação empregatícia.",
    { topic: "vinculo_emprego", missing: ["subordinacao_pessoalidade_habitualidade_onerosidade"], matchedTriggers: [triggerMatch], checkedBlocks: ["requisitos_vinculo_emprego"], skipped: false },
  );
}

// B — Verbas rescisórias
// TRIGGER usa itens de pagamento; COV_MODALIDADE usa o TIPO de rescisão (evita auto-satisfação)
const TRIGGER_TRAB_RESCISAO_N = /verbas\s+rescisorias|aviso\s+previo\s+indenizado|multa\s+de\s+40\s*%|multa\s+do\s+fgts|saldo\s+de\s+salario|ferias\s+proporcionais|decimo\s+terceiro\s+proporcional/i;
const COV_TRAB_MODALIDADE_N   = /dispensa\s+sem\s+justa\s+causa|justa\s+causa|pedido\s+de\s+demissao|rescisao\s+indireta|termino\s+do\s+contrato\s+a\s+prazo|modalidade\s+d[ae]\s+rescisao|tipo\s+d[ae]\s+rescisao/i;

function validateTrabRescisao(norm: string): ValidationError | null {
  const triggerMatch = firstMatch(TRIGGER_TRAB_RESCISAO_N, norm);
  if (!triggerMatch) return null;
  if (COV_TRAB_MODALIDADE_N.test(norm)) return null;
  return makeIssue(
    "A peça trata de verbas rescisórias, mas não enfrenta minimamente a modalidade da rescisão contratual.",
    { topic: "verbas_rescisorias", missing: ["modalidade_rescisao"], matchedTriggers: [triggerMatch], checkedBlocks: ["modalidade_rescisao"], skipped: false },
  );
}

// C — Horas extras
const TRIGGER_TRAB_HORAS_N = /horas\s+extras\b/i;
const COV_TRAB_JORNADA_N   = /jornada|horario|controle\s+de\s+ponto|cartao\s+de\s+ponto|extrapolacao\s+(?:da\s+)?jornada|intervalo\s+intrajornada|banco\s+de\s+horas|sobrejornada|periodo\s+d[ae]\s+trabalho/i;

function validateTrabHoras(norm: string): ValidationError | null {
  const triggerMatch = firstMatch(TRIGGER_TRAB_HORAS_N, norm);
  if (!triggerMatch) return null;
  if (COV_TRAB_JORNADA_N.test(norm)) return null;
  return makeIssue(
    "A peça trata de horas extras, mas não enfrenta minimamente a jornada alegada, extrapolação ou controle de ponto.",
    { topic: "horas_extras", missing: ["jornada_controle_extrapolacao"], matchedTriggers: [triggerMatch], checkedBlocks: ["jornada_controle_extrapolacao"], skipped: false },
  );
}

// ── 7. AMBIENTAL — Dano / Nexo / Reparação ────────────────────────────────────

const TRIGGER_AMB_COV_N = /dano\s+ambiental|\bapp\b|area\s+de\s+preservacao\s+permanente|supressao\s+de\s+vegetacao|desmatamento|degradacao\s+ambiental|poluicao|licenca\s+ambiental|\bibama\b|\bsemace\b|multa\s+ambiental|auto\s+de\s+infracao\s+ambiental/i;
const COV_AMB_DANO_N       = /dano|degradacao|supressao|desmatamento|poluicao|area\s+degradada|impacto\s+ambiental/i;
const COV_AMB_NEXO_N       = /conduta|nexo\s+causal|responsavel|causador|atividade\s+(?:poluidora|degradadora)|intervencao|exploracao|obra|empreendimento/i;
const COV_AMB_REPARACAO_N  = /reparacao|recuperacao|\bprad\b|obrigacao\s+de\s+(?:fazer|reparar)|indenizacao\s+ambiental|restauracao|compensacao\s+ambiental/i;

function validateAmbiental(norm: string): ValidationError | null {
  const triggerMatch = firstMatch(TRIGGER_AMB_COV_N, norm);
  if (!triggerMatch) return null;
  const hasDano      = COV_AMB_DANO_N.test(norm);
  const hasNexo      = COV_AMB_NEXO_N.test(norm);
  const hasReparacao = COV_AMB_REPARACAO_N.test(norm);
  const missing: string[] = [];
  if (!hasDano)      missing.push("dano_degradacao_ambiental");
  if (!hasNexo)      missing.push("nexo_conduta_causador");
  if (!hasReparacao) missing.push("reparacao_recuperacao_area");
  if (missing.length < 2) return null;
  return makeIssue(
    "A peça trata de matéria ambiental, mas não enfrenta minimamente dano/degradação, nexo com a conduta ou reparação da área.",
    { topic: "responsabilidade_ambiental", missing, matchedTriggers: [triggerMatch], checkedBlocks: ["dano_degradacao_ambiental", "nexo_conduta_causador", "reparacao_recuperacao_area"], skipped: false },
  );
}

// ── 8. CRIMINAL — Tipicidade / Autoria / Materialidade / Dosimetria ───────────

const TRIGGER_CRIM_N       = /\bcrime\b|denuncia\s+criminal|\breu\b|\bacusado\b|materialidade|autoria\s+(?:d[ao]\s+crime|delitiva)|tipicidade|dolo|culpa|absolvicao|condenacao\s+(?:criminal|penal)|\bpena\b|dosimetria|codigo\s+penal|\bcpp\b|art\.?\s*155\b|art\.?\s*157\b|art\.?\s*129\b/i;
const COV_CRIM_MATERIAL_N  = /materialidade|laudo\s+pericial|boletim\s+de\s+ocorrencia|auto\s+de\s+apreensao|exame\s+pericial|prova\s+material|corpo\s+de\s+delito/i;
const COV_CRIM_AUTORIA_N   = /autoria|depoimento|testemunha|confissao|reconhecimento\s+(?:pessoal|fotografico)|relato\s+d[ae]\s+(?:vitima|testemunha)/i;
const COV_CRIM_TIPICI_N    = /tipicidade|conduta\s+tipica|elemento\s+subjetivo|adequacao\s+tipica|tipo\s+penal|dolo|culpa|imprudencia|negligencia|imperiecia/i;

function validateCriminalFundamentos(norm: string): ValidationError | null {
  const triggerMatch = firstMatch(TRIGGER_CRIM_N, norm);
  if (!triggerMatch) return null;
  const hasM = COV_CRIM_MATERIAL_N.test(norm);
  const hasA = COV_CRIM_AUTORIA_N.test(norm);
  const hasT = COV_CRIM_TIPICI_N.test(norm);
  const missing: string[] = [];
  if (!hasM) missing.push("materialidade");
  if (!hasA) missing.push("autoria");
  if (!hasT) missing.push("tipicidade");
  if (missing.length < 2) return null;
  return makeIssue(
    "A peça criminal não enfrenta minimamente materialidade, autoria ou tipicidade.",
    { topic: "fundamentos_penais_essenciais", missing, matchedTriggers: [triggerMatch], checkedBlocks: ["materialidade", "autoria", "tipicidade"], skipped: false },
  );
}

// Trigger separado para dosimetria (mais específico — "condeno" não aparece em petições comuns)
const TRIGGER_CRIM_CONDENA_N = /\bcondeno\b|\bcondenacao\s+(?:criminal|penal|d[ao]\s+reu)\b|fixo\s+a\s+pena|pena\s+privativa\s+de\s+liberdade/i;
const COV_CRIM_DOSIMETRIA_N  = /dosimetria|pena.?base|circunstancias\s+judiciais|agravante|atenuante|causa\s+de\s+aumento|causa\s+de\s+diminuicao|regime\s+inicial/i;

function validateCriminalDosimetria(norm: string): ValidationError | null {
  const triggerMatch = firstMatch(TRIGGER_CRIM_CONDENA_N, norm);
  if (!triggerMatch) return null;
  if (COV_CRIM_DOSIMETRIA_N.test(norm)) return null;
  return makeIssue(
    "A peça indica condenação penal, mas não enfrenta minimamente a dosimetria da pena.",
    { topic: "dosimetria_da_pena", missing: ["dosimetria_pena_base_regime"], matchedTriggers: [triggerMatch], checkedBlocks: ["dosimetria_pena_base_regime"], skipped: false },
  );
}

// ── 9. FAZENDA PÚBLICA — Ato Administrativo / Concurso / Mandado de Segurança ──

// A — Ato administrativo genérico
const TRIGGER_FAZ_ATO_N     = /ato\s+administrativo|administracao\s+publica|ente\s+publico|fazenda\s+publica|licenca\s+administrativa|autorizacao\s+administrativa|anulacao\s+de\s+ato\s+administrativo/i;
const COV_FAZ_LEGALIDADE_N  = /legalidade|motivacao|competencia|finalidade\s+(?:do\s+ato|publica)|razoabilidade|proporcionalidade|vicio\s+(?:formal|material|do\s+ato)|nulidade\s+(?:do\s+ato|administrativa)|controle\s+judicial/i;

function validateFazAto(norm: string): ValidationError | null {
  const triggerMatch = firstMatch(TRIGGER_FAZ_ATO_N, norm);
  if (!triggerMatch) return null;
  if (COV_FAZ_LEGALIDADE_N.test(norm)) return null;
  return makeIssue(
    "A peça trata de ato administrativo, mas não enfrenta minimamente legalidade, motivação, competência ou vício do ato.",
    { topic: "ato_administrativo", missing: ["legalidade_motivacao_competencia_vicio"], matchedTriggers: [triggerMatch], checkedBlocks: ["legalidade_motivacao_competencia_vicio"], skipped: false },
  );
}

// B — Concurso público / nomeação (trigger específico — evita overlap com ato administrativo)
const TRIGGER_FAZ_CONCURSO_N  = /concurso\s+publico|nomeacao\s+(?:ao|em|para)\s+cargo|posse\s+(?:em|ao)\s+cargo|candidato\s+aprovado|aprovado\s+em\s+concurso/i;
const COV_FAZ_DIREITO_SUBJ_N  = /direito\s+subjetivo|aprovacao\s+dentro\s+das\s+vagas|pretericao|contratacao\s+temporaria|ordem\s+de\s+classificacao|edital|prazo\s+de\s+validade\s+do\s+concurso|reserva\s+de\s+vagas/i;

function validateFazConcurso(norm: string): ValidationError | null {
  const triggerMatch = firstMatch(TRIGGER_FAZ_CONCURSO_N, norm);
  if (!triggerMatch) return null;
  if (COV_FAZ_DIREITO_SUBJ_N.test(norm)) return null;
  return makeIssue(
    "A peça trata de concurso público/nomeação, mas não enfrenta minimamente direito subjetivo, vagas, preterição ou edital.",
    { topic: "concurso_publico_nomeacao", missing: ["direito_subjetivo_vagas_pretericao_edital"], matchedTriggers: [triggerMatch], checkedBlocks: ["direito_subjetivo_vagas_pretericao_edital"], skipped: false },
  );
}

// C — Mandado de segurança (trigger = apenas "mandado de seguranca"; coverage = elementos substantivos)
const TRIGGER_FAZ_MS_N = /mandado\s+de\s+seguranca/i;
const COV_FAZ_MS_N     = /direito\s+liquido\s+e\s+certo|prova\s+pre.constituida|autoridade\s+coatora|ato\s+coator|prazo\s+decadencial|120\s+dias/i;

function validateFazMs(norm: string): ValidationError | null {
  const triggerMatch = firstMatch(TRIGGER_FAZ_MS_N, norm);
  if (!triggerMatch) return null;
  if (COV_FAZ_MS_N.test(norm)) return null;
  return makeIssue(
    "A peça trata de mandado de segurança, mas não enfrenta minimamente direito líquido e certo, autoridade coatora, prova pré-constituída ou prazo decadencial.",
    { topic: "mandado_de_seguranca", missing: ["direito_liquido_autoridade_coatora_prazo"], matchedTriggers: [triggerMatch], checkedBlocks: ["direito_liquido_autoridade_coatora_prazo"], skipped: false },
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

  // 5. RPPS (FASE 5.6.2)
  if (classification.regime_juridico === "RPPS") {
    push("RPPS", "beneficio_rpps", validateRpps(norm));
  }

  // 6. TRABALHISTA (FASE 5.6.2)
  const isTrabalhista = classification.regime_juridico === "CLT" || classification.tipo_justica === "TRABALHO";
  if (isTrabalhista) {
    push("TRABALHISTA", "vinculo_emprego",    validateTrabVinculo(norm));
    push("TRABALHISTA", "verbas_rescisorias", validateTrabRescisao(norm));
    push("TRABALHISTA", "horas_extras",       validateTrabHoras(norm));
  }

  // 7. AMBIENTAL (FASE 5.6.2)
  const isAmbientalCov =
    /ambiental|app\b|preservacao\s+permanente|supressao\s+de\s+vegetacao|dano\s+ambiental|ibama/i.test(
      normalizeForCoverage(classification.assunto_principal ?? ""),
    ) ||
    /dano\s+ambiental|\bapp\b|supressao\s+de\s+vegetacao|\bibama\b|poluicao|desmatamento/i.test(
      normalizeForCoverage(draft.slice(0, 3000)),
    );
  if (isAmbientalCov) {
    push("AMBIENTAL", "responsabilidade_ambiental", validateAmbiental(norm));
  }

  // 8. CRIMINAL (FASE 5.6.2)
  const isCriminal =
    classification.tipo_justica === "CRIMINAL" ||
    (classification.regime_juridico as string) === "CRIMINAL";
  if (isCriminal) {
    push("CRIMINAL", "fundamentos_penais_essenciais", validateCriminalFundamentos(norm));
    push("CRIMINAL", "dosimetria_da_pena",             validateCriminalDosimetria(norm));
  }

  // 9. FAZENDA PÚBLICA (FASE 5.6.2)
  const isFazenda =
    /fazenda\s+publica|servidor\s+publico|concurso\s+publico|ato\s+administrativo|mandado\s+de\s+seguranca|administracao\s+publica/i.test(
      normalizeForCoverage(classification.assunto_principal ?? ""),
    ) ||
    /mandado\s+de\s+seguranca|concurso\s+publico|nomeacao\s+ao\s+cargo|ato\s+administrativo/i.test(
      normalizeForCoverage(draft.slice(0, 3000)),
    );
  if (isFazenda) {
    push("FAZENDA_PUBLICA", "ato_administrativo",        validateFazAto(norm));
    push("FAZENDA_PUBLICA", "concurso_publico_nomeacao", validateFazConcurso(norm));
    push("FAZENDA_PUBLICA", "mandado_de_seguranca",      validateFazMs(norm));
  }

  return results;
}

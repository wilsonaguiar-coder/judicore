// legal-contradiction.validator.ts — FASE 5.7.2 (segunda onda de contradições)
//
// Detecta contradições jurídicas materiais entre fundamentação e dispositivo.
// Todos os alertas: fatal: false → entram em problemasNaoFatais.
// Não altera score, classificação, RPPS, Trabalhista, Coverage ou validators existentes.
//
// Hardenings 5.7.1 (apenas redução de falso positivo + auditabilidade):
//   - normalizeForContradictions(): NFD + strip diacríticos + lowercase
//   - shouldSkip(): texto curto, template incompleto, jurisprudência isolada
//   - looksLikeOnlyJurisprudence(): mesmo conceito da Fase 5.6.1
//   - hasTemplateMarkers(): mesmo conceito da Fase 5.6.1
//   - extractSections() com fallback explícito (janela 80/20) e rastreio de bandeira
//   - details auditável: reasoningSectionFound, dispositiveSectionFound, fallbackWindowUsed, skipped
//   - deduplicação por rule code (mantida)
//   - proteção: só dispara se houver match em ambas as seções
//
// Regras 5.7.0/5.7.1:
//   PRESCRIPTION_PROCEDENCE_CONTRADICTION  — prescrição/decadência × procedência
//   STANDING_CONTRADICTION                 — ilegitimidade × decisão de mérito
//   LACK_OF_EVIDENCE_CONTRADICTION         — insuficiência probatória × procedência
//   MORAL_DAMAGE_CONTRADICTION             — afasta dano moral × condena por dano moral
//   EMPLOYMENT_RELATION_CONTRADICTION      — afasta vínculo × reconhece vínculo
//   SPECIAL_ACTIVITY_CONTRADICTION         — afasta atividade especial × reconhece tempo especial
//
// Regras 5.7.2 (segunda onda):
//   RES_JUDICATA_MERITS_CONTRADICTION           — coisa julgada/litispendência/perempção × procedência
//   LACK_OF_INTEREST_PROCEDENCE_CONTRADICTION   — ausência de interesse de agir × procedência
//   NO_DAMAGE_COMPENSATION_CONTRADICTION        — ausência de dano/prejuízo material × indenização
//   NO_INCAPACITY_BENEFIT_CONTRADICTION         — ausência de incapacidade × benefício por incapacidade
//   NO_QUALITY_INSURED_BENEFIT_CONTRADICTION    — ausência de qualidade de segurado × benefício previdenciário
//   ADMIN_NULLITY_MAINTAINED_ACT_CONTRADICTION  — nulidade de ato administrativo × manutenção do ato

import type { ValidationError } from "../pipeline/types.js";

// ── Helper: normalização (NFD + strip diacríticos + lowercase) ────────────────
// Uso apenas interno — não altera o draft original nem o relatório.

export function normalizeForContradictions(text: string): string {
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
  const useful = draft.replace(/\[[^\]]{3,}\]/g, "").replace(/\s+/g, " ").trim();
  if (useful.length < MIN_USEFUL_LENGTH) return true;
  if (hasTemplateMarkers(draft)) return true;
  if (looksLikeOnlyJurisprudence(draft)) return true;
  return false;
}

// ── Extração de seções (sobre texto normalizado) ──────────────────────────────

const FUNDAMENTACAO_RE = /fundamentacao|do\s+merito|analise\s+do\s+(?:caso|pedido)/;
const DISPOSITIVO_RE   =
  /dispositivo|ante\s+o\s+exposto|isso\s+posto|isto\s+posto|pelo\s+exposto|diante\s+do\s+exposto/;

interface Sections {
  fundamentacao: string;
  dispositivo: string;
  reasoningSectionFound: boolean;
  dispositiveSectionFound: boolean;
  fallbackWindowUsed: boolean;
}

function extractSections(norm: string): Sections {
  const fundIdx = norm.search(FUNDAMENTACAO_RE);
  const dispIdx = norm.search(DISPOSITIVO_RE);

  // Caso ideal: ambas as seções existem e estão na ordem correta.
  if (fundIdx >= 0 && dispIdx > fundIdx) {
    return {
      fundamentacao: norm.slice(fundIdx, dispIdx),
      dispositivo:   norm.slice(dispIdx),
      reasoningSectionFound: true,
      dispositiveSectionFound: true,
      fallbackWindowUsed: false,
    };
  }

  // Fallback explícito: 80% inicial = reasoning, 20% final = dispositivo.
  const split = Math.floor(norm.length * 0.8);
  return {
    fundamentacao: norm.slice(0, split),
    dispositivo:   norm.slice(split),
    reasoningSectionFound: fundIdx >= 0,
    dispositiveSectionFound: dispIdx >= 0,
    fallbackWindowUsed: true,
  };
}

// ── Helper: coleta todas as ocorrências de um padrão no texto ─────────────────

function collectMatches(re: RegExp, text: string): string[] {
  const global = new RegExp(re.source, "g");
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = global.exec(text)) !== null) {
    matches.push(m[0].trim().slice(0, 60));
    if (matches.length >= 5) break;
  }
  return matches;
}

// ── Details auditável ────────────────────────────────────────────────────────

interface BaseDetails {
  reasoningSectionFound: boolean;
  dispositiveSectionFound: boolean;
  fallbackWindowUsed: boolean;
  skipped: false;
}

interface ContradictionDetails extends BaseDetails {
  reasoningMatched: string[];
  dispositiveMatched: string[];
}

function makeContradiction(
  rule: string,
  message: string,
  reasoningMatched: string[],
  dispositiveMatched: string[],
  base: BaseDetails,
): ValidationError {
  const details: ContradictionDetails = {
    reasoningMatched,
    dispositiveMatched,
    reasoningSectionFound: base.reasoningSectionFound,
    dispositiveSectionFound: base.dispositiveSectionFound,
    fallbackWindowUsed: base.fallbackWindowUsed,
    skipped: false,
  };
  return {
    rule,
    message,
    fatal: false,
    details: details as unknown as Record<string, unknown>,
  };
}

// ── Padrão compartilhado: "condeno" excluindo condenação do autor/requerente em custas ─
// "Condeno o réu/requerido" = procedência.  "Condeno o autor/requerente" = improcedência + custas.
// Trabalha em texto normalizado (sem acentos, lowercase).
const CONDENO_MERITO =
  /condeno(?!\s+[oa]a?\s+(?:autor[a]?|requerente[s]?|reclamante[s]?|impetrante[s]?|apelante[s]?|recorrente[s]?))/;

// ── 1. PRESCRIPTION_PROCEDENCE_CONTRADICTION ─────────────────────────────────

const RE_PRESCRICAO =
  /prescricao|decadencia|extincao\s+do\s+direito|perda\s+da\s+pretensao/;
const RE_PROCEDENTE = new RegExp(
  `julgo\\s+procedente|procedencia\\s+do\\s+pedido|${CONDENO_MERITO.source}|concedo|defiro|reconheco\\s+o\\s+direito`,
);

function checkPrescriptionProcedence(
  fund: string,
  disp: string,
  base: BaseDetails,
): ValidationError | null {
  const rMatches = collectMatches(RE_PRESCRICAO, fund);
  if (rMatches.length === 0) return null;
  const dMatches = collectMatches(RE_PROCEDENTE, disp);
  if (dMatches.length === 0) return null;
  return makeContradiction(
    "PRESCRIPTION_PROCEDENCE_CONTRADICTION",
    "A fundamentação reconhece prescrição/decadência, mas o dispositivo aparenta acolher o pedido.",
    rMatches,
    dMatches,
    base,
  );
}

// ── 2. STANDING_CONTRADICTION ─────────────────────────────────────────────────

const RE_ILEGITIMIDADE =
  /ilegitimidade\s+ativa|ilegitimidade\s+passiva|parte\s+ilegitima|ausencia\s+de\s+legitimidade/;
const RE_MERITO = new RegExp(
  `${CONDENO_MERITO.source}|julgo\\s+procedente|defiro|concedo`,
);

function checkStandingContradiction(
  fund: string,
  disp: string,
  base: BaseDetails,
): ValidationError | null {
  const rMatches = collectMatches(RE_ILEGITIMIDADE, fund);
  if (rMatches.length === 0) return null;
  const dMatches = collectMatches(RE_MERITO, disp);
  if (dMatches.length === 0) return null;
  return makeContradiction(
    "STANDING_CONTRADICTION",
    "A fundamentação reconhece ilegitimidade processual, mas o dispositivo aparenta decidir o mérito.",
    rMatches,
    dMatches,
    base,
  );
}

// ── 3. LACK_OF_EVIDENCE_CONTRADICTION ────────────────────────────────────────

const RE_SEM_PROVA =
  /ausencia\s+de\s+prova|insuficiencia\s+probatoria|nao\s+comprovado|nao\s+demonstrado|inexistencia\s+de\s+prova/;
const RE_ACOLHE = new RegExp(
  `julgo\\s+procedente|${CONDENO_MERITO.source}|defiro|concedo`,
);

function checkLackOfEvidence(
  fund: string,
  disp: string,
  base: BaseDetails,
): ValidationError | null {
  const rMatches = collectMatches(RE_SEM_PROVA, fund);
  if (rMatches.length === 0) return null;
  const dMatches = collectMatches(RE_ACOLHE, disp);
  if (dMatches.length === 0) return null;
  return makeContradiction(
    "LACK_OF_EVIDENCE_CONTRADICTION",
    "A fundamentação indica insuficiência probatória, mas o dispositivo aparenta acolher o pedido.",
    rMatches,
    dMatches,
    base,
  );
}

// ── 4. MORAL_DAMAGE_CONTRADICTION ─────────────────────────────────────────────

const RE_SEM_DANO_MORAL =
  /mero\s+aborrecimento|inexistencia\s+de\s+dano\s+moral|nao\s+configurado\s+dano\s+moral|sem\s+dano\s+moral/;
const RE_CONDENA_MORAL =
  /dano\s+moral|indenizacao\s+moral|compensacao\s+moral/;

function checkMoralDamage(
  fund: string,
  disp: string,
  base: BaseDetails,
): ValidationError | null {
  const rMatches = collectMatches(RE_SEM_DANO_MORAL, fund);
  if (rMatches.length === 0) return null;
  const dMatches = collectMatches(RE_CONDENA_MORAL, disp);
  if (dMatches.length === 0) return null;
  return makeContradiction(
    "MORAL_DAMAGE_CONTRADICTION",
    "A fundamentação afasta o dano moral, mas o dispositivo aparenta condenar por dano moral.",
    rMatches,
    dMatches,
    base,
  );
}

// ── 5. EMPLOYMENT_RELATION_CONTRADICTION ──────────────────────────────────────

const RE_SEM_VINCULO =
  /ausencia\s+de\s+subordinacao|inexistencia\s+de\s+vinculo|nao\s+comprovado\s+vinculo|nao\s+caracterizada\s+relacao\s+de\s+emprego/;
const RE_RECONHECE_VINCULO =
  /reconheco\s+o\s+vinculo|declaro\s+o\s+vinculo|verbas\s+trabalhistas|anotacao\s+em\s+ctps/;

function checkEmploymentRelation(
  fund: string,
  disp: string,
  base: BaseDetails,
): ValidationError | null {
  const rMatches = collectMatches(RE_SEM_VINCULO, fund);
  if (rMatches.length === 0) return null;
  const dMatches = collectMatches(RE_RECONHECE_VINCULO, disp);
  if (dMatches.length === 0) return null;
  return makeContradiction(
    "EMPLOYMENT_RELATION_CONTRADICTION",
    "A fundamentação afasta a relação de emprego, mas o dispositivo aparenta reconhecer vínculo trabalhista.",
    rMatches,
    dMatches,
    base,
  );
}

// ── 6. SPECIAL_ACTIVITY_CONTRADICTION ─────────────────────────────────────────

const RE_SEM_ESPECIAL =
  /nao\s+comprovada\s+exposicao|ausencia\s+de\s+agente\s+nocivo|ppp\s+insuficiente|ltcat\s+insuficiente|atividade\s+nao\s+especial/;
const RE_RECONHECE_ESPECIAL =
  /tempo\s+especial|atividade\s+especial|aposentadoria\s+especial|conversao\s+de\s+tempo\s+especial/;

function checkSpecialActivity(
  fund: string,
  disp: string,
  base: BaseDetails,
): ValidationError | null {
  const rMatches = collectMatches(RE_SEM_ESPECIAL, fund);
  if (rMatches.length === 0) return null;
  const dMatches = collectMatches(RE_RECONHECE_ESPECIAL, disp);
  if (dMatches.length === 0) return null;
  return makeContradiction(
    "SPECIAL_ACTIVITY_CONTRADICTION",
    "A fundamentação afasta a atividade especial, mas o dispositivo aparenta reconhecer tempo especial.",
    rMatches,
    dMatches,
    base,
  );
}

// ── 7. RES_JUDICATA_MERITS_CONTRADICTION ─────────────────────────────────────

const RE_RES_JUDICATA =
  /coisa\s+julgada|litispendencia|perempcao/;

function checkResJudicataMerits(
  fund: string,
  disp: string,
  base: BaseDetails,
): ValidationError | null {
  const rMatches = collectMatches(RE_RES_JUDICATA, fund);
  if (rMatches.length === 0) return null;
  const dMatches = collectMatches(RE_PROCEDENTE, disp);
  if (dMatches.length === 0) return null;
  return makeContradiction(
    "RES_JUDICATA_MERITS_CONTRADICTION",
    "A fundamentação reconhece coisa julgada, litispendência ou perempção, mas o dispositivo aparenta acolher o pedido.",
    rMatches,
    dMatches,
    base,
  );
}

// ── 8. LACK_OF_INTEREST_PROCEDENCE_CONTRADICTION ──────────────────────────────

const RE_SEM_INTERESSE =
  /ausencia\s+de\s+interesse\s+de\s+agir|falta\s+de\s+interesse\s+processual|carencia\s+de\s+acao|interesse\s+de\s+agir\s+ausente/;

function checkLackOfInterestProcedence(
  fund: string,
  disp: string,
  base: BaseDetails,
): ValidationError | null {
  const rMatches = collectMatches(RE_SEM_INTERESSE, fund);
  if (rMatches.length === 0) return null;
  const dMatches = collectMatches(RE_PROCEDENTE, disp);
  if (dMatches.length === 0) return null;
  return makeContradiction(
    "LACK_OF_INTEREST_PROCEDENCE_CONTRADICTION",
    "A fundamentação reconhece ausência de interesse de agir ou carência de ação, mas o dispositivo aparenta acolher o pedido.",
    rMatches,
    dMatches,
    base,
  );
}

// ── 9. NO_DAMAGE_COMPENSATION_CONTRADICTION ───────────────────────────────────

const RE_SEM_DANO_MATERIAL =
  /ausencia\s+de\s+dano\s+(?:material|patrimonial)|dano\s+(?:material\s+)?nao\s+configurado|inexistencia\s+de\s+dano\s+(?:material|patrimonial|economico)|sem\s+prejuizo\s+concreto|prejuizo\s+nao\s+comprovado|nao\s+comprovado\s+o\s+prejuizo/;
const RE_CONDENA_INDENIZACAO =
  /indenizacao\s+(?:no\s+valor|de\s+r|material|patrimonial)|fixo\s+(?:a\s+)?indenizacao|arbitro\s+(?:a\s+)?indenizacao|pagamento\s+de\s+indenizacao/;

function checkNoDamageCompensation(
  fund: string,
  disp: string,
  base: BaseDetails,
): ValidationError | null {
  const rMatches = collectMatches(RE_SEM_DANO_MATERIAL, fund);
  if (rMatches.length === 0) return null;
  const dMatches = collectMatches(RE_CONDENA_INDENIZACAO, disp);
  if (dMatches.length === 0) return null;
  return makeContradiction(
    "NO_DAMAGE_COMPENSATION_CONTRADICTION",
    "A fundamentação afasta a existência de dano ou prejuízo, mas o dispositivo aparenta condenar ao pagamento de indenização.",
    rMatches,
    dMatches,
    base,
  );
}

// ── 10. NO_INCAPACITY_BENEFIT_CONTRADICTION ───────────────────────────────────

const RE_SEM_INCAPACIDADE =
  /ausencia\s+de\s+incapacidade|incapacidade\s+nao\s+comprovada|nao\s+comprovada\s+incapacidade|capacidade\s+laboral\s+preservada|sem\s+incapacidade\s+para\s+o\s+trabalho|nao\s+ha\s+incapacidade/;
const RE_BENEFICIO_INCAPACIDADE =
  /auxilio[- ]doenca|aposentadoria\s+por\s+incapacidade|beneficio\s+por\s+incapacidade|restabeleco\s+o\s+beneficio|concedo\s+o\s+auxilio/;

function checkNoIncapacityBenefit(
  fund: string,
  disp: string,
  base: BaseDetails,
): ValidationError | null {
  const rMatches = collectMatches(RE_SEM_INCAPACIDADE, fund);
  if (rMatches.length === 0) return null;
  const dMatches = collectMatches(RE_BENEFICIO_INCAPACIDADE, disp);
  if (dMatches.length === 0) return null;
  return makeContradiction(
    "NO_INCAPACITY_BENEFIT_CONTRADICTION",
    "A fundamentação afasta a incapacidade laboral, mas o dispositivo aparenta conceder benefício por incapacidade.",
    rMatches,
    dMatches,
    base,
  );
}

// ── 11. NO_QUALITY_INSURED_BENEFIT_CONTRADICTION ──────────────────────────────

const RE_SEM_QUALIDADE_SEGURADO =
  /ausencia\s+de\s+qualidade\s+de\s+segurado|nao\s+mantem\s+a\s+qualidade|qualidade\s+de\s+segurado\s+nao\s+comprovada|periodo\s+de\s+graca\s+expirado|carencia\s+nao\s+cumprida/;
const RE_CONCEDE_BENEFICIO =
  /concedo\s+o\s+beneficio|\bdefiro\s+o\s+beneficio|determino\s+a\s+implantacao|implantacao\s+do\s+beneficio/;

function checkNoQualityInsuredBenefit(
  fund: string,
  disp: string,
  base: BaseDetails,
): ValidationError | null {
  const rMatches = collectMatches(RE_SEM_QUALIDADE_SEGURADO, fund);
  if (rMatches.length === 0) return null;
  const dMatches = collectMatches(RE_CONCEDE_BENEFICIO, disp);
  if (dMatches.length === 0) return null;
  return makeContradiction(
    "NO_QUALITY_INSURED_BENEFIT_CONTRADICTION",
    "A fundamentação afasta a qualidade de segurado, mas o dispositivo aparenta conceder benefício previdenciário.",
    rMatches,
    dMatches,
    base,
  );
}

// ── 12. ADMIN_NULLITY_MAINTAINED_ACT_CONTRADICTION ────────────────────────────

const RE_NULIDADE_ATO =
  /nulidade\s+do\s+ato\s+administrativo|ato\s+administrativo\s+nulo|vicio\s+de\s+legalidade|ausencia\s+de\s+motivacao\s+(?:do\s+)?ato|incompetencia\s+da\s+autoridade|violacao\s+(?:[ae]\s+|ao\s+|da\s+)?legalidade/;
const RE_MANTEM_ATO =
  /mantem[-\s]se\s+o\s+ato|nao\s+anulo\s+o\s+ato|indefiro\s+(?:o\s+pedido\s+de\s+)?anulacao|ato\s+(?:e\s+)?mantido|denego\s+a\s+anulacao/;

function checkAdminNullityMaintainedAct(
  fund: string,
  disp: string,
  base: BaseDetails,
): ValidationError | null {
  const rMatches = collectMatches(RE_NULIDADE_ATO, fund);
  if (rMatches.length === 0) return null;
  const dMatches = collectMatches(RE_MANTEM_ATO, disp);
  if (dMatches.length === 0) return null;
  return makeContradiction(
    "ADMIN_NULLITY_MAINTAINED_ACT_CONTRADICTION",
    "A fundamentação reconhece nulidade ou vício do ato administrativo, mas o dispositivo aparenta mantê-lo.",
    rMatches,
    dMatches,
    base,
  );
}

// ── API pública ───────────────────────────────────────────────────────────────

export function validateLegalContradictions(draft: string): ValidationError[] {
  if (shouldSkip(draft)) return [];

  // Normaliza UMA vez — todas as checagens trabalham sobre o texto normalizado.
  const norm = normalizeForContradictions(draft);

  const sections = extractSections(norm);
  const base: BaseDetails = {
    reasoningSectionFound: sections.reasoningSectionFound,
    dispositiveSectionFound: sections.dispositiveSectionFound,
    fallbackWindowUsed: sections.fallbackWindowUsed,
    skipped: false,
  };

  const results: ValidationError[] = [];
  const seen = new Set<string>(); // dedup por rule code

  const push = (err: ValidationError | null) => {
    if (!err) return;
    if (seen.has(err.rule)) return;
    seen.add(err.rule);
    results.push(err);
  };

  push(checkPrescriptionProcedence   (sections.fundamentacao, sections.dispositivo, base));
  push(checkStandingContradiction    (sections.fundamentacao, sections.dispositivo, base));
  push(checkLackOfEvidence           (sections.fundamentacao, sections.dispositivo, base));
  push(checkMoralDamage              (sections.fundamentacao, sections.dispositivo, base));
  push(checkEmploymentRelation       (sections.fundamentacao, sections.dispositivo, base));
  push(checkSpecialActivity          (sections.fundamentacao, sections.dispositivo, base));
  push(checkResJudicataMerits        (sections.fundamentacao, sections.dispositivo, base));
  push(checkLackOfInterestProcedence (sections.fundamentacao, sections.dispositivo, base));
  push(checkNoDamageCompensation     (sections.fundamentacao, sections.dispositivo, base));
  push(checkNoIncapacityBenefit      (sections.fundamentacao, sections.dispositivo, base));
  push(checkNoQualityInsuredBenefit  (sections.fundamentacao, sections.dispositivo, base));
  push(checkAdminNullityMaintainedAct(sections.fundamentacao, sections.dispositivo, base));

  return results;
}

// request-dispositive.validator.ts — FASE 5.8.1
//
// Audita coerência entre pedidos e dispositivo.
// Regras: fatal: false — entram em problemasNaoFatais.
// Não altera score, classificação, RPPS, Trabalhista ou validators existentes.
//
// Regras:
//   UNADDRESSED_MAIN_REQUEST       — pedido principal não enfrentado no dispositivo
//   UNADDRESSED_SUBSIDIARY_REQUEST — pedido subsidiário ignorado
//   UNADDRESSED_INJUNCTION_REQUEST — tutela/liminar ignorada
//   RELIEF_NOT_REQUESTED           — concessão de algo não pedido
//   INCOMPLETE_RELIEF              — dispositivo incompleto (sem valor/DIB/prazo)

import type { ValidationError } from "../pipeline/types.js";

// ── Normalização ──────────────────────────────────────────────────────────────

export function normalizeForRequests(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ── Guards (mesmo padrão 5.6/5.7) ────────────────────────────────────────────

function hasTemplateMarkers(text: string): boolean {
  return /\{\{|}}\s*|^\s*_{4,}\s*$|\[PREENCHER\]|\[NOME\s|\[DATA\s|\[CPF\s|\bXXX\b/im.test(text);
}

function looksLikeOnlyJurisprudence(text: string): boolean {
  const lower = text.toLowerCase();
  const JUR = [
    /\bementa\b/, /\bacordao\b|\bacórdão\b/, /\brelator\b/, /\bturma\b/,
    /julgado\s+em/, /\bdje\b/, /\bstj\b/, /\bstf\b/, /\btrf\b/, /\btst\b/, /\bprecedente\b/,
  ];
  const PIECE = [
    /dos\s+fatos/, /do\s+direito/, /fundamenta/, /dispositivo/,
    /ante\s+o\s+exposto/, /\brequer\b/, /\bjulgo\b/, /\bdefiro\b/, /\bcondeno\b/,
  ];
  return JUR.filter((r) => r.test(lower)).length >= 4 &&
    PIECE.filter((r) => r.test(lower)).length <= 1;
}

const MIN_USEFUL_LENGTH = 800;

function shouldSkip(draft: string): boolean {
  const useful = draft.replace(/\[[^\]]{3,}\]/g, "").replace(/\s+/g, " ").trim();
  if (useful.length < MIN_USEFUL_LENGTH) return true;
  if (hasTemplateMarkers(draft)) return true;
  if (looksLikeOnlyJurisprudence(draft)) return true;
  return false;
}

// ── Extração de seções ────────────────────────────────────────────────────────

const DISP_SECTION_RE =
  /dispositivo|ante\s+o\s+exposto|isso\s+posto|isto\s+posto|pelo\s+exposto|diante\s+do\s+exposto/;

interface RdSections {
  preDisp: string;
  disp: string;
  fallbackWindowUsed: boolean;
  dispositiveSectionFound: boolean;
}

function extractRdSections(norm: string): RdSections {
  const idx = norm.search(DISP_SECTION_RE);
  if (idx >= 0) {
    return {
      preDisp: norm.slice(0, idx),
      disp: norm.slice(idx),
      fallbackWindowUsed: false,
      dispositiveSectionFound: true,
    };
  }
  const split = Math.floor(norm.length * 0.8);
  return {
    preDisp: norm.slice(0, split),
    disp: norm.slice(split),
    fallbackWindowUsed: true,
    dispositiveSectionFound: false,
  };
}

// ── Tópicos auditados ─────────────────────────────────────────────────────────

interface TopicDef { key: string; label: string; re: RegExp; }

const TOPICS: TopicDef[] = [
  { key: "dano_moral",      label: "dano moral",           re: /dano\s+moral/ },
  { key: "dano_material",   label: "dano material",        re: /dano\s+material/ },
  { key: "aposentadoria",   label: "aposentadoria",        re: /aposentadoria/ },
  { key: "auxilio",         label: "auxílio",              re: /\bauxilio\b/ },
  { key: "pensao",          label: "pensão",               re: /\bpensao\b/ },
  { key: "vinculo",         label: "vínculo empregatício", re: /vinculo\s+empregat|relacao\s+de\s+emprego/ },
  { key: "horas_extras",    label: "horas extras",         re: /horas\s+extras/ },
  { key: "guarda",          label: "guarda",               re: /\bguarda\b/ },
  { key: "alimentos",       label: "alimentos",            re: /\balimentos\b/ },
  { key: "anulacao_debito", label: "anulação de débito",   re: /anulacao\s+d[eo]\s+debito/ },
  { key: "nulidade_ato",    label: "nulidade de ato",      re: /nulidade\s+d[eo]\s+ato/ },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Seção de pedidos — dos pedidos / pedidos / dos requerimentos
const REQUEST_SECTION_RE = /dos\s+pedidos|dos\s+requerimentos|\bpedidos\b/;

// Verbos de pedido:
//   requer / requer-se / requer seja / requer a condenação / requer a concessão /
//   requer o pagamento / requer o reconhecimento / pede / postula / pleiteia / pedido de
const VERB_RE_SRC =
  /\brequer\b|\bpede\b|\bpostula\b|\bpleiteia\b|\bpedido\s+de\b/;

interface RequestScanResult {
  found: Set<string>;
  requestSectionFound: boolean;
}

function findTopicsNearRequests(preDisp: string): RequestScanResult {
  const found = new Set<string>();

  // Bloco "DOS PEDIDOS" explícito — usa seção inteira
  const pedIdx = preDisp.search(REQUEST_SECTION_RE);
  if (pedIdx >= 0) {
    const section = preDisp.slice(pedIdx);
    for (const t of TOPICS) if (t.re.test(section)) found.add(t.key);
    return { found, requestSectionFound: true };
  }

  // Verbos de pedido + janela de 400 chars após cada ocorrência
  const VERB_RE = new RegExp(VERB_RE_SRC.source, "g");
  let m: RegExpExecArray | null;
  while ((m = VERB_RE.exec(preDisp)) !== null) {
    const win = preDisp.slice(m.index, Math.min(preDisp.length, m.index + 400));
    for (const t of TOPICS) if (t.re.test(win)) found.add(t.key);
  }
  return { found, requestSectionFound: false };
}

// Encontra tópicos concedidos no dispositivo (próximos a verbos de ação).
const ACTION_VERB_SRC =
  /\bcondeno\b|\bdefiro\b|\bconcedo\b|\breconheco\b|\bdetermino\b|\bdeclaro\b|\bfixo\b|\bautorizo\b/;

function findTopicsGrantedInDisp(disp: string): Set<string> {
  const found = new Set<string>();
  const re = new RegExp(ACTION_VERB_SRC.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(disp)) !== null) {
    const win = disp.slice(Math.max(0, m.index - 20), Math.min(disp.length, m.index + 200));
    for (const t of TOPICS) if (t.re.test(win)) found.add(t.key);
  }
  return found;
}

// Dispositivo tem pelo menos um verbo de ação específico (não apenas "julgo").
function hasSpecificActionVerb(disp: string): boolean {
  return ACTION_VERB_SRC.test(disp);
}

// Rejeição global — todos os pedidos foram enfrentados por improcedência.
const BLANKET_REJECTION_RE =
  /improcedentes?\s+(?:o\s+pedido|todos\s+os\s+pedidos|os\s+pedidos)|julgo\s+improcedente\s+o\s+pedido|rejeito\s+os\s+pedidos|indefiro\s+os\s+pedidos|nao\s+acolho\s+o\s+pedido/;

function hasBlanketRejection(disp: string): boolean {
  return BLANKET_REJECTION_RE.test(disp);
}

// Tutela absorvida pelo mérito — enfrentamento indireto.
const TUTELA_ABSORBED_RE =
  /prejudicado\s+o\s+pedido\s+de\s+tutela|tutela\s+absorvida\s+pelo\s+merito|desnecessaria\s+analise\s+da\s+tutela/;

// ── Details ───────────────────────────────────────────────────────────────────

interface RdBase {
  fallbackWindowUsed: boolean;
  dispositiveSectionFound: boolean;
  requestSectionFound: boolean;
  skipped: false;
}

interface RdDetails extends RdBase {
  requestsFound: string[];
  dispositiveFound: string[];
  missingRequests: string[];
  extraReliefs: string[];
}

function makeAlert(
  rule: string,
  message: string,
  requestsFound: string[],
  dispositiveFound: string[],
  missingRequests: string[],
  extraReliefs: string[],
  base: RdBase,
): ValidationError {
  const details: RdDetails = {
    requestsFound, dispositiveFound, missingRequests, extraReliefs,
    fallbackWindowUsed: base.fallbackWindowUsed,
    dispositiveSectionFound: base.dispositiveSectionFound,
    requestSectionFound: base.requestSectionFound,
    skipped: false,
  };
  return {
    rule, message, fatal: false,
    details: details as unknown as Record<string, unknown>,
  };
}

// ── 1. UNADDRESSED_MAIN_REQUEST ───────────────────────────────────────────────

function checkUnaddressedMainRequest(
  requested: Set<string>, disp: string, base: RdBase,
): ValidationError | null {
  if (hasBlanketRejection(disp)) return null;
  if (!hasSpecificActionVerb(disp)) return null;
  if (requested.size === 0) return null;

  const missing: string[] = [];
  for (const key of requested) {
    const t = TOPICS.find((x) => x.key === key)!;
    if (!t.re.test(disp)) missing.push(t.label);
  }
  if (missing.length === 0) return null;

  return makeAlert(
    "UNADDRESSED_MAIN_REQUEST",
    "Foi identificado pedido principal aparentemente não enfrentado no dispositivo.",
    missing, [], missing, [], base,
  );
}

// ── 2. UNADDRESSED_SUBSIDIARY_REQUEST ─────────────────────────────────────────

const SUBSIDIARY_RE = /subsidiariamente|sucessivamente|pedido\s+subsidiario|alternativamente/;

function checkUnaddressedSubsidiaryRequest(
  preDisp: string, disp: string, base: RdBase,
): ValidationError | null {
  if (hasBlanketRejection(disp)) return null;

  const subIdx = preDisp.search(SUBSIDIARY_RE);
  if (subIdx < 0) return null;

  const win = preDisp.slice(subIdx, Math.min(preDisp.length, subIdx + 500));
  const found: string[] = [];
  for (const t of TOPICS) if (t.re.test(win)) found.push(t.label);
  if (found.length === 0) return null;

  const missing = found.filter((label) => {
    const t = TOPICS.find((x) => x.label === label)!;
    return !t.re.test(disp);
  });
  if (missing.length === 0) return null;

  return makeAlert(
    "UNADDRESSED_SUBSIDIARY_REQUEST",
    "Pedido subsidiário aparentemente não enfrentado.",
    found, [], missing, [], base,
  );
}

// ── 3. UNADDRESSED_INJUNCTION_REQUEST ─────────────────────────────────────────

const TUTELA_REQ_RE = /tutela\s+de\s+urgencia|tutela\s+antecipada|tutela\s+provisoria|\bliminar\b/;
const TUTELA_DISP_RE = /\btutela\b|\bliminar\b|\burgencia\b|medida\s+cautelar/;

function checkUnaddressedInjunctionRequest(
  preDisp: string, disp: string, base: RdBase,
): ValidationError | null {
  if (!TUTELA_REQ_RE.test(preDisp)) return null;
  if (TUTELA_DISP_RE.test(disp)) return null;
  if (TUTELA_ABSORBED_RE.test(disp)) return null;

  return makeAlert(
    "UNADDRESSED_INJUNCTION_REQUEST",
    "Pedido de tutela aparentemente não enfrentado.",
    ["tutela de urgência"], [], ["tutela de urgência"], [], base,
  );
}

// ── 4. RELIEF_NOT_REQUESTED ───────────────────────────────────────────────────

function checkReliefNotRequested(
  requested: Set<string>, disp: string, base: RdBase,
): ValidationError | null {
  if (requested.size === 0) return null;

  const granted = findTopicsGrantedInDisp(disp);
  const extra: string[] = [];
  for (const key of granted) {
    if (!requested.has(key)) {
      const t = TOPICS.find((x) => x.key === key)!;
      extra.push(t.label);
    }
  }
  if (extra.length === 0) return null;

  return makeAlert(
    "RELIEF_NOT_REQUESTED",
    "O dispositivo aparenta conceder providência não identificada nos pedidos.",
    [], extra, [], extra, base,
  );
}

// ── 5. INCOMPLETE_RELIEF ──────────────────────────────────────────────────────

interface IncompleteTrigger {
  triggerRe: RegExp;
  paramRe: RegExp;
  label: string;
  missingParam: string;
}

const INCOMPLETE_TRIGGERS: IncompleteTrigger[] = [
  {
    triggerRe: /condeno\s+a\s+indenizar|condeno[^\n.]{0,30}?\bao\s+pagamento\s+de\s+(?:indenizacao|danos?)\b/,
    paramRe: /r\$|\brs\b|valor\s+de|quantia\s+de|\d[\d.,]*\s*(?:mil|reais?)/,
    label: "condenação a indenizar",
    missingParam: "valor (R$)",
  },
  {
    triggerRe: /concedo\s+(?:a\s+)?aposentadoria/,
    paramRe: /\bdib\b|\bder\b|implantac|implantar/,
    label: "concessão de aposentadoria",
    missingParam: "DIB/DER ou implantação",
  },
  {
    triggerRe: /concedo\s+(?:o\s+)?(?:auxilio|beneficio)/,
    paramRe: /\bdib\b|\bder\b|implantac|implantar/,
    label: "concessão de auxílio/benefício",
    missingParam: "DIB/DER ou implantação",
  },
  {
    triggerRe: /obrigacao\s+de\s+fazer/,
    paramRe: /\bprazo\b|\bdias?\b|\bhoras?\b|\bsemanas?\b/,
    label: "obrigação de fazer",
    missingParam: "prazo para cumprimento",
  },
];

function checkIncompleteRelief(disp: string, base: RdBase): ValidationError | null {
  const dispositiveFound: string[] = [];
  const missingParams: string[] = [];

  for (const trig of INCOMPLETE_TRIGGERS) {
    const trigRe = new RegExp(trig.triggerRe.source);
    const m = trigRe.exec(disp);
    if (!m) continue;
    // Verifica parâmetro mínimo nos 500 chars após o trigger
    const after = disp.slice(m.index, Math.min(disp.length, m.index + 500));
    if (!trig.paramRe.test(after)) {
      dispositiveFound.push(m[0].trim().slice(0, 60));
      missingParams.push(trig.missingParam);
    }
  }

  if (dispositiveFound.length === 0) return null;

  return makeAlert(
    "INCOMPLETE_RELIEF",
    "O dispositivo aparenta conceder providência sem definição mínima de seus parâmetros.",
    [], dispositiveFound, missingParams, [], base,
  );
}

// ── API pública ───────────────────────────────────────────────────────────────

export function validateRequestDispositive(draft: string): ValidationError[] {
  if (shouldSkip(draft)) return [];

  const norm = normalizeForRequests(draft);
  const sections = extractRdSections(norm);
  const { found: requestedTopics, requestSectionFound } = findTopicsNearRequests(sections.preDisp);

  const base: RdBase = {
    fallbackWindowUsed: sections.fallbackWindowUsed,
    dispositiveSectionFound: sections.dispositiveSectionFound,
    requestSectionFound,
    skipped: false,
  };

  const results: ValidationError[] = [];
  const seen = new Set<string>();
  const push = (err: ValidationError | null) => {
    if (!err) return;
    if (seen.has(err.rule)) return;
    seen.add(err.rule);
    results.push(err);
  };

  push(checkUnaddressedMainRequest      (requestedTopics, sections.disp, base));
  push(checkUnaddressedSubsidiaryRequest(sections.preDisp, sections.disp, base));
  push(checkUnaddressedInjunctionRequest(sections.preDisp, sections.disp, base));
  push(checkReliefNotRequested          (requestedTopics, sections.disp, base));
  push(checkIncompleteRelief            (sections.disp, base));

  return results;
}

// evidence-conclusion.validator.ts — FASE 5.9.1
//
// Audita coerência entre provas reconhecidas e conclusão/dispositivo.
// Regras: fatal: false — entram em problemasNaoFatais.
// Não altera score, classificação, Coverage, LegalContradiction, RequestDispositive.
//
// Regras:
//   MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION — laudo/perícia reconhece incapacidade × benefício negado
//   SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION   — PPP/LTCAT comprova atividade especial × tempo especial negado
//   PAYMENT_PROOF_CONTRADICTION               — comprovante de pagamento × pagamento negado
//   CONTRACT_EVIDENCE_CONTRADICTION           — contrato juntado × relação jurídica negada
//   WITNESS_OVERTIME_CONTRADICTION            — prova testemunhal confirma jornada × horas extras negadas
//   DEPENDENCY_EVIDENCE_CONTRADICTION         — dependência econômica reconhecida × pensão negada

import type { ValidationError } from "../pipeline/types.js";

// ── Normalização ──────────────────────────────────────────────────────────────

export function normalizeForEvidenceConclusion(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ── Guards (mesmo padrão 5.6/5.7/5.8) ────────────────────────────────────────

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

const EVIDENCE_SECTION_RE = /fundamentacao|dos\s+fatos|do\s+direito/;

interface EcSections {
  preDisp: string;
  disp: string;
  fallbackWindowUsed: boolean;
  dispositiveSectionFound: boolean;
  evidenceSectionFound: boolean;
}

function extractEcSections(norm: string): EcSections {
  const evidenceSectionFound = EVIDENCE_SECTION_RE.test(norm);
  const idx = norm.search(DISP_SECTION_RE);
  if (idx >= 0) {
    return {
      preDisp: norm.slice(0, idx),
      disp: norm.slice(idx),
      fallbackWindowUsed: false,
      dispositiveSectionFound: true,
      evidenceSectionFound,
    };
  }
  const split = Math.floor(norm.length * 0.8);
  return {
    preDisp: norm.slice(0, split),
    disp: norm.slice(split),
    fallbackWindowUsed: true,
    dispositiveSectionFound: false,
    evidenceSectionFound,
  };
}

// ── Definição de regras ───────────────────────────────────────────────────────

interface EcRuleDef {
  key: string;
  evidenceRe: RegExp;
  // Se evidenceNegRe fizer match no bloco de prova, a regra não dispara
  // (a própria prova é negativa — evita falso positivo).
  evidenceNegRe?: RegExp;
  conclusionRe: RegExp;
  message: string;
}

const EC_RULES: EcRuleDef[] = [
  {
    key: "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION",
    evidenceRe:
      /laudo\s+pericial|pericia\s+medica|perito\s+concluiu|incapacidade\s+(?:laboral|total|parcial|permanente|temporaria)/,
    evidenceNegRe:
      /nao\s+constatou\s+(?:a\s+)?incapacidade|capacidade\s+laboral\s+preservada|apto\s+ao\s+trabalho|sem\s+incapacidade\s+(?:laboral|total|parcial)|perito\s+(?:afastou|nao\s+constatou|negou)\s+(?:a\s+)?incapacidade/,
    conclusionRe:
      /improcedente|indefiro\s+(?:o\s+)?beneficio|nao\s+faz\s+jus\s+ao\s+beneficio|ausencia\s+de\s+incapacidade|beneficio\s+indevido/,
    message:
      "A prova pericial aparenta reconhecer incapacidade laboral, mas a conclusão nega o benefício correspondente.",
  },
  {
    key: "SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION",
    evidenceRe:
      /\bppp\b|ltcat|agente\s+nocivo|exposicao\s+(?:habitual|permanente)|\bruido\b|\bcalor\b|agente\s+(?:quimico|biologico)/,
    evidenceNegRe:
      /ppp\s+(?:insuficiente|nao\s+(?:comprova|demonstra))|ltcat\s+insuficiente|ausencia\s+de\s+agente\s+nocivo|exposicao\s+nao\s+comprovada|nao\s+comprova\s+(?:a\s+)?exposicao|agente\s+nocivo\s+nao\s+(?:comprovado|identificado)/,
    conclusionRe:
      /nao\s+reconheco\s+(?:o\s+)?tempo\s+especial|improcedente|atividade\s+comum|nao\s+comprovada\s+atividade\s+especial/,
    message:
      "A prova técnica aparenta comprovar atividade especial, mas a conclusão afasta o reconhecimento.",
  },
  {
    key: "PAYMENT_PROOF_CONTRADICTION",
    evidenceRe:
      /comprovante\s+de\s+pagamento|\brecibo\b|\bted\b|\bpix\b|transferencia\s+bancaria|comprovante\s+anexado/,
    evidenceNegRe:
      /ausencia\s+de\s+comprovante|inexistencia\s+de\s+recibo|nao\s+ha\s+comprovante|sem\s+comprovante\s+de\s+pagamento|comprovante\s+(?:inexistente|nao\s+(?:juntado|apresentado))/,
    conclusionRe:
      /nao\s+houve\s+pagamento|ausencia\s+de\s+pagamento|pagamento\s+nao\s+comprovado|inexistencia\s+de\s+pagamento/,
    message:
      "A peça reconhece documento comprobatório de pagamento, mas a conclusão afasta a ocorrência do pagamento.",
  },
  {
    key: "CONTRACT_EVIDENCE_CONTRADICTION",
    evidenceRe:
      /contrato\s+juntado|instrumento\s+contratual|contrato\s+assinado|documento\s+contratual/,
    evidenceNegRe:
      /nao\s+ha\s+(?:contrato|instrumento)|inexistencia\s+de\s+contrato|contrato\s+nao\s+(?:juntado|assinado|apresentado|existe)|ausencia\s+de\s+instrumento\s+contratual/,
    conclusionRe:
      /inexistencia\s+de\s+relacao\s+juridica|relacao\s+nao\s+comprovada|ausencia\s+de\s+vinculo\s+contratual/,
    message:
      "A peça reconhece documentação contratual, mas a conclusão afasta a própria relação jurídica.",
  },
  {
    key: "WITNESS_OVERTIME_CONTRADICTION",
    evidenceRe:
      /testemunha\s+confirmou|testemunhas\s+afirmaram|prova\s+testemunhal|jornada\s+extraordinaria|labor\s+extraordinario|sobrejornada/,
    evidenceNegRe:
      /testemunha\s+nao\s+(?:confirmou|confirma)|testemunhas\s+nao\s+(?:afirmaram|confirmaram)|prova\s+testemunhal\s+(?:insuficiente|nao|inconsistente)|nao\s+confirmou\s+(?:a\s+)?jornada/,
    conclusionRe:
      /horas\s+extras\s+indevidas|ausencia\s+de\s+prova|nao\s+comprovada\s+jornada|improcedencia\s+do\s+pedido\s+de\s+horas\s+extras/,
    message:
      "A prova testemunhal aparenta confirmar jornada extraordinária, mas a conclusão afasta o pedido por ausência de prova.",
  },
  {
    key: "DEPENDENCY_EVIDENCE_CONTRADICTION",
    evidenceRe:
      /dependencia\s+economica\s+(?:comprovada|demonstrada|reconhecida)|\bdependente\b|dependencia\s+(?:demonstrada|reconhecida)/,
    evidenceNegRe:
      /dependencia\s+(?:economica\s+)?nao\s+(?:comprovada|demonstrada|reconhecida)|ausencia\s+de\s+dependencia|nao\s+(?:e|era)\s+dependente|requerente\s+nao\s+(?:e|era)\s+dependente/,
    conclusionRe:
      /ausencia\s+de\s+dependencia|dependencia\s+nao\s+comprovada|improcedente\s+(?:o\s+pedido\s+de\s+)?pensao|indeferida?\s+(?:a\s+)?pensao/,
    message:
      "A fundamentação reconhece elementos de dependência econômica, mas a conclusão afasta esse requisito.",
  },
];

// ── Base de details ───────────────────────────────────────────────────────────

interface EcBase {
  evidenceSectionFound: boolean;
  dispositiveSectionFound: boolean;
  fallbackWindowUsed: boolean;
  skipped: false;
}

// ── Verificação genérica ──────────────────────────────────────────────────────

function checkRule(
  ruleDef: EcRuleDef,
  preDisp: string,
  disp: string,
  base: EcBase,
): ValidationError | null {
  const evMatch = ruleDef.evidenceRe.exec(preDisp);
  if (!evMatch) return null;
  // Proteção contra prova negativa (falso positivo)
  if (ruleDef.evidenceNegRe && ruleDef.evidenceNegRe.test(preDisp)) return null;
  const conclMatch = ruleDef.conclusionRe.exec(disp);
  if (!conclMatch) return null;
  return {
    rule: ruleDef.key,
    message: ruleDef.message,
    fatal: false,
    details: {
      evidenceMatched:         [evMatch[0].trim()],
      conclusionMatched:       [conclMatch[0].trim()],
      evidenceSectionFound:    base.evidenceSectionFound,
      dispositiveSectionFound: base.dispositiveSectionFound,
      fallbackWindowUsed:      base.fallbackWindowUsed,
      skipped: false,
    },
  };
}

// ── API pública ───────────────────────────────────────────────────────────────

export function validateEvidenceConclusion(draft: string): ValidationError[] {
  if (shouldSkip(draft)) return [];

  const norm = normalizeForEvidenceConclusion(draft);
  const sections = extractEcSections(norm);

  const base: EcBase = {
    evidenceSectionFound:    sections.evidenceSectionFound,
    dispositiveSectionFound: sections.dispositiveSectionFound,
    fallbackWindowUsed:      sections.fallbackWindowUsed,
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

  for (const ruleDef of EC_RULES) {
    push(checkRule(ruleDef, sections.preDisp, sections.disp, base));
  }

  return results;
}

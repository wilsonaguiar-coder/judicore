// SentencaValidator — validação estrutural rigorosa de sentenças.
//
// Verifica:
//   - Presença de RELATÓRIO, FUNDAMENTAÇÃO e DISPOSITIVO
//   - Linguagem dispositiva adequada (verbo correto por área)
//   - Indicação do recurso cabível
//   - Comprimento mínimo das seções (mais rigoroso)
//   - Dispositivo não genérico (deve nomear pedido ou ben. específico)
//
// Roda apenas quando tipo_peca === "SENTENCA". Complementa o StructuralValidator
// existente e o CriminalSentenceValidator (que cobre criminal especificamente).

import type { LegalClassification, ValidationError, ValidationResult } from "../pipeline/types.js";

const RELATORIO_RE = /relat[oó]rio/i;
const FUNDAMENTACAO_RE = /fundamenta[cç][aã]o/i;
const DISPOSITIVO_RE = /(dispositivo|ante\s+o\s+exposto|isso\s+posto|isto\s+posto|pelo\s+exposto)/i;
// Verbos dispositivos reconhecidos em SENTENÇA:
//   cível/trabalhista/previdenciário: julgo procedente/improcedente/extinto
//   penal de mérito: absolvo, condeno, declaro extinta a punibilidade, desclassifico
//   HC: concedo/denego a ordem   |   incidentais criminais: defiro/indefiro/revogo/mantenho
const DECISION_VERB_RE =
  /julgo\s+(procedente|improcedente|extinto|parcialmente)|absolvo|condeno|desclassifico|declaro\s+extinta?\s+a\s+punibilidade|concedo\s+(a\s+)?(parcial(mente)?\s+)?ordem|denego\s+(a\s+)?ordem|\bdefiro\b|\bindefiro\b|revogo\s+(a\s+)?pris[aã]o|mantenho\s+(a\s+)?pris[aã]o/i;
const RECURSO_RE = /(recurso\s+(ord[ií]n[aá]rio|cab[ií]vel|inominado|de\s+revista|em\s+sentido\s+estrito|especial|extraordin[aá]rio)|apela[cç][aã]o(\s+criminal)?|RO\b|RR\b|REsp\b|RE\b|APL\b|art\.\s*(593|895|1\.?009|1009|42)\s+(CPP|CLT|CPC|Lei\s*9\.?099))/i;

// Dispositivo genérico sem detalhamento de pedido ou benefício
const DISPOSITIVO_VAGUE_RE = /julgo\s+(procedente|improcedente|parcialmente\s+procedente)\s+o\s+pedido[.\s]*$/i;

// ── BLOCO 1: Contradição fundamentação × dispositivo ─────────────────────────
// Fundamentação com predominância de elementos favoráveis ao autor
const FUND_PRO_AUTOR_RE =
  /nulidad[e\s]+d[ae]\s+justa\s+causa|aus[eê]ncia\s+de\s+prova\s+(?:robusta|suficiente)?|falta\s+grave\s+n[aã]o\s+comprovad[ao]|insuficiência\s+probatória|revers[aã]o\s+d[ae]\s+(?:justa\s+causa|dispen[sc]a)|procedência\s+do\s+pedido|n[aã]o\s+(?:comprovou?|ficou\s+comprovad[ao]|restou\s+comprovad[ao])\s+a?\s*(?:falta|justa\s+causa)|aus[eê]ncia\s+de\s+gradação\s+d[ae]s?\s+penalidades?|aus[eê]ncia\s+de\s+imediatidade|gradação\s+(?:de\s+penalidades?\s+)?n[aã]o\s+(?:observad[ao]|comprovad[ao]|demonstrad[ao])|imediatidade\s+n[aã]o\s+(?:observad[ao]|comprovad[ao]|demonstrad[ao])|justa\s+causa\s+n[aã]o\s+(?:comprovad[ao]|configurad[ao]|demonstrad[ao])/i;

// Dispositivo julgando improcedente / mantendo a justa causa
const DISP_IMPROCEDENTE_RE =
  /julgo\s+(?:totalmente\s+)?improcedente[s]?\s+(?:os\s+)?pedidos?|indefiro\s+os\s+pedidos?|mantenho\s+a\s+justa\s+causa|rejeito\s+o\s+pedido|julgo\s+improcedente\s+a\s+reclamatória/i;

// Comprimentos mínimos das seções (mais rigorosos que antes)
const MIN_RELATORIO = 350;
const MIN_FUNDAMENTACAO = 600;
const MIN_DISPOSITIVO = 80;

export class SentencaValidator {
  validate(draft: string, classification: LegalClassification): ValidationResult {
    if (classification.tipo_peca !== "SENTENCA") return { valid: true, errors: [] };

    const errors: ValidationError[] = [];

    // Presença de Relatório, Fundamentação e Dispositivo é verificada pelo StructuralValidator
    // via STRUCTURAL_REQUIREMENTS["SENTENCA"] — duplicar aqui geraria double-fatal para o mesmo erro.
    // SentencaValidator foca nas verificações adicionais: verbo, recurso, comprimento, vaguidade.

    if (!DECISION_VERB_RE.test(draft)) {
      errors.push({
        rule: "SENTENCA_MISSING_DECISION_VERB",
        message: "Sentença deve conter verbo dispositivo (julgo/absolvo/condeno/concedo a ordem/denego a ordem)",
        fatal: true,
      });
    }

    if (!RECURSO_RE.test(draft)) {
      errors.push({
        rule: "SENTENCA_MISSING_APPEAL_REF",
        message: "Sentença deve indicar o recurso cabível com fundamento legal",
        fatal: false,
      });
    }

    // ── BLOCO 1: Contradição fundamentação × dispositivo (trabalhista) ──────────
    const sections = splitSections(draft);
    if (sections.fundamentacao && sections.dispositivo) {
      if (FUND_PRO_AUTOR_RE.test(sections.fundamentacao) && DISP_IMPROCEDENTE_RE.test(sections.dispositivo)) {
        errors.push({
          rule: "SENTENCE_REASONING_DISPOSITIVE_CONTRADICTION",
          message: "Possível contradição entre fundamentação e dispositivo: a fundamentação contém elementos favoráveis ao autor (nulidade da justa causa / ausência de prova / insuficiência probatória) mas o dispositivo julga improcedente. Verifique a coerência da sentença.",
          fatal: true,
        });
      }
    }

    // Dispositivo genérico sem identificar pedido ou benefício específico
    if (sections.dispositivo && DISPOSITIVO_VAGUE_RE.test(sections.dispositivo.trim())) {
      errors.push({
        rule: "SENTENCA_DISPOSITIVO_VAGUE",
        message: "Dispositivo genérico — deve identificar o pedido ou benefício específico (ex: concessão de auxílio-doença, reconhecimento do vínculo, etc.)",
        fatal: false,
      });
    }

    // Comprimento mínimo das seções — apenas se as marcas existem
    if (sections.relatorio && sections.relatorio.length < MIN_RELATORIO) {
      errors.push({
        rule: "SENTENCA_RELATORIO_TOO_SHORT",
        message: `Relatório muito curto (${sections.relatorio.length} chars) — deve conter síntese completa dos fatos e alegações (mínimo ~${MIN_RELATORIO} chars)`,
        fatal: false,
      });
    }
    if (sections.fundamentacao && sections.fundamentacao.length < MIN_FUNDAMENTACAO) {
      errors.push({
        rule: "SENTENCA_FUNDAMENTACAO_TOO_SHORT",
        message: `Fundamentação muito curta (${sections.fundamentacao.length} chars) — deve analisar cada tese com profundidade (mínimo ~${MIN_FUNDAMENTACAO} chars)`,
        fatal: false,
      });
    }
    if (sections.dispositivo && sections.dispositivo.length < MIN_DISPOSITIVO) {
      errors.push({
        rule: "SENTENCA_DISPOSITIVO_TOO_SHORT",
        message: "Dispositivo muito curto — deve resolver todos os pedidos com clareza",
        fatal: false,
      });
    }

    return { valid: !errors.some((e) => e.fatal), errors };
  }
}

function splitSections(draft: string): { relatorio?: string; fundamentacao?: string; dispositivo?: string } {
  const relatorioIdx = draft.search(RELATORIO_RE);
  const fundIdx = draft.search(FUNDAMENTACAO_RE);
  const dispIdx = draft.search(DISPOSITIVO_RE);
  const result: { relatorio?: string; fundamentacao?: string; dispositivo?: string } = {};
  if (relatorioIdx >= 0 && fundIdx > relatorioIdx) {
    result.relatorio = draft.slice(relatorioIdx, fundIdx);
  }
  if (fundIdx >= 0 && dispIdx > fundIdx) {
    result.fundamentacao = draft.slice(fundIdx, dispIdx);
  }
  if (dispIdx >= 0) {
    result.dispositivo = draft.slice(dispIdx);
  }
  return result;
}

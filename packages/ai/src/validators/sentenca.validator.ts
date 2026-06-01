// SentencaValidator — validação estrutural rigorosa de sentenças.
//
// Verifica:
//   - Presença de RELATÓRIO, FUNDAMENTAÇÃO e DISPOSITIVO
//   - Linguagem dispositiva adequada
//   - Indicação do recurso cabível
//   - Comprimento mínimo das seções
//
// Roda apenas quando tipo_peca === "SENTENCA". Complementa o StructuralValidator
// existente (que já checa "Excelentíssimo", "julgo", etc.).

import type { LegalClassification, ValidationError, ValidationResult } from "../pipeline/types.js";

const RELATORIO_RE = /relat[oó]rio/i;
const FUNDAMENTACAO_RE = /fundamenta[cç][aã]o/i;
const DISPOSITIVO_RE = /(dispositivo|ante\s+o\s+exposto|isso\s+posto|isto\s+posto|pelo\s+exposto)/i;
const DECISION_VERB_RE = /julgo\s+(procedente|improcedente|extinto|parcialmente)|absolvo|condeno|concedo\s+(a\s+)?(parcial(mente)?\s+)?ordem|denego\s+(a\s+)?ordem/i;
const RECURSO_RE = /(recurso\s+(ord[ií]n[aá]rio|cab[ií]vel|inominado|de\s+revista|em\s+sentido\s+estrito|especial|extraordin[aá]rio)|apela[cç][aã]o(\s+criminal)?|RO\b|RR\b|REsp\b|RE\b|APL\b|art\.\s*(593|895|1\.?009|1009|42)\s+(CPP|CLT|CPC|Lei\s*9\.?099))/i;

export class SentencaValidator {
  validate(draft: string, classification: LegalClassification): ValidationResult {
    if (classification.tipo_peca !== "SENTENCA") return { valid: true, errors: [] };

    const errors: ValidationError[] = [];

    if (!RELATORIO_RE.test(draft)) {
      errors.push({
        rule: "SENTENCA_MISSING_RELATORIO",
        message: "Sentença deve conter seção de Relatório",
        fatal: true,
      });
    }

    if (!FUNDAMENTACAO_RE.test(draft)) {
      errors.push({
        rule: "SENTENCA_MISSING_FUNDAMENTACAO",
        message: "Sentença deve conter seção de Fundamentação",
        fatal: true,
      });
    }

    if (!DISPOSITIVO_RE.test(draft)) {
      errors.push({
        rule: "SENTENCA_MISSING_DISPOSITIVO",
        message: "Sentença deve conter fórmula de Dispositivo (\"Ante o exposto\", \"Pelo exposto\", \"Dispositivo\")",
        fatal: true,
      });
    }

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

    // Tamanho mínimo das seções — apenas se as marcas existem
    const sections = splitSections(draft);
    if (sections.relatorio && sections.relatorio.length < 200) {
      errors.push({
        rule: "SENTENCA_RELATORIO_TOO_SHORT",
        message: "Relatório muito curto — deve conter síntese dos fatos e alegações (mínimo ~200 chars)",
        fatal: false,
      });
    }
    if (sections.fundamentacao && sections.fundamentacao.length < 400) {
      errors.push({
        rule: "SENTENCA_FUNDAMENTACAO_TOO_SHORT",
        message: "Fundamentação muito curta — deve analisar cada tese (mínimo ~400 chars)",
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

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

// Comprimentos mínimos das seções (mais rigorosos que antes)
const MIN_RELATORIO = 350;
const MIN_FUNDAMENTACAO = 600;
const MIN_DISPOSITIVO = 80;

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

    // Dispositivo genérico sem identificar pedido ou benefício específico
    const sections = splitSections(draft);
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

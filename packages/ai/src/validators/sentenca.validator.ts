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
const FUNDAMENTACAO_RE = /fundamenta[cç][aã]o|do\s+m[eé]rito|an[aá]lise\s+do\s+(?:caso|pedido)|da\s+guarda|da\s+situa[cç][aã]o/i;
const DISPOSITIVO_RE = /(dispositivo|ante\s+o\s+exposto|isso\s+posto|isto\s+posto|pelo\s+exposto|diante\s+do\s+exposto|(?:defiro|concedo|fixo)\s+a\s+guarda)/i;
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
    // ── BLOCO 3 (FASE 5.5): Contradição fundamentação × dispositivo — Família ─
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

    // FAMÍLIA: contradição entre fundamentação favorável a um genitor e dispositivo que concede a outro
    if (sections.fundamentacao && sections.dispositivo) {
      // Indicadores que a fundamentação aponta para a MÃE/GENITORA
      const FUND_FAV_MAE_RE = new RegExp(
        "laudo\\s+(?:psicológico|psicossocial|social)\\s+favorável\\s+(?:à|a)\\s*(?:mãe|genitora)" +
        "|vínculo\\s+afetivo\\s+(?:com|pela?)\\s+a?\\s*(?:mãe|genitora)" +
        "|ausência\\s+de\\s+incapacidade\\s+(?:materna|d[ae]\\s+(?:mãe|genitora))" +
        "|adaptação\\s+d[ae]\\s+crian[cç]a\\s+(?:com|junto|à)\\s+(?:mãe|genitora)" +
        // [\s\S] cruza quebras de linha; janela ampliada para 300 chars
        "|melhor\\s+interesse\\s+d[ae]\\s+crian[cç]a[\\s\\S]{0,300}(?:mãe|genitora)" +
        // Padrões sem "favorável": adaptação, vínculo, laudo aponta
        "|crian[cç]a\\s+(?:está|se\\s+encontra)\\s+(?:bem\\s+)?(?:adaptada?|vinculada?)[\\s\\S]{0,80}(?:mãe|genitora)" +
        "|laudo[\\s\\S]{0,100}(?:mãe|genitora)[\\s\\S]{0,100}(?:mais\\s+adequada?|mais\\s+apta?|melhor\\s+condição)",
        "i",
      );
      // Dispositivo concedendo guarda ao PAI — ambas as ordens (guarda...pai e pai...guarda)
      const DISP_GUARDA_PAI_RE = /(?:guarda[\s\S]{0,80}(?:pai\b|genitor\b)|(?:pai\b|genitor\b)[\s\S]{0,80}guarda)/i;

      // Indicadores que a fundamentação aponta para o PAI/GENITOR
      const FUND_FAV_PAI_RE = new RegExp(
        "laudo\\s+(?:psicológico|psicossocial|social)\\s+favorável\\s+ao?\\s*(?:pai|genitor)" +
        "|vínculo\\s+afetivo\\s+(?:com|pelo?)\\s+o?\\s*(?:pai|genitor)" +
        "|melhor\\s+interesse\\s+d[ae]\\s+crian[cç]a[\\s\\S]{0,300}(?:pai\\b|genitor\\b)" +
        "|crian[cç]a\\s+(?:está|se\\s+encontra)\\s+(?:bem\\s+)?(?:adaptada?|vinculada?)[\\s\\S]{0,80}(?:pai\\b|genitor\\b)",
        "i",
      );
      // Dispositivo concedendo guarda à MÃE — ambas as ordens
      const DISP_GUARDA_MAE_RE = /(?:guarda[\s\S]{0,80}(?:mãe\b|genitora\b)|(?:mãe\b|genitora\b)[\s\S]{0,80}guarda)/i;

      const fundFavMae = FUND_FAV_MAE_RE.test(sections.fundamentacao);
      const fundFavPai = FUND_FAV_PAI_RE.test(sections.fundamentacao);
      const dispPai    = DISP_GUARDA_PAI_RE.test(sections.dispositivo);
      const dispMae    = DISP_GUARDA_MAE_RE.test(sections.dispositivo);

      if ((fundFavMae && dispPai) || (fundFavPai && dispMae)) {
        errors.push({
          rule: "FAMILY_REASONING_DISPOSITIVE_CONTRADICTION",
          message: "Possível contradição em questão de guarda: a fundamentação aponta predominantemente para um genitor mas o dispositivo concede a guarda ao outro. Verificar coerência da sentença com o melhor interesse da criança.",
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

import type { ValidationError } from "../pipeline/types.js";

// Expressões genuinamente genéricas que indicam fundamentação vaga.
// Removidas propositalmente: "caso concreto", "legislação aplicável", "normas pertinentes"
// — são locuções padrão do português jurídico e não sinalizam fraqueza argumentativa.
const BANNED_EXPRESSIONS = [
  "direito alegado",
  "pretensão da parte",
  "reconhecimento do direito",
  "matéria cível",
];

const TUTELA_KEYWORDS_RE = /previdenci|pensão\s+por\s+morte|benefício|servidor\s+públic|alimentar|saúde|remuneratório|salarial|vencimentos|proventos|aposentadori|paridade|reajuste/i;

// Detector de seções temáticas — reconhece os padrões mais comuns usados pelo pipeline:
//   "Tese 1"        — numeração literal com prefixo "Tese"
//   "1. Título"     — numeração árabe + ponto + título
//   "I — Título"    — numeração romana + separador
//   "DA SEÇÃO"      — cabeçalho em caixa alta estilo DA/DO/DOS/DAS
// O count precisa ≥ 2 para indicar fundamentação estruturada.
const SECTION_MARKERS_RE = /\bTese\s+\d+|^\s*\d+\.\s+\S|^\s*[IVX]+\s*[.—\-\):;]|^\s*D[AO]S?\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚ]{3}/gim;

export interface RichnessContext {
  tipo_peca?: string | undefined;
  regime_juridico?: string | null | undefined;
  assunto_principal?: string | undefined;
  pedidos?: string[] | undefined;
}

export class RichnessValidator {
  validate(draft: string, ctx?: RichnessContext): ValidationError[] {
    const errors: ValidationError[] = [];
    const lower = draft.toLowerCase();

    for (const expr of BANNED_EXPRESSIONS) {
      if (lower.includes(expr)) {
        errors.push({
          rule: "FINAL_DRAFT_WEAK_ARGUMENTATION",
          message: `Expressão genérica proibida em FINAL_DRAFT: "${expr}"`,
          fatal: false,
        });
      }
    }

    const hasNorms = /\bart\.\s*\d+|\bartigo\s+\d+/i.test(draft);
    if (!hasNorms) {
      errors.push({
        rule: "FINAL_DRAFT_WEAK_ARGUMENTATION",
        message: "Nenhuma norma específica (art. N) encontrada — fundamentação insuficiente",
        fatal: false,
      });
    }

    // Conta seções temáticas usando detector ampliado (qualquer formato de numeração/título)
    const teseSections = (draft.match(SECTION_MARKERS_RE) ?? []).length;
    if (teseSections < 2) {
      const normCount = (draft.match(/\bart\.\s*\d+/gi) ?? []).length;
      if (normCount < 3) {
        errors.push({
          rule: "FINAL_DRAFT_WEAK_ARGUMENTATION",
          message: "Fundamentação fraca — menos de 2 seções temáticas desenvolvidas e menos de 3 normas citadas",
          fatal: false,
        });
      }
    }

    if (ctx?.tipo_peca === "PETICAO_INICIAL") {
      errors.push(...this.validatePeticaoInicial(draft, ctx));
    }

    return errors;
  }

  private validatePeticaoInicial(draft: string, ctx: RichnessContext): ValidationError[] {
    const errors: ValidationError[] = [];

    // Localiza a seção DO DIREITO e conta subtópicos
    const direitoMatch = /do\s+direito[\s\r\n]/i.exec(draft);
    if (direitoMatch && direitoMatch.index !== undefined) {
      const start = direitoMatch.index + direitoMatch[0].length;
      const rest = draft.slice(start);
      const nextSection = /dos\s+pedidos|do\s+valor\s+da\s+causa|dos\s+requerimentos/i.exec(rest);
      const direitoSection = nextSection ? rest.slice(0, nextSection.index) : rest;

      // Conta subtópicos usando o mesmo detector ampliado (romano, árabe ou caixa alta)
      const subtopicCount = (direitoSection.match(SECTION_MARKERS_RE) ?? []).length;
      if (subtopicCount < 6) {
        errors.push({
          rule: "FINAL_DRAFT_WEAK_ARGUMENTATION",
          message: `Seção DO DIREITO contém apenas ${subtopicCount} subtópico(s) — PETICAO_INICIAL FINAL_DRAFT exige no mínimo 6 subtópicos jurídicos`,
          fatal: false,
        });
      }
    }

    // Verifica tutela de urgência para casos alimentares/previdenciários/remuneratórios
    if (this.needsTutelaUrgencia(ctx)) {
      const hasTutela = /tutela\s+de\s+urgência|tutela\s+urgente|tutela\s+antecipada/i.test(draft);
      if (!hasTutela) {
        errors.push({
          rule: "FINAL_DRAFT_WEAK_ARGUMENTATION",
          message: "Seção DA TUTELA DE URGÊNCIA ausente — caso alimentar/previdenciário/remuneratório exige tutela estruturada (art. 300 CPC/2015)",
          fatal: false,
        });
      }
    }

    return errors;
  }

  private needsTutelaUrgencia(ctx: RichnessContext): boolean {
    if (["RPPS", "RGPS"].includes(ctx.regime_juridico ?? "")) return true;
    const combined = [ctx.assunto_principal ?? "", ...(ctx.pedidos ?? [])].join(" ");
    return TUTELA_KEYWORDS_RE.test(combined);
  }
}

import type { LegalClassification, LegalExtraction, ValidationResult, ValidationError } from "./types.js";
import { FORBIDDEN_COMBINATIONS, LEGAL_RULES } from "../rules/legal_rules.js";

export class LegalValidator {
  validateClassification(classification: LegalClassification): ValidationResult {
    const errors: ValidationError[] = [];

    if (!classification.tipo_justica) {
      errors.push({ rule: "REQUIRED_FIELD", message: "tipo_justica é obrigatório", fatal: true });
    }
    if (!classification.tipo_peca) {
      errors.push({ rule: "REQUIRED_FIELD", message: "tipo_peca é obrigatório", fatal: true });
    }
    if (!classification.regime_juridico && !["DESPACHO", "DECISAO"].includes(classification.tipo_peca)) {
      errors.push({ rule: "REQUIRED_FIELD", message: "regime_juridico não identificado — verifique o caso", fatal: false });
    }
    if (classification.confianca < 0.5) {
      errors.push({ rule: "LOW_CONFIDENCE", message: `Confiança baixa na classificação: ${classification.confianca}`, fatal: false });
    }

    for (const combo of FORBIDDEN_COMBINATIONS) {
      const matchJustica = !("condicao_justica" in combo) || combo.condicao_justica === classification.tipo_justica;
      const matchRegime = !("condicao_regime" in combo) || combo.condicao_regime === classification.regime_juridico;
      if (matchJustica && matchRegime) {
        errors.push({ rule: combo.id, message: ("erro" in combo ? (combo as {erro: string}).erro : combo.descricao), fatal: combo.fatal });
      }
    }

    return { valid: !errors.some((e) => e.fatal), errors };
  }

  validateDraftAgainstRules(draft: string, classification: LegalClassification): ValidationResult {
    const errors: ValidationError[] = [];
    const lowerDraft = draft.toLowerCase();

    const rules = LEGAL_RULES[classification.tipo_justica];
    for (const blocked of rules.artigos_bloqueados) {
      if (lowerDraft.includes(blocked.toLowerCase())) {
        errors.push({
          rule: "BLOCKED_ARTICLE",
          message: `"${blocked}" está bloqueado para ${classification.tipo_justica}`,
          fatal: false,
        });
      }
    }

    const pieceProhibitions: Record<string, string[]> = {
      SENTENCA: ["excelentíssimo"],
      DECISAO: ["excelentíssimo"],
      DESPACHO: ["excelentíssimo"],
    };

    const prohibitions = pieceProhibitions[classification.tipo_peca] ?? [];
    for (const term of prohibitions) {
      if (lowerDraft.includes(term)) {
        errors.push({
          rule: "PROHIBITED_TERM",
          message: `"${term}" está proibido em ${classification.tipo_peca}`,
          fatal: false,
        });
      }
    }

    return { valid: errors.filter((e) => e.fatal).length === 0, errors };
  }

  validateJurisprudenciaRelevance(
    jurisprudenciaId: string,
    jurisprudenciasTema: string,
    classificationAssunto: string,
  ): boolean {
    const tema = jurisprudenciasTema.toLowerCase();
    const assunto = classificationAssunto.toLowerCase();
    const keywords = assunto.split(/\s+/).filter((w) => w.length > 4);
    return keywords.some((kw) => tema.includes(kw));
  }
}

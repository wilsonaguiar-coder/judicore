import type { LegalClassification, LegalExtraction, ValidationResult, ValidationError, TipoPeca } from "./types.js";
import { FORBIDDEN_COMBINATIONS, STRUCTURAL_REQUIREMENTS, GENERIC_EXPRESSIONS, getJurisdicaoRules } from "../rules/legal_rules.js";

export class LegalValidator {
  validateClassification(classification: LegalClassification): ValidationResult {
    const errors: ValidationError[] = [];

    if (!classification.tipo_justica) {
      errors.push({ rule: "REQUIRED_FIELD", message: "tipo_justica é obrigatório", fatal: true });
    }
    if (!classification.tipo_peca) {
      errors.push({ rule: "REQUIRED_FIELD", message: "tipo_peca é obrigatório", fatal: true });
    }
    if (
      !classification.regime_juridico &&
      !["DESPACHO", "DECISAO"].includes(classification.tipo_peca) &&
      classification.tipo_justica !== "INDETERMINADA"
    ) {
      errors.push({ rule: "REQUIRED_FIELD", message: "regime_juridico não identificado — verifique o caso", fatal: false });
    }
    if (classification.confianca < 0.5) {
      errors.push({ rule: "LOW_CONFIDENCE", message: `Confiança muito baixa na classificação: ${classification.confianca}`, fatal: false });
    }

    for (const combo of FORBIDDEN_COMBINATIONS) {
      const matchJustica = !("condicao_justica" in combo) || combo.condicao_justica === classification.tipo_justica;
      const matchRegime = !("condicao_regime" in combo) || combo.condicao_regime === classification.regime_juridico;
      if (matchJustica && matchRegime) {
        const c = combo as unknown as { id: string; fatal: boolean; erro?: string; descricao_erro?: string; descricao?: string };
        const msg = c.erro ?? c.descricao_erro ?? c.descricao ?? c.id;
        errors.push({ rule: combo.id, message: msg, fatal: combo.fatal });
      }
    }

    return { valid: !errors.some((e) => e.fatal), errors };
  }

  validateDraftAgainstRules(draft: string, classification: LegalClassification): ValidationResult {
    const errors: ValidationError[] = [];
    const lowerDraft = draft.toLowerCase();

    // Check blocked articles/terms for this jurisdiction
    const rules = getJurisdicaoRules(classification.tipo_justica);
    for (const blocked of rules.artigos_bloqueados) {
      if (lowerDraft.includes(blocked.toLowerCase())) {
        errors.push({
          rule: "BLOCKED_ARTICLE",
          message: `"${blocked}" está bloqueado para ${classification.tipo_justica}`,
          fatal: classification.tipo_justica === "TRABALHO" && ["apelação", "apelação cível"].includes(blocked.toLowerCase()),
        });
      }
    }

    // Check piece-specific prohibitions
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
          fatal: true,
        });
      }
    }

    return { valid: errors.filter((e) => e.fatal).length === 0, errors };
  }

  validateStructure(draft: string, tipoPeca: TipoPeca): ValidationResult {
    const errors: ValidationError[] = [];
    const reqs = STRUCTURAL_REQUIREMENTS[tipoPeca];
    if (!reqs) return { valid: true, errors: [] };

    for (const req of reqs.required_text_patterns) {
      if (!req.pattern.test(draft)) {
        errors.push({
          rule: "MISSING_STRUCTURE",
          message: `${tipoPeca} deve conter: ${req.label}`,
          fatal: req.fatal,
        });
      }
    }

    for (const req of reqs.required_structural_patterns) {
      if (!req.pattern.test(draft)) {
        errors.push({
          rule: "MISSING_STRUCTURE",
          message: `${tipoPeca} deve conter: ${req.label}`,
          fatal: req.fatal,
        });
      }
    }

    for (const forbidden of reqs.forbidden_patterns) {
      if (forbidden.pattern.test(draft)) {
        errors.push({
          rule: "FORBIDDEN_STRUCTURE",
          message: forbidden.label,
          fatal: forbidden.fatal,
        });
      }
    }

    return { valid: !errors.some((e) => e.fatal), errors };
  }

  detectGenericContent(draft: string): ValidationError[] {
    const errors: ValidationError[] = [];
    let genericCount = 0;

    for (const expr of GENERIC_EXPRESSIONS) {
      if (expr.pattern.test(draft)) {
        genericCount++;
        errors.push({
          rule: "PECA_GENERICA",
          message: expr.label,
          fatal: false,
        });
      }
    }

    if (genericCount >= 3) {
      errors.push({
        rule: "PECA_GENERICA",
        message: `Peça com conteúdo excessivamente genérico (${genericCount} expressões detectadas) — pode não corresponder ao caso real`,
        fatal: false,
      });
    }

    return errors;
  }

  validateExtractionSufficiency(extraction: LegalExtraction): ValidationResult {
    const errors: ValidationError[] = [];

    if (extraction.fatos.length < 2) {
      errors.push({
        rule: "INSUFFICIENT_FACTS",
        message: `Apenas ${extraction.fatos.length} fato(s) extraído(s) — mínimo 2 necessários para peça final`,
        fatal: false,
      });
    }

    if (extraction.pedidos.length < 1) {
      errors.push({
        rule: "MISSING_REQUESTS",
        message: "Nenhum pedido identificado — impossível gerar peça final",
        fatal: false,
      });
    }

    if (extraction.qualidade_extracao === "INSUFICIENTE") {
      errors.push({
        rule: "EXTRACTION_QUALITY",
        message: `Qualidade de extração insuficiente: ${extraction.motivo_qualidade ?? "caso muito vago"}`,
        fatal: false,
      });
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

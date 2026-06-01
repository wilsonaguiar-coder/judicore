import type { LegalClassification, ValidationError, ValidationResult } from "../pipeline/types.js";
import { FORBIDDEN_COMBINATIONS, CRIMINAL_BLOCKED_TERMS, getJurisdicaoRules } from "../rules/legal_rules.js";

export class LegalRulesValidator {
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
      const matchJustica = !combo.condicao_justica || combo.condicao_justica === classification.tipo_justica;
      const matchRegime = !combo.condicao_regime || combo.condicao_regime === classification.regime_juridico;
      if (matchJustica && matchRegime) {
        const msg = combo.erro ?? combo.descricao_erro ?? combo.descricao;
        errors.push({ rule: combo.id, message: msg, fatal: combo.fatal });
      }
    }

    return { valid: !errors.some((e) => e.fatal), errors };
  }

  validateDraftArticles(draft: string, classification: LegalClassification): ValidationResult {
    const errors: ValidationError[] = [];
    const lowerDraft = draft.toLowerCase();
    const rules = getJurisdicaoRules(classification.tipo_justica);

    for (const blocked of rules.artigos_bloqueados) {
      if (lowerDraft.includes(blocked.toLowerCase())) {
        const isFatal = classification.tipo_justica === "TRABALHO" &&
          ["apelação", "apelação cível"].includes(blocked.toLowerCase());
        errors.push({
          rule: "BLOCKED_ARTICLE",
          message: `"${blocked}" está bloqueado para ${classification.tipo_justica}`,
          fatal: isFatal,
        });
      }
    }

    // Bloquear honorários do CPC em matéria trabalhista
    if (classification.tipo_justica === "TRABALHO" && lowerDraft.includes("art. 85 cpc")) {
      errors.push({
        rule: "WRONG_HONORARIOS",
        message: "Honorários trabalhistas regidos pelo art. 791-A CLT, não pelo art. 85 CPC",
        fatal: true,
      });
    }

    // Bloquear honorários do CPC em matéria criminal
    if (
      (classification.tipo_justica === "CRIMINAL" || classification.regime_juridico === "CRIMINAL") &&
      lowerDraft.includes("art. 85 cpc")
    ) {
      errors.push({
        rule: "WRONG_HONORARIOS_CRIMINAL",
        message: "Em matéria criminal não há honorários advocatícios — não citar art. 85 CPC",
        fatal: false,
      });
    }

    // Bloquear art. 201 CF em regime RPPS
    if (classification.regime_juridico === "RPPS" && /art\.\s*201\s*(da\s*)?(CF|Constitui[cç][aã]o\s+Federal)/i.test(draft)) {
      errors.push({
        rule: "RPPS_WRONG_ARTICLE",
        message: "Regime RPPS usa art. 40 CF/88 — art. 201 CF regula RGPS (INSS)",
        fatal: true,
      });
    }

    // Bloquear art. 40 CF em regime RGPS
    if (classification.regime_juridico === "RGPS" && /art\.\s*40\s*(da\s*)?(CF|Constitui[cç][aã]o\s+Federal)/i.test(draft)) {
      errors.push({
        rule: "RGPS_WRONG_ARTICLE",
        message: "Regime RGPS usa art. 201 CF/88 — art. 40 CF regula RPPS (servidor público)",
        fatal: true,
      });
    }

    // Bloquear termos cíveis em matéria criminal (julgo procedente/improcedente são erros graves em processo penal)
    if (classification.tipo_justica === "CRIMINAL" || classification.regime_juridico === "CRIMINAL") {
      for (const term of CRIMINAL_BLOCKED_TERMS) {
        if (lowerDraft.includes(term.toLowerCase())) {
          errors.push({
            rule: "CRIMINAL_WRONG_TERM",
            message: `"${term}" é termo proibido em matéria criminal — use linguagem processual penal (ABSOLVO/CONDENO em sentença; concedo/denego a ordem em HC)`,
            fatal: ["julgo procedente", "julgo improcedente", "julgo parcialmente procedente"].includes(term),
          });
        }
      }
    }

    // Proibições por tipo de peça
    const pieceProhibitions: Record<string, string[]> = {
      SENTENCA: ["excelentíssimo"],
      DECISAO: ["excelentíssimo"],
      DESPACHO: ["excelentíssimo"],
    };
    for (const term of (pieceProhibitions[classification.tipo_peca] ?? [])) {
      if (lowerDraft.includes(term)) {
        errors.push({ rule: "PROHIBITED_TERM", message: `"${term}" proibido em ${classification.tipo_peca}`, fatal: true });
      }
    }

    return { valid: errors.filter((e) => e.fatal).length === 0, errors };
  }
}

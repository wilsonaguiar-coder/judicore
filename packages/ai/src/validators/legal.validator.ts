import type { LegalClassification, ValidationError, ValidationResult } from "../pipeline/types.js";
import { FORBIDDEN_COMBINATIONS, CRIMINAL_BLOCKED_TERMS, getJurisdicaoRules } from "../rules/legal_rules.js";
import { detectArticleContext } from "./article-context.js";

export class LegalRulesValidator {
  validateClassification(classification: LegalClassification): ValidationResult {
    const errors: ValidationError[] = [];

    if (!classification.tipo_justica) {
      errors.push({ rule: "REQUIRED_FIELD", message: "Tipo de justiça não identificado — verifique o caso", fatal: true });
    }
    if (!classification.tipo_peca) {
      errors.push({ rule: "REQUIRED_FIELD", message: "Tipo de peça não identificado — verifique o documento", fatal: true });
    }
    if (
      !classification.regime_juridico &&
      !["DESPACHO", "DECISAO"].includes(classification.tipo_peca) &&
      classification.tipo_justica !== "INDETERMINADA"
    ) {
      errors.push({ rule: "REQUIRED_FIELD", message: "regime_juridico não identificado — verifique o caso", fatal: false });
    }
    if (classification.confianca < 0.5) {
      errors.push({ rule: "LOW_CONFIDENCE", message: "Documento com baixa confiança de classificação — os resultados podem ser menos precisos", fatal: false });
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
        fatal: true,
      });
    }

    // Validação contextual de artigos previdenciários:
    //   DIRECT_FOUNDATION → fatal (uso direto errado, ex: RPPS com fundamento no art. 201)
    //   DISTINCTION       → sem erro (uso para contrastar RPPS vs RGPS é legítimo)
    //   AMBIGUOUS         → aviso não fatal (revisar manualmente)
    if (classification.regime_juridico === "RPPS") {
      const ctx = detectArticleContext(draft, "201");
      if (ctx === "DIRECT_FOUNDATION") {
        errors.push({
          rule: "RPPS_WRONG_ARTICLE",
          message: "Art. 201 CF está sendo usado como fundamento direto, mas o caso é RPPS — use art. 40 CF/88",
          fatal: true,
        });
      } else if (ctx === "AMBIGUOUS") {
        errors.push({
          rule: "RPPS_WRONG_ARTICLE",
          message: "Art. 201 CF citado em caso RPPS — confirme se é uso distintivo (RGPS) ou erro de fundamentação",
          fatal: false,
        });
      }
      // DISTINCTION ou NOT_PRESENT → silencioso
    }

    if (classification.regime_juridico === "RGPS") {
      const ctx = detectArticleContext(draft, "40");
      if (ctx === "DIRECT_FOUNDATION") {
        errors.push({
          rule: "RGPS_WRONG_ARTICLE",
          message: "Art. 40 CF está sendo usado como fundamento direto, mas o caso é RGPS — use art. 201 CF/88",
          fatal: true,
        });
      } else if (ctx === "AMBIGUOUS") {
        errors.push({
          rule: "RGPS_WRONG_ARTICLE",
          message: "Art. 40 CF citado em caso RGPS — confirme se é uso distintivo (RPPS) ou erro de fundamentação",
          fatal: false,
        });
      }
    }

    // Bloquear termos cíveis em matéria criminal
    if (classification.tipo_justica === "CRIMINAL" || classification.regime_juridico === "CRIMINAL") {
      // "julgo procedente/improcedente" é civil — mas se o draft já contém verbo penal correto
      // (CONDENO/ABSOLVO/DECLARO EXTINTA/DESCLASSIFICO), é WARNING não-fatal (mix de linguagem).
      // Fatal apenas quando não há verbo penal adequado (linguagem exclusivamente cível).
      const CIVIL_JUDGMENT_TERMS = ["julgo procedente", "julgo improcedente", "julgo parcialmente procedente"];
      const PENAL_VERBS = ["condeno", "absolvo", "declaro extinta", "desclassifico", "concedo a ordem", "denego a ordem"];
      const hasPenalVerb = PENAL_VERBS.some((v) => lowerDraft.includes(v));

      // Padrão de negação/exclusão antes do termo (contexto de até 160 chars)
      // — o AI frequentemente escreve "Não há honorários advocatícios" ou
      //   "Deixo de aplicar honorários advocatícios", que é linguagem CORRETA
      const NEGATION_BEFORE_RE = /n[ãa]o\s+h[aá]|deixo\s+de|sem\s+condena|n[ãa]o\s+cabe|isento|inexist|ausente|vedado|inaplicável/i;

      for (const term of CRIMINAL_BLOCKED_TERMS) {
        const termLower = term.toLowerCase();
        const termIdx = lowerDraft.indexOf(termLower);
        if (termIdx === -1) continue;

        // Para "honorários advocatícios": verificar contexto de negação antes do termo
        // Se precedido de "não há", "deixo de aplicar", etc. → não é erro, é linguagem correta
        if (termLower === "honorários advocatícios") {
          const contextBefore = lowerDraft.slice(Math.max(0, termIdx - 160), termIdx);
          if (NEGATION_BEFORE_RE.test(contextBefore)) continue;
        }

        const isCivilJudgment = CIVIL_JUDGMENT_TERMS.includes(term);
        errors.push({
          rule: "CRIMINAL_WRONG_TERM",
          message: `"${term}" é termo proibido em matéria criminal — use linguagem processual penal (ABSOLVO/CONDENO em sentença; concedo/denego a ordem em HC)`,
          fatal: isCivilJudgment ? !hasPenalVerb : false,
        });
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
        errors.push({ rule: "PROHIBITED_TERM", message: `Termo "${term}" não é adequado para este tipo de peça`, fatal: true });
      }
    }

    return { valid: errors.filter((e) => e.fatal).length === 0, errors };
  }
}

import type {
  LegalClassification,
  LegalExtraction,
  ArgumentationMatrix,
  LegalAudit,
  JurisprudenciaInput,
  EvidenceAnalysis,
  ValidationError,
} from "../pipeline/types.js";
import type { FinalValidationResult } from "../validators/index.js";
import type { StanceAnalysis } from "../stance/stance-types.js";
import { DomainRichnessAnalyzer } from "../validators/domain-richness/domain-richness.analyzer.js";
import type {
  AuditReport,
  AuditItem,
  AuditClassificacao,
  AuditClassificacaoFinal,
  FundamentacaoJuridicaItem,
  QualidadeScore,
  ConsistenciaArgumentativa,
  QualidadeArgumentativa,
} from "./audit-report.types.js";

// ── Categorias de regras por validator ───────────────────────────────────────

const STRUCTURAL_RULES = new Set([
  "MISSING_STRUCTURE", "DESPACHO_WITH_DECISION_LANGUAGE", "FORBIDDEN_STRUCTURE",
  "SENTENCA_MISSING_RELATORIO", "SENTENCA_MISSING_FUNDAMENTACAO", "SENTENCA_MISSING_DISPOSITIVO",
  "SENTENCA_MISSING_DECISION_VERB", "SENTENCA_MISSING_APPEAL_REF", "SENTENCA_RELATORIO_TOO_SHORT",
  "SENTENCA_FUNDAMENTACAO_TOO_SHORT", "SENTENCA_DISPOSITIVO_TOO_SHORT", "SENTENCA_DISPOSITIVO_VAGUE",
  "HC_MISSING_ORDER_VERB", "HC_WRONG_DISPOSITIVO",
]);

const APPEAL_RULES = new Set([
  "INCOMPATIBLE_APPEAL", "WRONG_SUPERIOR_COURT", "JEF_JEC_WRONG_APPEAL",
  "CRIMINAL_WRONG_APPEAL", "CRIMINAL_MISSING_APPEAL_REF",
]);

const PROBATORY_RULES = new Set([
  "JUR_MARKER_IN_DRAFT", "GENERIC_JURISPRUDENCE", "TRIBUNAL_MISMATCH",
  "EVIDENCE_STANCE_VIOLATION", "EVIDENCE_STANCE_MATRIX",
]);

const STANCE_RULES = new Set([
  "STANCE_CONTRADICTION_RPPS", "STANCE_CONTRADICTION_RGPS", "STANCE_CONTRADICTION_JEF",
  "STANCE_MISMATCH_PRE_GENERATION",
]);

const ARGUMENTATIVE_RULES = new Set([
  "FINAL_DRAFT_WEAK_ARGUMENTATION", "FINAL_DRAFT_GENERIC_LANGUAGE",
  "MATRIX_MISSING_RATIO", "MATRIX_NO_CONTRAPONTO", "MATRIX_WEAK_TESE", "MATRIX_INSUFFICIENT_TESES",
]);

// ── Mapeamento de regras para títulos humanizados ─────────────────────────────

const RULE_TITLES: Record<string, string> = {
  MISSING_STRUCTURE: "Estrutura incompleta",
  DESPACHO_WITH_DECISION_LANGUAGE: "Linguagem decisória em despacho",
  FORBIDDEN_STRUCTURE: "Elemento proibido para o tipo de peça",
  SENTENCA_MISSING_RELATORIO: "Relatório ausente na sentença",
  SENTENCA_MISSING_FUNDAMENTACAO: "Fundamentação ausente na sentença",
  SENTENCA_MISSING_DISPOSITIVO: "Dispositivo ausente na sentença",
  SENTENCA_DISPOSITIVO_VAGUE: "Dispositivo vago — resultado não identificável",
  INCOMPATIBLE_APPEAL: "Recurso incompatível com o rito",
  WRONG_SUPERIOR_COURT: "Tribunal superior incorreto",
  JEF_JEC_WRONG_APPEAL: "Via recursal incorreta no JEF/JEC",
  JUR_MARKER_IN_DRAFT: "Marcadores de jurisprudência não substituídos",
  GENERIC_JURISPRUDENCE: "Citação jurisprudencial genérica",
  TRIBUNAL_MISMATCH: "Tribunal citado incompatível com a competência",
  EVIDENCE_STANCE_VIOLATION: "Jurisprudência contrária sem distinguishing",
  EVIDENCE_STANCE_MATRIX: "Uso indevido de jurisprudência contrária como fundamento",
  STANCE_CONTRADICTION_RPPS: "Contradição com entendimento consolidado — RPPS",
  STANCE_CONTRADICTION_RGPS: "Contradição com entendimento consolidado — RGPS",
  STANCE_CONTRADICTION_JEF: "Contradição com entendimento consolidado — JEF",
  STANCE_MISMATCH_PRE_GENERATION: "Contradição posicional detectada antes da geração",
  FINAL_DRAFT_WEAK_ARGUMENTATION: "Riqueza argumentativa abaixo do mínimo",
  FINAL_DRAFT_GENERIC_LANGUAGE: "Linguagem excessivamente genérica",
  RPPS_WRONG_ARTICLE: "Artigo incorreto para o regime RPPS",
  RGPS_WRONG_ARTICLE: "Artigo incorreto para o regime RGPS",
  WRONG_HONORARIOS: "Base de cálculo dos honorários incorreta",
  BLOCKED_ARTICLE: "Dispositivo revogado ou inaplicável citado",
  PROHIBITED_TERM: "Termo proibido identificado",
  JEF_VALOR_EXCEDENTE: "Valor da causa supera o limite de competência do JEF",
  JEF_RECURSO_ERRADO: "Via recursal incorreta — JEF exige Recurso Inominado",
  JEF_PERICIA_COMPLEXA: "Perícia complexa incompatível com o rito dos Juizados",
  JEF_ENDERECAMENTO_ERRADO: "Endereçamento do recurso incorreto",
  JEF_PRAZO_ERRADO: "Prazo recursal incorreto para o JEF",
  JEF_PREPARO_ERRADO: "Preparo recursal desnecessário no JEF",
  JEF_PEDIDO_INCOMPATIVEL: "Pedido incompatível com o rito dos Juizados",
  TUTELA_MISSING_ART300: "Tutela de urgência sem fundamento no art. 300 CPC",
  TUTELA_MISSING_PERICULUM_MORA: "Periculum in mora não demonstrado na tutela",
  CDC_APPLICATION_MISSING: "Aplicação do CDC não fundamentada",
  INVERSAO_ONUS_SEM_FUNDAMENTO: "Inversão do ônus da prova sem fundamento",
  DANO_MORAL_SEM_ANALISE_CONCRETA: "Dano moral sem análise concreta do caso",
  EXECUTION_MISSING_SECTION: "Seção obrigatória ausente na execução",
  EXECUTION_MISSING_CPC_BASIS: "Base legal CPC da execução ausente",
  EXECUTION_MISSING_MODALITY: "Modalidade executiva não especificada",
  EXECUTION_SISBAJUD_MISSING: "Pedido de SISBAJUD ausente na execução",
  MATRIX_INSUFFICIENT_TESES: "Número de teses insuficiente na matriz argumentativa",
  MATRIX_MISSING_RATIO: "Ratio decidendi ausente em uma ou mais teses",
  MATRIX_NO_CONTRAPONTO: "Tese sem contraponto identificado",
  MATRIX_WEAK_TESE: "Tese argumentativa fraca ou incompleta",
};

// ── Mapeamento de regras para sugestões de melhoria ──────────────────────────

const RULE_SUGGESTIONS: Record<string, string> = {
  MISSING_STRUCTURE: "Adicionar as seções faltantes seguindo a estrutura exigida para o tipo de peça.",
  FINAL_DRAFT_WEAK_ARGUMENTATION: "Citar mais artigos de lei, desenvolver seções argumentativas distintas e incluir jurisprudência específica ao caso.",
  FINAL_DRAFT_GENERIC_LANGUAGE: "Substituir as expressões genéricas por argumentação fundada nos fatos concretos do caso.",
  EVIDENCE_STANCE_VIOLATION: "Aplicar distinguishing explícito ao precedente contrário ou usá-lo para fundamentar a improcedência do pedido.",
  JUR_MARKER_IN_DRAFT: "Substituir os marcadores [JUR_X] por citações completas com tribunal, número e ementa.",
  GENERIC_JURISPRUDENCE: "Substituir citações genéricas por precedentes específicos identificando tribunal, número e data.",
  TRIBUNAL_MISMATCH: "Adequar o tribunal ao grau e à competência do caso.",
  WRONG_HONORARIOS: "Corrigir a base de cálculo dos honorários conforme o art. 85 CPC/2015.",
  TUTELA_MISSING_ART300: "Incluir seção DA TUTELA DE URGÊNCIA com fundamentos no art. 300 CPC/2015.",
  JEF_VALOR_EXCEDENTE: "Reduzir o valor da causa ao limite de competência do JEF ou ajuizar na justiça comum.",
  JEF_RECURSO_ERRADO: "Utilizar o Recurso Inominado (art. 41 Lei 9.099/95 / art. 17 Lei 10.259/01) para impugnar decisões do JEF.",
  JEF_PERICIA_COMPLEXA: "Indicar o desnível probatório e requerer a remessa à Justiça Comum ou simplificar o objeto da prova.",
  STANCE_CONTRADICTION_RPPS: "Revisar o entendimento sobre paridade/integralidade no RPPS à luz da EC 41 e da jurisprudência STF.",
  STANCE_CONTRADICTION_RGPS: "Revisar os requisitos do benefício previdenciário à luz do entendimento STJ/TNU.",
  BLOCKED_ARTICLE: "Substituir o dispositivo revogado pelo normativo vigente aplicável.",
  CDC_APPLICATION_MISSING: "Fundamentar expressamente a aplicação do CDC, identificando fornecedor, consumidor e relação de consumo.",
  EXECUTION_MISSING_SECTION: "Incluir seção específica sobre a modalidade executiva e os meios de satisfação do crédito.",
  EXECUTION_SISBAJUD_MISSING: "Requerer expressamente a penhora via SISBAJUD como primeira medida executiva (art. 854 CPC).",
  MATRIX_INSUFFICIENT_TESES: "Desenvolver uma tese argumentativa completa para cada pedido formulado na peça.",
  MATRIX_WEAK_TESE: "Aprimorar a ratio decidendi das teses, conectando fato, norma e consequência jurídica.",
};

// ── Mapeamento de regras para riscos processuais ──────────────────────────────

const RULE_RISKS: Record<string, { titulo: string; descricao: string }> = {
  JEF_VALOR_EXCEDENTE: {
    titulo: "Incompetência Absoluta",
    descricao: "O valor da causa supera o limite do JEF. A ação pode ser extinta sem julgamento do mérito por incompetência absoluta.",
  },
  JEF_RECURSO_ERRADO: {
    titulo: "Inadmissão de Recurso",
    descricao: "A via recursal utilizada não é compatível com o rito dos Juizados. O recurso poderá não ser conhecido.",
  },
  INCOMPATIBLE_APPEAL: {
    titulo: "Não Conhecimento do Recurso",
    descricao: "O recurso interposto é incompatível com o rito processual aplicável ao caso.",
  },
  WRONG_SUPERIOR_COURT: {
    titulo: "Erro de Endereçamento",
    descricao: "O recurso foi endereçado ao tribunal superior incorreto, podendo resultar em não conhecimento.",
  },
  STANCE_CONTRADICTION_RPPS: {
    titulo: "Tese Contrária ao Entendimento Consolidado — RPPS",
    descricao: "A tese sustentada contraria o entendimento dominante do STF sobre o regime próprio de previdência.",
  },
  STANCE_CONTRADICTION_RGPS: {
    titulo: "Tese Contrária ao Entendimento Consolidado — RGPS",
    descricao: "A tese contraria o entendimento STJ/TNU sobre os requisitos do benefício previdenciário.",
  },
  STANCE_CONTRADICTION_JEF: {
    titulo: "Tese Contrária ao Entendimento Consolidado — JEF",
    descricao: "A tese contraria o entendimento consolidado sobre competência ou matéria nos Juizados Especiais Federais.",
  },
  EVIDENCE_STANCE_VIOLATION: {
    titulo: "Inconsistência Argumentativa com Jurisprudência",
    descricao: "Precedente contrário citado sem distinguishing ou sem uso adequado. Risco de improcedência por contradição interna.",
  },
  RPPS_WRONG_ARTICLE: {
    titulo: "Fundamentação Normativa Incorreta — RPPS",
    descricao: "Artigo invocado incorreto para o regime próprio. Pode levar à improcedência por ausência de amparo legal.",
  },
  RGPS_WRONG_ARTICLE: {
    titulo: "Fundamentação Normativa Incorreta — RGPS",
    descricao: "Artigo invocado incorreto para a previdência social. Pode comprometer a fundamentação legal do pedido.",
  },
  BLOCKED_ARTICLE: {
    titulo: "Dispositivo Revogado ou Inaplicável",
    descricao: "Citação de norma revogada. Risco de improcedência por ausência de fundamento legal vigente.",
  },
  SENTENCA_MISSING_DISPOSITIVO: {
    titulo: "Nulidade Formal da Sentença",
    descricao: "Ausência de dispositivo. Sentença sem dispositivo é nula (art. 489 CPC/2015).",
  },
  TUTELA_MISSING_ART300: {
    titulo: "Tutela de Urgência sem Fundamentação Legal",
    descricao: "Pedido de tutela sem referência ao art. 300 CPC/2015. Risco de indeferimento por ausência de fundamento.",
  },
  JEF_PERICIA_COMPLEXA: {
    titulo: "Incompatibilidade Probatória com o Rito",
    descricao: "Perícia complexa incompatível com os Juizados. Pode resultar em remessa à Justiça Comum.",
  },
};

// ── Label de qualidade por score ──────────────────────────────────────────────

function qualidadeLabel(score: number): string {
  return score >= 85 ? "Excelente" :
    score >= 70 ? "Boa" :
    score >= 50 ? "Regular" :
    "Crítica";
}

// ── Derivação de área de riqueza ──────────────────────────────────────────────

function deriveRichnessArea(c: LegalClassification): string {
  if (c.regime_juridico === "RPPS") return "RPPS";
  if (c.regime_juridico === "RGPS") return "RGPS";
  if (c.tipo_justica === "JEF" || c.tipo_justica === "JEC") {
    const assunto = c.assunto_principal ?? "";
    return /lei\s+10\.259|JEF\s+[Ff]ederal|Turma\s+Recursal\s+[Ff]ederal|TRF\d?|INSS|Uni[aã]o\s+Federal/i.test(assunto)
      ? "JEF_FEDERAL" : "JEF_ESTADUAL";
  }
  if (c.tipo_justica === "EXECUCAO_FISCAL") return "EXECUCAO_CUMPRIMENTO";
  const assunto = c.assunto_principal ?? "";
  if (/execu[cç][aã]o|cumprimento\s+de\s+senten[cç]a|penhora|SISBAJUD/i.test(assunto)) return "EXECUCAO_CUMPRIMENTO";
  if (/consumidor|CDC|rela[cç][aã]o\s+de\s+consumo|c[oó]digo\s+de\s+defesa/i.test(assunto)) return "CONSUMIDOR";
  return "CIVEL_GERAL";
}

// ── AuditReportEngine ─────────────────────────────────────────────────────────

export class AuditReportEngine {
  private richnessAnalyzer = new DomainRichnessAnalyzer();

  generate(
    draft: string,
    validationResult: FinalValidationResult,
    classification: LegalClassification,
    extraction: LegalExtraction,
    matrix: ArgumentationMatrix,
    audit: LegalAudit,
    jurisprudencias: JurisprudenciaInput[],
    evidenceAnalyses: EvidenceAnalysis[] = [],
    stanceAnalysis?: StanceAnalysis,
  ): AuditReport {
    const errors = validationResult.errors;
    const fatalErrors = errors.filter((e) => e.fatal);
    const nonFatalErrors = errors.filter((e) => !e.fatal);

    // Richness score (re-executado deterministicamente — sem nova IA)
    const richness = this.richnessAnalyzer.analyze(
      draft,
      deriveRichnessArea(classification),
      classification.regime_juridico,
      classification.assunto_principal,
      classification.tipo_peca,
    );

    // ── FASE 5.0.2: score temporário (será recalculado após as dimensões) ────
    // Os valores reais dependem de qualidadeEstrutural/Probatória/Argumentativa/Consistência
    // calculados adiante — mantemos placeholder para as seções que não dependem deles.
    const _scoreGeral_placeholder = 0; void _scoreGeral_placeholder;

    // ── 3: Problemas Fatais ───────────────────────────────────────────────────
    const problemasFatais = fatalErrors.map((e) => this.errorToItem(e, "FATAL"));

    // ── 4: Problemas Não Fatais ───────────────────────────────────────────────
    const problemasNaoFatais = nonFatalErrors.map((e) => this.errorToItem(e, "IMPORTANTE"));

    // ── 5: Pontos Fortes ──────────────────────────────────────────────────────
    const pontosFortes = this.computePontosFortes(errors, richness.total, stanceAnalysis);

    // ── 6: Sugestões de Melhoria ──────────────────────────────────────────────
    const sugestoesMelhoria = this.computeSugestoes(errors, richness);

    // ── 7: Fundamentação Jurídica Detectada ───────────────────────────────────
    const fundamentacaoJuridica = this.extractFundamentacao(draft, extraction, matrix, jurisprudencias);

    // ── 8: Riscos Processuais ──────────────────────────────────────────────────
    const riscosProcessuais = this.computeRiscos(errors);

    // ── 9: Consistência Argumentativa ─────────────────────────────────────────
    const consistenciaArgumentativa = this.computeConsistencia(errors, stanceAnalysis, evidenceAnalyses);

    // ── 10: Qualidade Estrutural ──────────────────────────────────────────────
    const qualidadeEstrutural = this.computeQualidadeEstrutural(errors);

    // ── 11: Qualidade Probatória ──────────────────────────────────────────────
    const qualidadeProbatoria = this.computeQualidadeProbatoria(errors, jurisprudencias, evidenceAnalyses);

    // ── 12: Qualidade Argumentativa ───────────────────────────────────────────
    const qualidadeArgumentativa: QualidadeArgumentativa = {
      score: richness.total,
      normalizedScore: richness.normalizedScore,
      perfil: richness.profile,
      dimensoes: richness.dimensions.map((d) => ({ label: d.label, score: d.score, max: d.max })),
    };

    // ── FASE 5.0.2: Separação Qualidade Técnica / Viabilidade Jurídica ───────

    // qualidadeTecnica: média ponderada das 4 dimensões técnicas, sem cap
    const qualidadeTecnica = Math.round(
      qualidadeEstrutural.score          * 0.25 +
      qualidadeProbatoria.score          * 0.25 +
      qualidadeArgumentativa.score       * 0.30 +
      consistenciaArgumentativa.score    * 0.20,
    );

    // viabilidadeJuridica: baseada nos erros fatais dos validators
    const viabilidadeJuridica = this.computeViabilidadeJuridica(fatalErrors.length);

    // classificacaoFinal: derivada da viabilidade jurídica
    const classificacaoFinal = this.computeClassificacaoFinal(viabilidadeJuridica);

    // motivoClassificacao: título amigável resumido (sem repetir o detalhe já exibido em problemasFatais)
    const motivoClassificacao = fatalErrors.length > 0
      ? `${RULE_TITLES[fatalErrors[0]!.rule] ?? fatalErrors[0]!.rule}${fatalErrors.length > 1 ? ` (+${fatalErrors.length - 1} problema${fatalErrors.length - 1 > 1 ? "s" : ""} fatal${fatalErrors.length - 1 > 1 ? "is" : ""})` : ""}`
      : undefined;

    // Compat. legado: scoreGeral = qualidadeTecnica (sem cap), classificacao mapeada
    const scoreGeral   = qualidadeTecnica;
    const classificacao = this.mapToLegacyClassificacao(classificacaoFinal);

    return {
      qualidadeTecnica,
      viabilidadeJuridica,
      classificacaoFinal,
      ...(motivoClassificacao !== undefined && { motivoClassificacao }),
      scoreGeral,
      classificacao,
      problemasFatais,
      problemasNaoFatais,
      pontosFortes,
      sugestoesMelhoria,
      fundamentacaoJuridica,
      riscosProcessuais,
      consistenciaArgumentativa,
      qualidadeEstrutural,
      qualidadeProbatoria,
      qualidadeArgumentativa,
    };
  }

  // ── Métodos privados ────────────────────────────────────────────────────────

  // ── FASE 5.0.2 — novos métodos de classificação ────────────────────────────

  private computeViabilidadeJuridica(fatalCount: number): number {
    if (fatalCount === 0) return 100;
    if (fatalCount === 1) return 40;
    if (fatalCount === 2) return 20;
    return 0;
  }

  private computeClassificacaoFinal(viabilidade: number): AuditClassificacaoFinal {
    if (viabilidade >= 85) return "VIAVEL";
    if (viabilidade >= 70) return "ATENCAO";
    if (viabilidade >= 40) return "RISCO_ELEVADO";
    return "CRITICA";
  }

  private mapToLegacyClassificacao(final: AuditClassificacaoFinal): AuditClassificacao {
    const map: Record<AuditClassificacaoFinal, AuditClassificacao> = {
      VIAVEL:        "EXCELENTE",
      ATENCAO:       "BOA",
      RISCO_ELEVADO: "REGULAR",
      CRITICA:       "CRITICA",
    };
    return map[final];
  }

  private errorToItem(e: ValidationError, severidade: "FATAL" | "IMPORTANTE"): AuditItem {
    return {
      titulo: RULE_TITLES[e.rule] ?? e.rule,
      descricao: e.message,
      regra: e.rule,
      severidade,
    };
  }

  private computePontosFortes(
    errors: ValidationError[],
    richnessScore: number,
    stanceAnalysis?: StanceAnalysis,
  ): AuditItem[] {
    const firedRules = new Set(errors.map((e) => e.rule));
    const strengths: AuditItem[] = [];

    const hasStructuralError = [...STRUCTURAL_RULES].some((r) => firedRules.has(r));
    if (!hasStructuralError) {
      strengths.push({
        titulo: "Estrutura processual adequada",
        descricao: "A peça apresenta as seções exigidas para o tipo e o rito processual.",
      });
    }

    const hasAppealError = [...APPEAL_RULES].some((r) => firedRules.has(r));
    if (!hasAppealError) {
      strengths.push({
        titulo: "Via recursal corretamente identificada",
        descricao: "O recurso ou a peça utiliza a via processual adequada ao rito.",
      });
    }

    if (!firedRules.has("EVIDENCE_STANCE_VIOLATION")) {
      strengths.push({
        titulo: "Jurisprudência contrária tratada adequadamente",
        descricao: "Precedentes desfavoráveis foram tratados com distinguishing ou usados corretamente.",
      });
    }

    const hasStanceContradiction = [...STANCE_RULES].some((r) => firedRules.has(r));
    if (!hasStanceContradiction) {
      strengths.push({
        titulo: "Argumentação coerente com o entendimento dominante",
        descricao: "Não foram detectadas contradições com o entendimento consolidado dos tribunais superiores.",
      });
    }

    if (!firedRules.has("JUR_MARKER_IN_DRAFT") && !firedRules.has("GENERIC_JURISPRUDENCE")) {
      strengths.push({
        titulo: "Citações jurisprudenciais corretas",
        descricao: "As referências jurisprudenciais estão formalmente completas e sem marcadores não substituídos.",
      });
    }

    if (richnessScore >= 80) {
      strengths.push({
        titulo: "Fundamentação jurídica robusta",
        descricao: "A peça apresenta boa variedade de artigos de lei e precedentes jurisprudenciais.",
      });
    }

    if (!firedRules.has("FINAL_DRAFT_GENERIC_LANGUAGE")) {
      strengths.push({
        titulo: "Linguagem técnica e específica",
        descricao: "A peça não apresenta linguagem excessivamente genérica ou padronizada.",
      });
    }

    if (!firedRules.has("MATRIX_MISSING_RATIO") && !firedRules.has("MATRIX_WEAK_TESE")) {
      strengths.push({
        titulo: "Teses jurídicas bem estruturadas",
        descricao: "Cada pedido possui tese, fato, norma, ratio e conclusão identificados.",
      });
    }

    if (stanceAnalysis?.result === "SUPPORTED") {
      strengths.push({
        titulo: "Coerência posicional com a jurisprudência",
        descricao: "A tese sustentada é apoiada pelas autoridades jurídicas fornecidas.",
      });
    }

    return strengths;
  }

  private computeSugestoes(
    errors: ValidationError[],
    richness: { total: number; dimensions: Array<{ key: string; label: string; score: number; max: number }> },
  ): AuditItem[] {
    const seen = new Set<string>();
    const suggestions: AuditItem[] = [];

    for (const e of errors) {
      const suggestion = RULE_SUGGESTIONS[e.rule];
      if (suggestion && !seen.has(e.rule)) {
        seen.add(e.rule);
        suggestions.push({
          titulo: `Melhoria — ${RULE_TITLES[e.rule] ?? e.rule}`,
          descricao: suggestion,
          regra: e.rule,
          severidade: "SUGESTAO",
        });
      }
    }

    // Sugestões baseadas em dimensões de riqueza fracas
    if (richness.total < 70) {
      const weakDims = richness.dimensions.filter((d) => d.score < d.max * 0.4);
      for (const dim of weakDims) {
        const key = `richness_${dim.key}`;
        if (!seen.has(key)) {
          seen.add(key);
          suggestions.push({
            titulo: `Reforçar: ${dim.label}`,
            descricao: `Ampliar argumentação com mais citações de artigos de lei, precedentes e fundamentação específica nesta área.`,
            severidade: "SUGESTAO",
          });
        }
      }
    }

    return suggestions;
  }

  private extractFundamentacao(
    draft: string,
    extraction: LegalExtraction,
    matrix: ArgumentationMatrix,
    jurisprudencias: JurisprudenciaInput[],
  ): FundamentacaoJuridicaItem[] {
    const items: FundamentacaoJuridicaItem[] = [];
    const seen = new Set<string>();

    // Artigos citados na extração
    for (const art of extraction.artigos_citados) {
      if (art && !seen.has(art)) {
        seen.add(art);
        items.push({ tipo: "ARTIGO", referencia: art });
      }
    }

    // Normas das teses da matriz
    for (const tese of matrix.teses) {
      if (tese.norma && !seen.has(tese.norma)) {
        seen.add(tese.norma);
        items.push({
          tipo: "ARTIGO",
          referencia: tese.norma,
          contexto: tese.tese.length > 80 ? tese.tese.slice(0, 80) + "…" : tese.tese,
        });
      }
    }

    // Diplomas legais detectados no draft
    const diplomas = [
      ...(draft.match(/lei\s+(?:n[.°º]?\s*)?\d[\d.,\/]*/gi) ?? []),
      ...(draft.match(/EC\s+\d+(?:\/\d+)?|\bemenda\s+constitucional\s+(?:n[.°º]?\s*)?\d+\b/gi) ?? []),
      ...(draft.match(/decreto(?:[\s-]lei)?\s+(?:n[.°º]?\s*)?\d[\d.,\/]*/gi) ?? []),
    ];
    for (const d of [...new Set(diplomas.map((s) => s.replace(/\s+/g, " ").trim()))]) {
      if (!seen.has(d)) {
        seen.add(d);
        items.push({ tipo: "DIPLOMA", referencia: d });
      }
    }

    // Jurisprudências fornecidas
    for (const jur of jurisprudencias) {
      const ref = `${jur.tribunal} — ${jur.numero}`;
      if (!seen.has(ref)) {
        seen.add(ref);
        items.push({
          tipo: "JURISPRUDENCIA",
          referencia: ref,
          contexto: jur.tema ?? jur.tese?.slice(0, 80),
        });
      }
    }

    // Precedentes específicos detectados no draft
    const precedents = draft.match(/(?:Tema\s+(?:STF|STJ)\s+\d+|REsp\.?\s*[\d.\/]+|RE\s+[\d.\/]+|Súmula\s+(?:n[.°º]?\s*)?\d+)/gi) ?? [];
    for (const p of [...new Set(precedents)]) {
      if (!seen.has(p)) {
        seen.add(p);
        items.push({ tipo: "JURISPRUDENCIA", referencia: p });
      }
    }

    return items.slice(0, 30); // limita a 30 itens
  }

  private computeRiscos(errors: ValidationError[]): AuditItem[] {
    const risks: AuditItem[] = [];
    const seen = new Set<string>();
    // Stance/evidence rules are already captured in consistênciaArgumentativa — skip to avoid duplication
    const coveredByConsistencia = new Set([...STANCE_RULES, "EVIDENCE_STANCE_VIOLATION"]);

    for (const e of errors) {
      if (coveredByConsistencia.has(e.rule)) continue;
      const risk = RULE_RISKS[e.rule];
      if (risk && !seen.has(e.rule)) {
        seen.add(e.rule);
        risks.push({
          titulo: risk.titulo,
          descricao: risk.descricao,
          regra: e.rule,
          severidade: e.fatal ? "FATAL" : "IMPORTANTE",
        });
      }
    }

    return risks;
  }

  private computeConsistencia(
    errors: ValidationError[],
    stanceAnalysis?: StanceAnalysis,
    _evidenceAnalyses?: EvidenceAnalysis[],
  ): ConsistenciaArgumentativa {
    let score = 100;
    const detalhes: AuditItem[] = [];

    // Contradições de stance (fatais)
    const stanceErrors = errors.filter((e) => STANCE_RULES.has(e.rule));
    for (const e of stanceErrors) {
      score -= 30;
      detalhes.push({
        titulo: RULE_TITLES[e.rule] ?? e.rule,
        descricao: e.message,
        regra: e.rule,
        severidade: "FATAL",
      });
    }

    // Violações de stance de evidência
    const stanceViolations = errors.filter((e) => e.rule === "EVIDENCE_STANCE_VIOLATION");
    for (const e of stanceViolations) {
      score -= 20;
      detalhes.push({
        titulo: "Jurisprudência contrária não tratada",
        descricao: e.message,
        regra: e.rule,
        severidade: "FATAL",
      });
    }

    // StanceAnalyzer pré-geração
    if (stanceAnalysis) {
      if (stanceAnalysis.result === "CONTRADICTED") {
        score -= 25;
        detalhes.push({
          titulo: "Posicionamento contrário ao entendimento dominante",
          descricao: `StanceAnalyzer: ${stanceAnalysis.reasons.slice(0, 2).join("; ")}`,
          severidade: "IMPORTANTE",
        });
      } else if (stanceAnalysis.result === "MIXED") {
        score -= 10;
        detalhes.push({
          titulo: "Posicionamento parcialmente conflitante",
          descricao: "Algumas autoridades jurídicas suportam a tese, outras a contradizem.",
          severidade: "IMPORTANTE",
        });
      }
    }

    score = Math.max(0, score);

    const resultado: ConsistenciaArgumentativa["resultado"] =
      score >= 80 ? "CONSISTENTE" :
      score >= 50 ? "PARCIALMENTE CONSISTENTE" :
      "INCONSISTENTE";

    if (score >= 80 && detalhes.length === 0) {
      detalhes.push({
        titulo: "Coerência posicional verificada",
        descricao: "Não foram detectadas contradições entre a tese sustentada e as autoridades jurídicas.",
      });
    }

    return { score, resultado, detalhes };
  }

  private computeQualidadeEstrutural(errors: ValidationError[]): QualidadeScore {
    let score = 100;
    const itens: AuditItem[] = [];

    const structuralErrors = errors.filter(
      (e) => STRUCTURAL_RULES.has(e.rule) || APPEAL_RULES.has(e.rule),
    );

    for (const e of structuralErrors) {
      score -= e.fatal ? 20 : 10;
      itens.push({
        titulo: RULE_TITLES[e.rule] ?? e.rule,
        descricao: e.message,
        regra: e.rule,
        severidade: e.fatal ? "FATAL" : "IMPORTANTE",
      });
    }

    // Problemas de civil/sentença também impactam estrutura
    const sentencaErrors = errors.filter((e) =>
      ["TUTELA_MISSING_ART300", "TUTELA_MISSING_PERICULUM_MORA", "SENTENCA_MISSING_HONORARIOS", "SENTENCA_MISSING_CUSTAS"].includes(e.rule),
    );
    for (const e of sentencaErrors) {
      score -= 8;
      itens.push({
        titulo: RULE_TITLES[e.rule] ?? e.rule,
        descricao: e.message,
        regra: e.rule,
        severidade: "IMPORTANTE",
      });
    }

    score = Math.max(0, score);

    if (itens.length === 0) {
      itens.push({
        titulo: "Estrutura processual correta",
        descricao: "A peça contém todas as seções obrigatórias para o tipo e o rito.",
      });
    }

    return { score, label: qualidadeLabel(score), itens };
  }

  private computeQualidadeProbatoria(
    errors: ValidationError[],
    jurisprudencias: JurisprudenciaInput[],
    evidenceAnalyses: EvidenceAnalysis[],
  ): QualidadeScore {
    let score = 100;
    const itens: AuditItem[] = [];

    const probErrors = errors.filter((e) => PROBATORY_RULES.has(e.rule));
    for (const e of probErrors) {
      score -= e.fatal ? 25 : 12;
      itens.push({
        titulo: RULE_TITLES[e.rule] ?? e.rule,
        descricao: e.message,
        regra: e.rule,
        severidade: e.fatal ? "FATAL" : "IMPORTANTE",
      });
    }

    // Bônus: jurisprudência fornecida e analisada
    if (jurisprudencias.length > 0 && evidenceAnalyses.length > 0) {
      const favorable = evidenceAnalyses.filter((a) => a.stance === "FAVORAVEL").length;
      if (favorable > 0) {
        itens.push({
          titulo: `${favorable} jurisprudência(s) favorável(is) identificada(s)`,
          descricao: "A análise de evidências encontrou precedentes que suportam a tese.",
        });
      }
    }

    score = Math.max(0, score);

    if (itens.length === 0) {
      itens.push({
        titulo: "Referências probatórias adequadas",
        descricao: "Citações jurisprudenciais formalmente corretas e compatíveis com o tribunal competente.",
      });
    }

    return { score, label: qualidadeLabel(score), itens };
  }
}

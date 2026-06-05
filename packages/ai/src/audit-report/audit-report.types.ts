export type AuditClassificacao = "EXCELENTE" | "BOA" | "REGULAR" | "CRITICA";

/** FASE 5.0.2 — classificação baseada exclusivamente na viabilidade jurídica. */
export type AuditClassificacaoFinal = "VIAVEL" | "ATENCAO" | "RISCO_ELEVADO" | "CRITICA";

export type AuditSeveridade = "FATAL" | "IMPORTANTE" | "SUGESTAO";

export interface AuditItem {
  titulo: string;
  descricao: string;
  regra?: string;
  severidade?: AuditSeveridade;
}

export interface FundamentacaoJuridicaItem {
  tipo: "ARTIGO" | "JURISPRUDENCIA" | "DIPLOMA";
  referencia: string;
  contexto?: string;
}

export interface QualidadeScore {
  score: number;
  label: string;
  itens: AuditItem[];
}

export interface ConsistenciaArgumentativa {
  score: number;
  resultado: "CONSISTENTE" | "PARCIALMENTE CONSISTENTE" | "INCONSISTENTE";
  detalhes: AuditItem[];
}

export interface QualidadeArgumentativa {
  score: number;
  normalizedScore: number;
  perfil: string;
  dimensoes: Array<{ label: string; score: number; max: number }>;
}

export interface AuditReport {
  // ── FASE 5.0.2 — separação qualidade técnica / viabilidade jurídica ──────
  /** Média ponderada das 4 dimensões técnicas. Nunca sofre cap por erros. */
  qualidadeTecnica: number;
  /** Baseada exclusivamente no número de erros fatais dos validators. */
  viabilidadeJuridica: number;
  /** Classificação derivada da viabilidade jurídica. */
  classificacaoFinal: AuditClassificacaoFinal;
  /** Motivo da classificação (primeiro erro fatal, quando presente). */
  motivoClassificacao?: string;

  // ── Compat. legado (mantidos para quality-lab e histórico) ────────────────
  /** = qualidadeTecnica (sem cap). Mantido para compatibilidade. */
  scoreGeral: number;
  /** Mapeado de classificacaoFinal. Mantido para compatibilidade. */
  classificacao: AuditClassificacao;
  problemasFatais: AuditItem[];
  problemasNaoFatais: AuditItem[];
  pontosFortes: AuditItem[];
  sugestoesMelhoria: AuditItem[];
  fundamentacaoJuridica: FundamentacaoJuridicaItem[];
  riscosProcessuais: AuditItem[];
  consistenciaArgumentativa: ConsistenciaArgumentativa;
  qualidadeEstrutural: QualidadeScore;
  qualidadeProbatoria: QualidadeScore;
  qualidadeArgumentativa: QualidadeArgumentativa;
}

export type AuditClassificacao = "EXCELENTE" | "BOA" | "REGULAR" | "CRITICA";

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
  scoreGeral: number;
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

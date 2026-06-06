/**
 * FASE 9.0.5A — Tipos do Gold Corpus Sintético
 *
 * Define a estrutura dos casos controlados usados para avaliação e calibração
 * do AI Legal Strength Reviewer.
 *
 * Regras de design:
 * - Sem lógica executável — apenas tipos e constantes.
 * - DocumentType é o conjunto canônico de peças suportadas.
 * - Tipos não suportados (ex.: EMBARGOS, EXCECAO_PRE_EXECUTIVIDADE) são
 *   mapeados para o tipo mais próximo e o valor original é preservado em `subtype`.
 */

export type DocumentType =
  | "PETICAO_INICIAL"
  | "CONTESTACAO"
  | "RECURSO"
  | "SENTENCA"
  | "DECISAO"
  | "DESPACHO"
  | "CUMPRIMENTO_SENTENCA";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type Quality = "GOOD" | "LIGHT_ISSUES" | "MODERATE_ISSUES" | "SEVERE_ISSUES";

export interface ScoreRange {
  /** Score mínimo esperado (0–100). */
  min: number;
  /** Score máximo esperado (0–100). */
  max: number;
}

export interface GoldCorpusCase {
  /** Identificador único do caso (ex.: "RGPS-001"). */
  id: string;

  /** Domínio jurídico canônico (alinhado com DomainKnowledgeRegistry). */
  domain: string;

  /** Tipo canônico da peça. Tipos estendidos são mapeados e o original fica em `subtype`. */
  documentType: DocumentType;

  /**
   * Tipo original da peça quando não existe no enum DocumentType.
   * Exemplos: "EMBARGOS", "EXCECAO_PRE_EXECUTIVIDADE".
   */
  subtype?: string;

  /** Nível de complexidade do caso. */
  difficulty: Difficulty;

  /**
   * Nível de qualidade da peça.
   * - GOOD: peça robusta, sem fragilidades planejadas.
   * - LIGHT_ISSUES: oportunidades menores de melhoria.
   * - MODERATE_ISSUES: fragilidades relevantes mas não fatais.
   * - SEVERE_ISSUES: fragilidades graves que comprometem a tese.
   */
  quality: Quality;

  /** Descrição do cenário jurídico do caso. */
  scenario: string;

  /**
   * Defeitos intencionalmente introduzidos na peça.
   * Deve ser vazio para casos GOOD.
   */
  plantedIssues: string[];

  /**
   * Findings que o reviewer deve gerar para este caso.
   * Deve ser vazio para casos GOOD.
   */
  expectedFindings: string[];

  /**
   * Findings que o reviewer NÃO deve gerar — testa ausência de falsos positivos.
   * Relevante principalmente para casos GOOD.
   */
  unexpectedFindings?: string[];

  /** Faixa de score esperada para este caso (0–100). */
  expectedScoreRange: ScoreRange;

  /** Observações técnicas ou contexto adicional. */
  notes?: string;
}

/** Distribuição canônica de casos por domínio no corpus v1. */
export const CORPUS_V1_DISTRIBUTION: Readonly<Record<string, number>> = {
  RGPS: 15,
  RPPS: 5,
  TRABALHISTA: 10,
  TRIBUTARIO: 10,
  FAMILIA: 10,
  CONSUMIDOR: 10,
  CRIMINAL: 10,
  FAZENDA_PUBLICA: 10,
  AMBIENTAL: 5,
  CIVEL: 10,
  JUIZADO_ESPECIAL: 5,
} as const;

/** Total de casos no corpus v1. */
export const CORPUS_V1_TOTAL = 100;

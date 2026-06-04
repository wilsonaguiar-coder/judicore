export type DomainProfile =
  | "EXECUCAO_CUMPRIMENTO"
  | "RPPS"
  | "RGPS"
  | "JEF_ESTADUAL"
  | "JEF_FEDERAL"
  | "CONSUMIDOR"
  | "CIVEL_GERAL";

export interface DomainDimension {
  key: string;
  label: string;
  score: number;
  max: number;
}

export interface DomainScoreDetail {
  profile: DomainProfile;
  total: number;
  /** Score sem penalização por ausência de jurisprudência (FASE 4.6.1). */
  normalizedScore: number;
  dimensions: DomainDimension[];
  bannedExpressionsFound: string[];
}

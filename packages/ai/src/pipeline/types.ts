export type TipoJustica = "TRABALHO" | "FEDERAL" | "ESTADUAL";
export type TipoPeca = "PETICAO_INICIAL" | "RECURSO" | "SENTENCA" | "DECISAO" | "DESPACHO";
export type RegimeJuridico = "CLT" | "RPPS" | "RGPS" | "ESTATUTARIO" | "CIVIL" | null;
export type Grau = "PRIMEIRO" | "SEGUNDO" | "SUPERIOR";

export interface LegalClassification {
  tipo_justica: TipoJustica;
  tipo_peca: TipoPeca;
  regime_juridico: RegimeJuridico;
  grau: Grau;
  tribunal_competente: string;
  rito: string | null;
  assunto_principal: string;
  partes: {
    autor: string;
    reu: string;
  };
  confianca: number;
}

export interface JurisprudenciaInput {
  id: string;
  tribunal: string;
  numero: string;
  tema: string;
  ementa: string;
  tese: string;
  relator?: string | undefined;
  dataJulgamento?: string | undefined;
  url?: string | undefined;
}

export interface LegalExtraction {
  fatos: string[];
  pedidos: string[];
  questoes_juridicas: string[];
  artigos_citados: string[];
  jurisprudencias_relevantes: string[];
}

export interface ArgumentacaoTese {
  id: string;
  pedido: string;
  fato: string;
  norma: string;
  jurisprudencia_id: string | null;
  conclusao: string;
}

export interface ArgumentationMatrix {
  teses: ArgumentacaoTese[];
}

export interface AuditError {
  tipo: string;
  trecho: string;
  correcao: string;
  severidade: "CRITICO" | "IMPORTANTE" | "SUGESTAO";
}

export interface LegalAudit {
  aprovada: boolean;
  score: number;
  erros: AuditError[];
  resumo: string;
}

export interface ValidationError {
  rule: string;
  message: string;
  fatal: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface PipelineContext {
  generationId: string;
  caseDescription: string;
  documentType: TipoPeca;
  jurisprudencias: JurisprudenciaInput[];
  instruction?: string | undefined;
  classification?: LegalClassification | undefined;
  extraction?: LegalExtraction | undefined;
  matrix?: ArgumentationMatrix | undefined;
  draft?: string | undefined;
  audit?: LegalAudit | undefined;
  retryOf?: string | undefined;
  corrections?: string | undefined;
}

export interface PipelineInput {
  caseId?: string | undefined;
  userId: string;
  caseDescription: string;
  documentType: TipoPeca;
  jurisprudencias: JurisprudenciaInput[];
  instruction?: string | undefined;
  retryOf?: string | undefined;
  corrections?: string | undefined;
}

export type PipelineEvent =
  | { event: "phase"; data: { phase: string; generationId: string } }
  | { event: "classification"; data: LegalClassification }
  | { event: "extraction"; data: LegalExtraction }
  | { event: "matrix"; data: ArgumentationMatrix }
  | { event: "chunk"; data: string }
  | { event: "audit"; data: LegalAudit }
  | { event: "done"; data: { generationId: string; documentId?: string | undefined; aprovada: boolean } }
  | { event: "error"; data: { message: string; phase: string; fatal: boolean } }
  | { event: "validation_errors"; data: ValidationError[] };

export interface ServiceUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

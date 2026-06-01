export type GenerationMode = "FINAL_DRAFT" | "TEMPLATE_MODEL" | "SAFE_SKELETON";
export type ExtractionQuality = "SUFICIENTE" | "PARCIAL" | "INSUFICIENTE";

export type TipoJustica =
  | "TRABALHO"
  | "FEDERAL"
  | "ESTADUAL"
  | "JEF"
  | "JEC"
  | "CRIMINAL"
  | "EXECUCAO_FISCAL"
  | "INDETERMINADA";

export type TipoPeca = "PETICAO_INICIAL" | "RECURSO" | "SENTENCA" | "DECISAO" | "DESPACHO";

export type RegimeJuridico =
  | "CLT"
  | "RPPS"
  | "RGPS"
  | "ESTATUTARIO"
  | "CIVIL"
  | "CRIMINAL"
  | "TRIBUTARIO"
  | "INDETERMINADO"
  | null;

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

export type EvidenceStance = "FAVORAVEL" | "CONTRARIO" | "NEUTRO" | "INCONCLUSIVO";
export type EvidenceUseMode = "FOUNDATION" | "COUNTER_ARGUMENT" | "DISCARD" | "CONTEXT_ONLY";

export interface EvidenceAnalysis {
  id: string;
  stance: EvidenceStance;
  use_mode: EvidenceUseMode;
  confidence: number;
  tese_extraida: string;
  fundamento_da_classificacao: string;
  pode_citar_na_peca: boolean;
  regra_de_uso: string;
}

export interface JurisprudenciaAnalyzed extends JurisprudenciaInput {
  evidence?: EvidenceAnalysis | undefined;
}

export interface LegalExtraction {
  fatos: string[];
  pedidos: string[];
  questoes_juridicas: string[];
  artigos_citados: string[];
  jurisprudencias_relevantes: string[];
  qualidade_extracao: ExtractionQuality;
  motivo_qualidade?: string | undefined;
}

export interface ArgumentacaoTese {
  id: string;
  pedido: string;
  tese: string;
  fato: string;
  norma: string;
  ratio: string;
  contraponto?: string | undefined;
  resposta_contraponto?: string | undefined;
  jurisprudencia_id: string | null;
  counter_jurisprudencia_id?: string | null | undefined;
  distinguishing?: string | null | undefined;
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

export type DocumentStatus = "MINUTA APROVADA" | "APROVADA COM RESSALVAS" | "REPROVADA";

export interface LegalAudit {
  aprovada: boolean;
  score: number;
  erros: AuditError[];
  resumo: string;
  document_confidence?: number | undefined;
  status_minuta?: DocumentStatus | undefined;
  blocked?: boolean | undefined;
  ressalvas?: string[] | undefined;
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
  generationMode?: GenerationMode | undefined;
  evidenceAnalysis?: EvidenceAnalysis[] | undefined;
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
  | { event: "mode"; data: { mode: GenerationMode; reason: string } }
  | { event: "classification"; data: LegalClassification }
  | { event: "extraction"; data: LegalExtraction }
  | { event: "matrix"; data: ArgumentationMatrix }
  | { event: "chunk"; data: string }
  | { event: "audit"; data: LegalAudit }
  | { event: "done"; data: { generationId: string; documentId?: string | undefined; aprovada: boolean; mode?: GenerationMode | undefined; status?: string | undefined; blocked?: boolean | undefined; ressalvas?: string[] | undefined; safe_message?: string | undefined } }
  | { event: "evidence"; data: EvidenceAnalysis[] }
  | { event: "error"; data: { message: string; phase: string; fatal: boolean } }
  | { event: "validation_errors"; data: ValidationError[] };

export interface ServiceUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

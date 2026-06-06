/**
 * FASE 9.0.8.9 — Tributário Gold Corpus V2 — Tipos de Cenário
 *
 * Define os tipos específicos do domínio tributário:
 * - TributarioIssueType: tipo de questão/tese tributária
 * - TributarioQuality: nível de qualidade da peça
 * - TributarioDocumentType: tipo de documento processual tributário
 * - TributarioScenarioConfig: configuração completa do cenário
 * - GeneratedTributarioDocumentV2: output da geração
 */

export type TributarioIssueType =
  | "EMBARGOS_EXECUCAO_FISCAL"
  | "COMPENSACAO_CREDITO_TRIBUTARIO"
  | "EXCLUSAO_SIMPLES_NACIONAL"
  | "RESTITUICAO_TRIBUTO_INDEVIDO"
  | "PRESCRICAO_TRIBUTARIA"
  | "ANULATORIA_AUTO_INFRACAO"
  | "IMUNIDADE_TRIBUTARIA"
  | "PARCELAMENTO_TRIBUTARIO"
  | "REDIRECIONAMENTO_EXECUCAO"
  | "MANDADO_SEGURANCA_TRIBUTARIO"
  | "ISENCAO_IRPF_DOENCA"
  | "DECLARATORIA_INEXIGIBILIDADE"
  | "CREDITO_ICMS_PRESUMIDO"
  | "DECADENCIA_TRIBUTARIA"
  | "CUMPRIMENTO_TRIBUTARIO";

export type TributarioQuality = "GOOD" | "LIGHT_ISSUES" | "MODERATE_ISSUES" | "SEVERE_ISSUES";

export type TributarioDocumentType = "PETICAO_INICIAL" | "RECURSO" | "CUMPRIMENTO_SENTENCA";

export interface TributarioScenarioConfig {
  caseId: string;
  issueType: TributarioIssueType;
  quality: TributarioQuality;
  documentType: TributarioDocumentType;
}

export interface GeneratedTributarioDocumentV2 {
  caseId: string;
  domain: "TRIBUTARIO";
  documentType: TributarioDocumentType;
  quality: TributarioQuality;
  text: string;
  derivedExpectedFindings: string[];
  metadata: {
    generatorVersion: "v2";
    generatedAt: "2026-06-06T00:00:00.000Z";
    synthetic: true;
  };
}

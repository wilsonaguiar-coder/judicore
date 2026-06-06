/**
 * FASE 9.0.8.10 — FAMÍLIA Scenario Types
 *
 * Tipos específicos do domínio de Direito de Família para o Gold Corpus V2.
 */

export type FamiliaIssueType =
  | "DIVORCIO_LITIGIOSO"
  | "ALIMENTOS_FILHOS"
  | "GUARDA_COMPARTILHADA"
  | "REGULAMENTACAO_VISITAS"
  | "RECONHECIMENTO_UNIAO_ESTAVEL"
  | "PARTILHA_BENS"
  | "ALIENACAO_PARENTAL"
  | "EXONERACAO_ALIMENTOS"
  | "INVESTIGACAO_PATERNIDADE"
  | "ALTERACAO_GUARDA"
  | "DISSOLUCAO_UNIAO_ESTAVEL"
  | "INTERDICAO"
  | "REVISAO_ALIMENTOS"
  | "TUTELA_CRIANCA"
  | "CUMPRIMENTO_ALIMENTOS";

export type FamiliaQuality = "GOOD" | "LIGHT_ISSUES" | "MODERATE_ISSUES" | "SEVERE_ISSUES";
export type FamiliaDocumentType = "PETICAO_INICIAL" | "RECURSO" | "CUMPRIMENTO_SENTENCA";

export interface FamiliaScenarioConfig {
  caseId: string;
  issueType: FamiliaIssueType;
  quality: FamiliaQuality;
  documentType: FamiliaDocumentType;
}

export interface GeneratedFamiliaDocumentV2 {
  caseId: string;
  domain: "FAMILIA";
  documentType: FamiliaDocumentType;
  quality: FamiliaQuality;
  text: string;
  derivedExpectedFindings: string[];
  metadata: {
    generatorVersion: "v2";
    generatedAt: "2026-06-06T00:00:00.000Z";
    synthetic: true;
  };
}

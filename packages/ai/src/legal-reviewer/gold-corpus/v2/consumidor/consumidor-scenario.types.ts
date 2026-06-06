/**
 * FASE 9.0.8.15 — CONSUMIDOR Scenario Types
 *
 * Tipos específicos do domínio Consumidor (CDC/Lei 8.078/1990).
 * Sem lógica executável — apenas tipos e interfaces.
 */

export type ConsumidorIssueType =
  | "DANO_MORAL_CONSUMIDOR"
  | "NEGATIVACAO_INDEVIDA"
  | "RECUSA_COBERTURA_PLANO"
  | "PRODUTO_DEFEITUOSO"
  | "COBRANA_INDEVIDA"
  | "RESCISAO_CONTRATO_CONSUMIDOR"
  | "OVERBOOKING"
  | "FURTO_CELULAR_BANCO"
  | "SERVICO_DEFEITUOSO"
  | "PRATICA_ABUSIVA"
  | "EXTRAVIO_BAGAGEM"
  | "PUBLICIDADE_ENGANOSA"
  | "CONTRATO_BANCARIO_ABUSIVO"
  | "VICIO_CONSTRUCAO"
  | "CUMPRIMENTO_CONSUMIDOR";

export type ConsumidorQuality = "GOOD" | "LIGHT_ISSUES" | "MODERATE_ISSUES" | "SEVERE_ISSUES";
export type ConsumidorDocumentType = "PETICAO_INICIAL" | "RECURSO" | "CUMPRIMENTO_SENTENCA";

export interface ConsumidorScenarioConfig {
  caseId: string;
  issueType: ConsumidorIssueType;
  quality: ConsumidorQuality;
  documentType: ConsumidorDocumentType;
}

export interface GeneratedConsumidorDocumentV2 {
  caseId: string;
  domain: "CONSUMIDOR";
  documentType: ConsumidorDocumentType;
  quality: ConsumidorQuality;
  text: string;
  derivedExpectedFindings: string[];
  metadata: {
    generatorVersion: "v2";
    generatedAt: "2026-06-06T00:00:00.000Z";
    synthetic: true;
  };
}

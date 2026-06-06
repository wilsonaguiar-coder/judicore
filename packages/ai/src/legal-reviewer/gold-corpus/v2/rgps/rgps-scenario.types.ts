/**
 * FASE 9.0.8.10 — RGPS Generator V2 — Tipos de Cenário
 */

export type RgpsBenefitType =
  | "APOSENTADORIA_IDADE_URBANA"
  | "APOSENTADORIA_ESPECIAL"
  | "BENEFICIO_INCAPACIDADE"
  | "LOAS_BPC"
  | "REVISAO_APOSENTADORIA"
  | "APOSENTADORIA_RURAL"
  | "TEMPO_ESPECIAL_LIGHT"
  | "CUMPRIMENTO_SENTENCA_PREV"
  | "REAFIRMACAO_DER"
  | "QUALIDADE_SEGURADO"
  | "APOSENTADORIA_CARENCIA_COMPLETA"
  | "CONVERSAO_TEMPO_ESPECIAL"
  | "AUXILIO_INCAPACIDADE"
  | "PENSAO_POR_MORTE"
  | "CUMPRIMENTO_JULGADO_COMPLETO";

export type RgpsQuality = "GOOD" | "LIGHT_ISSUES" | "MODERATE_ISSUES" | "SEVERE_ISSUES";
export type RgpsDocumentType = "PETICAO_INICIAL" | "RECURSO" | "CUMPRIMENTO_SENTENCA";

export interface RgpsScenarioConfig {
  caseId: string;
  benefitType: RgpsBenefitType;
  quality: RgpsQuality;
  documentType: RgpsDocumentType;
}

export interface GeneratedRgpsDocumentV2 {
  caseId: string;
  domain: "RGPS";
  documentType: RgpsDocumentType;
  quality: RgpsQuality;
  text: string;
  derivedExpectedFindings: string[];
  metadata: {
    generatorVersion: "v2";
    generatedAt: "2026-06-06T00:00:00.000Z";
    synthetic: true;
  };
}

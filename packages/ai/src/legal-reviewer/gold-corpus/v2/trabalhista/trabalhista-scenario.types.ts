/**
 * FASE 9.0.8.9 — Trabalhista Gold Corpus V2 — Tipos de Cenário
 *
 * Define os tipos específicos do domínio trabalhista:
 * - ClaimType: tipo de pedido/tese trabalhista
 * - Quality: nível de qualidade da peça
 * - DocumentType: tipo de documento processual trabalhista
 * - ScenarioConfig: configuração completa do cenário
 * - GeneratedDocument: output da geração
 */

export type TrabalhistaClaimType =
  | "HORAS_EXTRAS"
  | "ADICIONAL_INSALUBRIDADE"
  | "RESCISAO_INDIRETA"
  | "DANO_MORAL_TRAB"
  | "FGTS_MULTA_40"
  | "RECONHECIMENTO_VINCULO"
  | "ASSEDIO_MORAL_TRAB"
  | "DEPOSITOS_FGTS_EXEC"
  | "AVISO_PREVIO_PROP"
  | "ADICIONAL_PERICULOSIDADE"
  | "EQUIPARACAO_SALARIAL"
  | "INTERVALO_INTRAJORNADA"
  | "VINCULO_DOMESTICO"
  | "ACIDENTE_TRABALHO_TRAB"
  | "CUMPRIMENTO_SENTENCA_TRAB";

export type TrabalhistaQuality = "GOOD" | "LIGHT_ISSUES" | "MODERATE_ISSUES" | "SEVERE_ISSUES";

export type TrabalhistaDocumentType =
  | "RECLAMACAO_TRABALHISTA"
  | "RECURSO_ORDINARIO"
  | "CUMPRIMENTO_SENTENCA";

export interface TrabalhistaScenarioConfig {
  caseId: string;
  claimType: TrabalhistaClaimType;
  quality: TrabalhistaQuality;
  documentType: TrabalhistaDocumentType;
}

export interface GeneratedTrabalhistaDocumentV2 {
  caseId: string;
  domain: "TRABALHISTA";
  documentType: TrabalhistaDocumentType;
  quality: TrabalhistaQuality;
  text: string;
  derivedExpectedFindings: string[];
  metadata: {
    generatorVersion: "v2";
    generatedAt: "2026-06-06T00:00:00.000Z";
    synthetic: true;
  };
}

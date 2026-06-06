/**
 * FASE 9.0.8.9 — Tributário Scenario Factory
 *
 * Mapeamento estático dos 15 casos Tributário V2 para suas configurações de cenário.
 * Cada caso corresponde a um issueType, quality e documentType específicos.
 */

import type { TributarioScenarioConfig } from "./tributario-scenario.types.js";

const SCENARIOS: Readonly<Record<string, TributarioScenarioConfig>> = {
  "TRIB-001": { caseId: "TRIB-001", issueType: "EMBARGOS_EXECUCAO_FISCAL",       quality: "GOOD",            documentType: "PETICAO_INICIAL"     },
  "TRIB-002": { caseId: "TRIB-002", issueType: "COMPENSACAO_CREDITO_TRIBUTARIO",  quality: "MODERATE_ISSUES", documentType: "PETICAO_INICIAL"     },
  "TRIB-003": { caseId: "TRIB-003", issueType: "EXCLUSAO_SIMPLES_NACIONAL",       quality: "SEVERE_ISSUES",   documentType: "RECURSO"             },
  "TRIB-004": { caseId: "TRIB-004", issueType: "RESTITUICAO_TRIBUTO_INDEVIDO",    quality: "MODERATE_ISSUES", documentType: "PETICAO_INICIAL"     },
  "TRIB-005": { caseId: "TRIB-005", issueType: "PRESCRICAO_TRIBUTARIA",           quality: "GOOD",            documentType: "RECURSO"             },
  "TRIB-006": { caseId: "TRIB-006", issueType: "ANULATORIA_AUTO_INFRACAO",        quality: "MODERATE_ISSUES", documentType: "PETICAO_INICIAL"     },
  "TRIB-007": { caseId: "TRIB-007", issueType: "IMUNIDADE_TRIBUTARIA",            quality: "LIGHT_ISSUES",    documentType: "PETICAO_INICIAL"     },
  "TRIB-008": { caseId: "TRIB-008", issueType: "PARCELAMENTO_TRIBUTARIO",         quality: "MODERATE_ISSUES", documentType: "CUMPRIMENTO_SENTENCA"},
  "TRIB-009": { caseId: "TRIB-009", issueType: "REDIRECIONAMENTO_EXECUCAO",       quality: "LIGHT_ISSUES",    documentType: "RECURSO"             },
  "TRIB-010": { caseId: "TRIB-010", issueType: "MANDADO_SEGURANCA_TRIBUTARIO",    quality: "MODERATE_ISSUES", documentType: "PETICAO_INICIAL"     },
  "TRIB-011": { caseId: "TRIB-011", issueType: "ISENCAO_IRPF_DOENCA",             quality: "GOOD",            documentType: "PETICAO_INICIAL"     },
  "TRIB-012": { caseId: "TRIB-012", issueType: "DECLARATORIA_INEXIGIBILIDADE",    quality: "LIGHT_ISSUES",    documentType: "PETICAO_INICIAL"     },
  "TRIB-013": { caseId: "TRIB-013", issueType: "CREDITO_ICMS_PRESUMIDO",          quality: "GOOD",            documentType: "PETICAO_INICIAL"     },
  "TRIB-014": { caseId: "TRIB-014", issueType: "DECADENCIA_TRIBUTARIA",           quality: "MODERATE_ISSUES", documentType: "RECURSO"             },
  "TRIB-015": { caseId: "TRIB-015", issueType: "CUMPRIMENTO_TRIBUTARIO",          quality: "GOOD",            documentType: "CUMPRIMENTO_SENTENCA"},
};

export const TRIBUTARIO_CASE_IDS: readonly string[] = Object.keys(SCENARIOS);

export function getTributarioScenario(caseId: string): TributarioScenarioConfig {
  const cfg = SCENARIOS[caseId];
  if (cfg === undefined) throw new Error(`Cenário Tributário não encontrado: ${caseId}`);
  return cfg;
}

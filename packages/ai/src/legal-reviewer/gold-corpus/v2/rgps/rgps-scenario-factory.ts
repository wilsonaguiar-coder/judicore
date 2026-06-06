/**
 * FASE 9.0.8.10 — RGPS Scenario Factory
 *
 * Mapeamento estático dos 15 casos RGPS para suas configurações de cenário.
 */

import type { RgpsScenarioConfig } from "./rgps-scenario.types.js";

const SCENARIOS: Readonly<Record<string, RgpsScenarioConfig>> = {
  "RGPS-001": { caseId: "RGPS-001", benefitType: "APOSENTADORIA_IDADE_URBANA",       quality: "GOOD",             documentType: "PETICAO_INICIAL"       },
  "RGPS-002": { caseId: "RGPS-002", benefitType: "APOSENTADORIA_ESPECIAL",            quality: "MODERATE_ISSUES",  documentType: "PETICAO_INICIAL"       },
  "RGPS-003": { caseId: "RGPS-003", benefitType: "BENEFICIO_INCAPACIDADE",            quality: "SEVERE_ISSUES",    documentType: "RECURSO"               },
  "RGPS-004": { caseId: "RGPS-004", benefitType: "LOAS_BPC",                          quality: "MODERATE_ISSUES",  documentType: "PETICAO_INICIAL"       },
  "RGPS-005": { caseId: "RGPS-005", benefitType: "REVISAO_APOSENTADORIA",             quality: "GOOD",             documentType: "RECURSO"               },
  "RGPS-006": { caseId: "RGPS-006", benefitType: "APOSENTADORIA_RURAL",               quality: "MODERATE_ISSUES",  documentType: "PETICAO_INICIAL"       },
  "RGPS-007": { caseId: "RGPS-007", benefitType: "TEMPO_ESPECIAL_LIGHT",              quality: "LIGHT_ISSUES",     documentType: "PETICAO_INICIAL"       },
  "RGPS-008": { caseId: "RGPS-008", benefitType: "CUMPRIMENTO_SENTENCA_PREV",         quality: "MODERATE_ISSUES",  documentType: "CUMPRIMENTO_SENTENCA"  },
  "RGPS-009": { caseId: "RGPS-009", benefitType: "REAFIRMACAO_DER",                   quality: "LIGHT_ISSUES",     documentType: "RECURSO"               },
  "RGPS-010": { caseId: "RGPS-010", benefitType: "QUALIDADE_SEGURADO",                quality: "MODERATE_ISSUES",  documentType: "PETICAO_INICIAL"       },
  "RGPS-011": { caseId: "RGPS-011", benefitType: "APOSENTADORIA_CARENCIA_COMPLETA",   quality: "GOOD",             documentType: "PETICAO_INICIAL"       },
  "RGPS-012": { caseId: "RGPS-012", benefitType: "CONVERSAO_TEMPO_ESPECIAL",          quality: "LIGHT_ISSUES",     documentType: "RECURSO"               },
  "RGPS-013": { caseId: "RGPS-013", benefitType: "AUXILIO_INCAPACIDADE",              quality: "GOOD",             documentType: "PETICAO_INICIAL"       },
  "RGPS-014": { caseId: "RGPS-014", benefitType: "PENSAO_POR_MORTE",                  quality: "MODERATE_ISSUES",  documentType: "PETICAO_INICIAL"       },
  "RGPS-015": { caseId: "RGPS-015", benefitType: "CUMPRIMENTO_JULGADO_COMPLETO",      quality: "GOOD",             documentType: "CUMPRIMENTO_SENTENCA"  },
};

export const RGPS_CASE_IDS: readonly string[] = Object.keys(SCENARIOS);

export function getRgpsScenario(caseId: string): RgpsScenarioConfig {
  const cfg = SCENARIOS[caseId];
  if (cfg === undefined) throw new Error(`Cenário RGPS não encontrado: ${caseId}`);
  return cfg;
}

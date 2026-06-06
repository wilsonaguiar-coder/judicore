/**
 * FASE 9.0.8.15 — CONSUMIDOR Scenario Factory
 *
 * Mapeamento estático dos 15 casos CONSUMIDOR para suas configurações de cenário.
 */

import type { ConsumidorScenarioConfig } from "./consumidor-scenario.types.js";

const SCENARIOS: Readonly<Record<string, ConsumidorScenarioConfig>> = {
  "CONS-001": { caseId: "CONS-001", issueType: "DANO_MORAL_CONSUMIDOR",         quality: "GOOD",            documentType: "PETICAO_INICIAL"      },
  "CONS-002": { caseId: "CONS-002", issueType: "NEGATIVACAO_INDEVIDA",          quality: "MODERATE_ISSUES", documentType: "PETICAO_INICIAL"      },
  "CONS-003": { caseId: "CONS-003", issueType: "RECUSA_COBERTURA_PLANO",        quality: "SEVERE_ISSUES",   documentType: "RECURSO"              },
  "CONS-004": { caseId: "CONS-004", issueType: "PRODUTO_DEFEITUOSO",            quality: "MODERATE_ISSUES", documentType: "PETICAO_INICIAL"      },
  "CONS-005": { caseId: "CONS-005", issueType: "COBRANA_INDEVIDA",              quality: "GOOD",            documentType: "RECURSO"              },
  "CONS-006": { caseId: "CONS-006", issueType: "RESCISAO_CONTRATO_CONSUMIDOR",  quality: "MODERATE_ISSUES", documentType: "PETICAO_INICIAL"      },
  "CONS-007": { caseId: "CONS-007", issueType: "OVERBOOKING",                   quality: "LIGHT_ISSUES",    documentType: "PETICAO_INICIAL"      },
  "CONS-008": { caseId: "CONS-008", issueType: "FURTO_CELULAR_BANCO",           quality: "MODERATE_ISSUES", documentType: "CUMPRIMENTO_SENTENCA" },
  "CONS-009": { caseId: "CONS-009", issueType: "SERVICO_DEFEITUOSO",            quality: "LIGHT_ISSUES",    documentType: "PETICAO_INICIAL"      },
  "CONS-010": { caseId: "CONS-010", issueType: "PRATICA_ABUSIVA",               quality: "MODERATE_ISSUES", documentType: "PETICAO_INICIAL"      },
  "CONS-011": { caseId: "CONS-011", issueType: "EXTRAVIO_BAGAGEM",              quality: "GOOD",            documentType: "PETICAO_INICIAL"      },
  "CONS-012": { caseId: "CONS-012", issueType: "PUBLICIDADE_ENGANOSA",          quality: "LIGHT_ISSUES",    documentType: "RECURSO"              },
  "CONS-013": { caseId: "CONS-013", issueType: "CONTRATO_BANCARIO_ABUSIVO",     quality: "GOOD",            documentType: "PETICAO_INICIAL"      },
  "CONS-014": { caseId: "CONS-014", issueType: "VICIO_CONSTRUCAO",              quality: "MODERATE_ISSUES", documentType: "PETICAO_INICIAL"      },
  "CONS-015": { caseId: "CONS-015", issueType: "CUMPRIMENTO_CONSUMIDOR",        quality: "GOOD",            documentType: "CUMPRIMENTO_SENTENCA" },
};

export const CONSUMIDOR_CASE_IDS: readonly string[] = Object.keys(SCENARIOS);

export function getConsumidorScenario(caseId: string): ConsumidorScenarioConfig {
  const cfg = SCENARIOS[caseId];
  if (cfg === undefined) throw new Error(`Cenário CONSUMIDOR não encontrado: ${caseId}`);
  return cfg;
}

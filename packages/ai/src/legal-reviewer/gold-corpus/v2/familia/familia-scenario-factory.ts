/**
 * FASE 9.0.8.10 — FAMÍLIA Scenario Factory
 *
 * Mapeamento estático dos 15 casos FAMÍLIA para suas configurações de cenário.
 */

import type { FamiliaScenarioConfig } from "./familia-scenario.types.js";

const SCENARIOS: Readonly<Record<string, FamiliaScenarioConfig>> = {
  "FAM-001": { caseId: "FAM-001", issueType: "DIVORCIO_LITIGIOSO",           quality: "GOOD",             documentType: "PETICAO_INICIAL"      },
  "FAM-002": { caseId: "FAM-002", issueType: "ALIMENTOS_FILHOS",             quality: "MODERATE_ISSUES",  documentType: "PETICAO_INICIAL"      },
  "FAM-003": { caseId: "FAM-003", issueType: "GUARDA_COMPARTILHADA",         quality: "SEVERE_ISSUES",    documentType: "RECURSO"              },
  "FAM-004": { caseId: "FAM-004", issueType: "REGULAMENTACAO_VISITAS",       quality: "MODERATE_ISSUES",  documentType: "PETICAO_INICIAL"      },
  "FAM-005": { caseId: "FAM-005", issueType: "RECONHECIMENTO_UNIAO_ESTAVEL", quality: "GOOD",             documentType: "PETICAO_INICIAL"      },
  "FAM-006": { caseId: "FAM-006", issueType: "PARTILHA_BENS",               quality: "MODERATE_ISSUES",  documentType: "PETICAO_INICIAL"      },
  "FAM-007": { caseId: "FAM-007", issueType: "ALIENACAO_PARENTAL",           quality: "LIGHT_ISSUES",     documentType: "PETICAO_INICIAL"      },
  "FAM-008": { caseId: "FAM-008", issueType: "EXONERACAO_ALIMENTOS",         quality: "MODERATE_ISSUES",  documentType: "RECURSO"              },
  "FAM-009": { caseId: "FAM-009", issueType: "INVESTIGACAO_PATERNIDADE",     quality: "LIGHT_ISSUES",     documentType: "PETICAO_INICIAL"      },
  "FAM-010": { caseId: "FAM-010", issueType: "ALTERACAO_GUARDA",             quality: "MODERATE_ISSUES",  documentType: "PETICAO_INICIAL"      },
  "FAM-011": { caseId: "FAM-011", issueType: "DISSOLUCAO_UNIAO_ESTAVEL",     quality: "GOOD",             documentType: "PETICAO_INICIAL"      },
  "FAM-012": { caseId: "FAM-012", issueType: "INTERDICAO",                   quality: "LIGHT_ISSUES",     documentType: "PETICAO_INICIAL"      },
  "FAM-013": { caseId: "FAM-013", issueType: "REVISAO_ALIMENTOS",            quality: "GOOD",             documentType: "PETICAO_INICIAL"      },
  "FAM-014": { caseId: "FAM-014", issueType: "TUTELA_CRIANCA",               quality: "MODERATE_ISSUES",  documentType: "PETICAO_INICIAL"      },
  "FAM-015": { caseId: "FAM-015", issueType: "CUMPRIMENTO_ALIMENTOS",        quality: "GOOD",             documentType: "CUMPRIMENTO_SENTENCA" },
};

export const FAMILIA_CASE_IDS: readonly string[] = Object.keys(SCENARIOS);

export function getFamiliaScenario(caseId: string): FamiliaScenarioConfig {
  const cfg = SCENARIOS[caseId];
  if (cfg === undefined) throw new Error(`Cenário FAMÍLIA não encontrado: ${caseId}`);
  return cfg;
}

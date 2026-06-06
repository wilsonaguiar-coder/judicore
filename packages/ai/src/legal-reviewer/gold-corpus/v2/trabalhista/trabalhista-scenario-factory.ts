/**
 * FASE 9.0.8.9 — Trabalhista Scenario Factory
 *
 * Mapeamento estático dos 15 casos Trabalhista V2 para suas configurações de cenário.
 * Cada caso corresponde a um claimType, quality e documentType específicos.
 */

import type { TrabalhistaScenarioConfig } from "./trabalhista-scenario.types.js";

const SCENARIOS: Readonly<Record<string, TrabalhistaScenarioConfig>> = {
  "TRAB-001": { caseId: "TRAB-001", claimType: "HORAS_EXTRAS",              quality: "GOOD",             documentType: "RECLAMACAO_TRABALHISTA" },
  "TRAB-002": { caseId: "TRAB-002", claimType: "ADICIONAL_INSALUBRIDADE",   quality: "MODERATE_ISSUES",  documentType: "RECLAMACAO_TRABALHISTA" },
  "TRAB-003": { caseId: "TRAB-003", claimType: "RESCISAO_INDIRETA",         quality: "SEVERE_ISSUES",    documentType: "RECURSO_ORDINARIO"      },
  "TRAB-004": { caseId: "TRAB-004", claimType: "DANO_MORAL_TRAB",           quality: "MODERATE_ISSUES",  documentType: "RECLAMACAO_TRABALHISTA" },
  "TRAB-005": { caseId: "TRAB-005", claimType: "FGTS_MULTA_40",             quality: "GOOD",             documentType: "RECURSO_ORDINARIO"      },
  "TRAB-006": { caseId: "TRAB-006", claimType: "RECONHECIMENTO_VINCULO",    quality: "MODERATE_ISSUES",  documentType: "RECLAMACAO_TRABALHISTA" },
  "TRAB-007": { caseId: "TRAB-007", claimType: "ASSEDIO_MORAL_TRAB",        quality: "LIGHT_ISSUES",     documentType: "RECLAMACAO_TRABALHISTA" },
  "TRAB-008": { caseId: "TRAB-008", claimType: "DEPOSITOS_FGTS_EXEC",       quality: "MODERATE_ISSUES",  documentType: "CUMPRIMENTO_SENTENCA"   },
  "TRAB-009": { caseId: "TRAB-009", claimType: "AVISO_PREVIO_PROP",         quality: "LIGHT_ISSUES",     documentType: "RECURSO_ORDINARIO"      },
  "TRAB-010": { caseId: "TRAB-010", claimType: "ADICIONAL_PERICULOSIDADE",  quality: "MODERATE_ISSUES",  documentType: "RECLAMACAO_TRABALHISTA" },
  "TRAB-011": { caseId: "TRAB-011", claimType: "EQUIPARACAO_SALARIAL",      quality: "GOOD",             documentType: "RECLAMACAO_TRABALHISTA" },
  "TRAB-012": { caseId: "TRAB-012", claimType: "INTERVALO_INTRAJORNADA",    quality: "LIGHT_ISSUES",     documentType: "RECURSO_ORDINARIO"      },
  "TRAB-013": { caseId: "TRAB-013", claimType: "VINCULO_DOMESTICO",         quality: "GOOD",             documentType: "RECLAMACAO_TRABALHISTA" },
  "TRAB-014": { caseId: "TRAB-014", claimType: "ACIDENTE_TRABALHO_TRAB",    quality: "MODERATE_ISSUES",  documentType: "RECLAMACAO_TRABALHISTA" },
  "TRAB-015": { caseId: "TRAB-015", claimType: "CUMPRIMENTO_SENTENCA_TRAB", quality: "GOOD",             documentType: "CUMPRIMENTO_SENTENCA"   },
};

export const TRABALHISTA_CASE_IDS: readonly string[] = Object.keys(SCENARIOS);

export function getTrabalhistaScenario(caseId: string): TrabalhistaScenarioConfig {
  const cfg = SCENARIOS[caseId];
  if (cfg === undefined) throw new Error(`Cenário Trabalhista não encontrado: ${caseId}`);
  return cfg;
}

/**
 * FASE 9.0.9 — Família Degradation Factory
 */

import { buildDegradationMap, goodMap } from "../degradation-map.js";
import type { QualityDegradationMap } from "../gold-corpus-v2.types.js";
import type { FamiliaScenarioConfig } from "./familia-scenario.types.js";

export function buildFamiliaDegradationMap(
  config: FamiliaScenarioConfig,
): QualityDegradationMap {
  const { caseId, quality } = config;

  if (quality === "GOOD") return goodMap(caseId);

  switch (caseId) {
    case "FAM-002":
      return buildDegradationMap(caseId, quality, [
        { elementId: "demonstrativo_necessidades", mode: "OMIT" },
      ]);

    case "FAM-003":
      return buildDegradationMap(caseId, quality, [
        { elementId: "laudo_psicossocial",    mode: "OMIT"   },
        { elementId: "historico_convivencia", mode: "ABSENT" },
      ]);

    case "FAM-004":
      return buildDegradationMap(caseId, quality, [
        { elementId: "justificativa_visitas", mode: "OMIT" },
      ]);

    case "FAM-006":
      return buildDegradationMap(caseId, quality, [
        { elementId: "inventario_bens", mode: "OMIT" },
      ]);

    case "FAM-007":
      return buildDegradationMap(caseId, quality, [
        { elementId: "evidencias_alienacao", mode: "OMIT" },
      ]);

    case "FAM-008":
      return buildDegradationMap(caseId, quality, [
        { elementId: "prova_mudanca_capacidade", mode: "OMIT" },
      ]);

    case "FAM-009":
      return buildDegradationMap(caseId, quality, [
        { elementId: "exame_dna", mode: "OMIT" },
      ]);

    case "FAM-010":
      return buildDegradationMap(caseId, quality, [
        { elementId: "fatos_mudanca_circunstancias", mode: "OMIT" },
      ]);

    case "FAM-012":
      return buildDegradationMap(caseId, quality, [
        { elementId: "laudo_medico_interdicao", mode: "OMIT" },
      ]);

    case "FAM-014":
      return buildDegradationMap(caseId, quality, [
        { elementId: "situacao_risco", mode: "OMIT" },
      ]);

    default:
      throw new Error(`Degradation map não definido para ${caseId} (quality: ${quality})`);
  }
}

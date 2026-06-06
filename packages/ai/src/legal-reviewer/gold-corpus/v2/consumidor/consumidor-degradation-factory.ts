/**
 * FASE 9.0.9 — Consumidor Degradation Factory
 */

import { buildDegradationMap, goodMap } from "../degradation-map.js";
import type { QualityDegradationMap } from "../gold-corpus-v2.types.js";
import type { ConsumidorScenarioConfig } from "./consumidor-scenario.types.js";

export function buildConsumidorDegradationMap(
  config: ConsumidorScenarioConfig,
): QualityDegradationMap {
  const { caseId, quality } = config;

  if (quality === "GOOD") return goodMap(caseId);

  switch (caseId) {
    case "CONS-002":
      return buildDegradationMap(caseId, quality, [
        { elementId: "prova_indevidade", mode: "OMIT" },
      ]);

    case "CONS-003":
      return buildDegradationMap(caseId, quality, [
        { elementId: "fundamento_cobertura", mode: "OMIT"   },
        { elementId: "laudo_medico_plano",   mode: "ABSENT" },
      ]);

    case "CONS-004":
      return buildDegradationMap(caseId, quality, [
        { elementId: "laudo_produto", mode: "OMIT" },
      ]);

    case "CONS-006":
      return buildDegradationMap(caseId, quality, [
        { elementId: "motivacao_rescisao", mode: "OMIT" },
      ]);

    case "CONS-007":
      return buildDegradationMap(caseId, quality, [
        { elementId: "prova_bilhete", mode: "OMIT" },
      ]);

    case "CONS-008":
      return buildDegradationMap(caseId, quality, [
        { elementId: "memoria_calculo_furto", mode: "OMIT" },
      ]);

    case "CONS-009":
      return buildDegradationMap(caseId, quality, [
        { elementId: "prova_servico_defeito", mode: "OMIT" },
      ]);

    case "CONS-010":
      return buildDegradationMap(caseId, quality, [
        { elementId: "clausula_abusiva", mode: "OMIT" },
      ]);

    case "CONS-012":
      return buildDegradationMap(caseId, quality, [
        { elementId: "prova_publicidade", mode: "OMIT" },
      ]);

    case "CONS-014":
      return buildDegradationMap(caseId, quality, [
        { elementId: "laudo_vicio_construcao", mode: "OMIT" },
      ]);

    default:
      throw new Error(`Degradation map não definido para ${caseId} (quality: ${quality})`);
  }
}

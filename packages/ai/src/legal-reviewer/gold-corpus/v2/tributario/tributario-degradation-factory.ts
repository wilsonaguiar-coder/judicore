/**
 * FASE 9.0.9 — Tributário Degradation Factory
 */

import { buildDegradationMap, goodMap } from "../degradation-map.js";
import type { QualityDegradationMap } from "../gold-corpus-v2.types.js";
import type { TributarioScenarioConfig } from "./tributario-scenario.types.js";

export function buildTributarioDegradationMap(
  config: TributarioScenarioConfig,
): QualityDegradationMap {
  const { caseId, quality } = config;

  if (quality === "GOOD") return goodMap(caseId);

  switch (caseId) {
    case "TRIB-002":
      return buildDegradationMap(caseId, quality, [
        { elementId: "demonstrativo_credito", mode: "OMIT" },
      ]);

    case "TRIB-003":
      return buildDegradationMap(caseId, quality, [
        { elementId: "fatos_simples",      mode: "OMIT"   },
        { elementId: "notificacao_simples", mode: "ABSENT" },
      ]);

    case "TRIB-004":
      return buildDegradationMap(caseId, quality, [
        { elementId: "comprovante_pagamento", mode: "OMIT" },
      ]);

    case "TRIB-006":
      return buildDegradationMap(caseId, quality, [
        { elementId: "impugnacao_tecnica", mode: "OMIT" },
      ]);

    case "TRIB-007":
      return buildDegradationMap(caseId, quality, [
        { elementId: "prova_requisitos_imunidade", mode: "OMIT" },
      ]);

    case "TRIB-008":
      return buildDegradationMap(caseId, quality, [
        { elementId: "calculo_parcelas", mode: "OMIT" },
      ]);

    case "TRIB-009":
      return buildDegradationMap(caseId, quality, [
        { elementId: "fundamento_redirecionamento", mode: "OMIT" },
      ]);

    case "TRIB-010":
      return buildDegradationMap(caseId, quality, [
        { elementId: "prova_pre_constituida", mode: "OMIT" },
      ]);

    case "TRIB-012":
      return buildDegradationMap(caseId, quality, [
        { elementId: "fundamento_inexigibilidade", mode: "OMIT" },
      ]);

    case "TRIB-014":
      return buildDegradationMap(caseId, quality, [
        { elementId: "calculo_prazo_decadencia", mode: "OMIT" },
      ]);

    default:
      throw new Error(`Degradation map não definido para ${caseId} (quality: ${quality})`);
  }
}

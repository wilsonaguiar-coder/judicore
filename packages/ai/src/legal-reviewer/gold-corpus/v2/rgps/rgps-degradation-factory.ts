/**
 * FASE 9.0.8.10 — RGPS Degradation Factory
 *
 * Constrói QualityDegradationMap para cada um dos 15 casos RGPS.
 *
 * - GOOD → sem degradações
 * - LIGHT_ISSUES → 1 OMIT (falha leve, gera 1 finding)
 * - MODERATE_ISSUES → 1-2 OMIT/ABSENT (falha relevante, gera findings)
 * - SEVERE_ISSUES → 2+ OMIT/ABSENT (falha estrutural, gera múltiplos findings)
 *
 * Os elementIds devem corresponder exatamente aos ids definidos
 * em rgps-element-factory.ts para cada benefitType.
 */

import { buildDegradationMap, goodMap } from "../degradation-map.js";
import type { QualityDegradationMap } from "../gold-corpus-v2.types.js";
import type { RgpsScenarioConfig } from "./rgps-scenario.types.js";

export function buildRgpsDegradationMap(
  config: RgpsScenarioConfig,
): QualityDegradationMap {
  const { caseId, quality } = config;

  if (quality === "GOOD") return goodMap(caseId);

  switch (caseId) {
    // ── RGPS-002: PPP não analisado + habitualidade ausente ───────────────────
    case "RGPS-002":
      return buildDegradationMap(caseId, quality, [
        { elementId: "ppp_referencia",          mode: "OMIT"   },
        { elementId: "habitualidade_permanencia", mode: "ABSENT" },
      ]);

    // ── RGPS-003: laudo sem enfrentamento + sem contraponto técnico ───────────
    case "RGPS-003":
      return buildDegradationMap(caseId, quality, [
        { elementId: "laudo_mencao",       mode: "OMIT"   },
        { elementId: "contraponto_tecnico", mode: "ABSENT" },
      ]);

    // ── RGPS-004: análise socioeconômica ausente ──────────────────────────────
    case "RGPS-004":
      return buildDegradationMap(caseId, quality, [
        { elementId: "miserabilidade_analise", mode: "OMIT" },
      ]);

    // ── RGPS-006: início de prova material rural ausente ──────────────────────
    case "RGPS-006":
      return buildDegradationMap(caseId, quality, [
        { elementId: "prova_material", mode: "OMIT" },
      ]);

    // ── RGPS-007: análise técnica superficial (LIGHT) ─────────────────────────
    case "RGPS-007":
      return buildDegradationMap(caseId, quality, [
        { elementId: "ppp_analise_tecnica", mode: "OMIT" },
      ]);

    // ── RGPS-008: memória de cálculo ausente ──────────────────────────────────
    case "RGPS-008":
      return buildDegradationMap(caseId, quality, [
        { elementId: "memoria_calculo", mode: "OMIT" },
      ]);

    // ── RGPS-009: reafirmação da DER não explorada (LIGHT) ───────────────────
    case "RGPS-009":
      return buildDegradationMap(caseId, quality, [
        { elementId: "argumento_reafirmacao", mode: "OMIT" },
      ]);

    // ── RGPS-010: período de graça ignorado ──────────────────────────────────
    case "RGPS-010":
      return buildDegradationMap(caseId, quality, [
        { elementId: "periodo_graca", mode: "OMIT" },
      ]);

    // ── RGPS-012: fundamentação da conversão genérica (LIGHT) ─────────────────
    case "RGPS-012":
      return buildDegradationMap(caseId, quality, [
        { elementId: "razoes_conversao", mode: "OMIT" },
      ]);

    // ── RGPS-014: dependência econômica não demonstrada ───────────────────────
    case "RGPS-014":
      return buildDegradationMap(caseId, quality, [
        { elementId: "dependencia_economica", mode: "OMIT" },
      ]);

    default:
      throw new Error(`Degradation map não definido para ${caseId} (quality: ${quality})`);
  }
}

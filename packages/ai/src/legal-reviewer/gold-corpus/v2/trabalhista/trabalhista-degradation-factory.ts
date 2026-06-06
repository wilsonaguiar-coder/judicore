/**
 * FASE 9.0.9 — Trabalhista Degradation Factory
 *
 * Constrói QualityDegradationMap para cada um dos 15 casos Trabalhista V2.
 *
 * - GOOD → sem degradações
 * - LIGHT_ISSUES → 1 OMIT (1 finding)
 * - MODERATE_ISSUES → 1-2 OMIT/ABSENT (1-2 findings)
 * - SEVERE_ISSUES → 2+ OMIT/ABSENT (múltiplos findings)
 *
 * Os elementIds correspondem exatamente aos definidos em trabalhista-element-factory.ts.
 */

import { buildDegradationMap, goodMap } from "../degradation-map.js";
import type { QualityDegradationMap } from "../gold-corpus-v2.types.js";
import type { TrabalhistaScenarioConfig } from "./trabalhista-scenario.types.js";

export function buildTrabalhistaDegradationMap(
  config: TrabalhistaScenarioConfig,
): QualityDegradationMap {
  const { caseId, quality } = config;

  if (quality === "GOOD") return goodMap(caseId);

  switch (caseId) {
    // ── TRAB-002: laudo de insalubridade ausente (MODERATE) ───────────────────
    case "TRAB-002":
      return buildDegradationMap(caseId, quality, [
        { elementId: "laudo_insalubridade", mode: "OMIT" },
      ]);

    // ── TRAB-003: fatos da rescisão indireta omitidos + notificação prévia ausente (SEVERE)
    case "TRAB-003":
      return buildDegradationMap(caseId, quality, [
        { elementId: "fatos_rescisao_indireta", mode: "OMIT"   },
        { elementId: "notificacao_mora",         mode: "ABSENT" },
      ]);

    // ── TRAB-004: nexo causal dano moral ausente (MODERATE) ──────────────────
    case "TRAB-004":
      return buildDegradationMap(caseId, quality, [
        { elementId: "nexo_causal_dano", mode: "OMIT" },
      ]);

    // ── TRAB-006: subordinação jurídica não demonstrada (MODERATE) ────────────
    case "TRAB-006":
      return buildDegradationMap(caseId, quality, [
        { elementId: "subordinacao_juridica", mode: "OMIT" },
      ]);

    // ── TRAB-007: provas do assédio moral não especificadas (LIGHT) ───────────
    case "TRAB-007":
      return buildDegradationMap(caseId, quality, [
        { elementId: "provas_assedio", mode: "OMIT" },
      ]);

    // ── TRAB-008: memória de cálculo dos depósitos de FGTS ausente (MODERATE) ─
    case "TRAB-008":
      return buildDegradationMap(caseId, quality, [
        { elementId: "memoria_calculo_fgts", mode: "OMIT" },
      ]);

    // ── TRAB-009: cálculo do aviso prévio proporcional ausente (LIGHT) ─────────
    case "TRAB-009":
      return buildDegradationMap(caseId, quality, [
        { elementId: "calculo_aviso_proporcional", mode: "OMIT" },
      ]);

    // ── TRAB-010: laudo de periculosidade ausente (MODERATE) ─────────────────
    case "TRAB-010":
      return buildDegradationMap(caseId, quality, [
        { elementId: "laudo_periculosidade", mode: "OMIT" },
      ]);

    // ── TRAB-012: registros de ponto do intervalo não juntados (LIGHT) ────────
    case "TRAB-012":
      return buildDegradationMap(caseId, quality, [
        { elementId: "registros_ponto_intervalo", mode: "OMIT" },
      ]);

    // ── TRAB-014: nexo causal acidente de trabalho não demonstrado (MODERATE) ─
    case "TRAB-014":
      return buildDegradationMap(caseId, quality, [
        { elementId: "nexo_acidente_trabalho", mode: "OMIT" },
      ]);

    default:
      throw new Error(`Degradation map não definido para ${caseId} (quality: ${quality})`);
  }
}

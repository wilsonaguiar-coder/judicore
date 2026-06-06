/**
 * FASE 9.0.8.9 — Degradation Map Helpers
 *
 * Utilitários para construir e consultar QualityDegradationMap.
 * Os tipos são definidos em gold-corpus-v2.types.ts.
 */

import type {
  DegradationMode,
  ElementDegradation,
  QualityDegradationMap,
} from "./gold-corpus-v2.types.js";

/** Constrói um QualityDegradationMap sem degradações (caso GOOD). */
export function goodMap(caseId: string): QualityDegradationMap {
  return { caseId, quality: "GOOD", degradations: [] };
}

/** Constrói um QualityDegradationMap com as degradações fornecidas. */
export function buildDegradationMap(
  caseId: string,
  quality: string,
  degradations: ElementDegradation[],
): QualityDegradationMap {
  return { caseId, quality, degradations: [...degradations] };
}

/** Cria uma ElementDegradation simples. */
export function degrade(elementId: string, mode: DegradationMode): ElementDegradation {
  return { elementId, mode };
}

/**
 * Retorna a degradação aplicada a um elementId, ou undefined se não houver.
 * Útil em renderers que consultam o mapa durante a geração do documento.
 */
export function findDegradation(
  map: QualityDegradationMap,
  elementId: string,
): ElementDegradation | undefined {
  return map.degradations.find((d) => d.elementId === elementId);
}

/**
 * FASE 9.0.8.10 — RGPS Generator V2 — API Pública
 *
 * Ponto de entrada para geração dos 15 documentos RGPS V2.
 * Orquestra: ScenarioFactory → SeedFactory → ElementFactory → DegradationFactory
 *            → ExpectedFindingDeriver → DocumentAssembler.
 *
 * Sem I/O externo. Determinístico por caseId.
 */

import { SeedFactory } from "../seed-factory.js";
import { deriveExpectedFindings } from "../expected-finding-deriver.js";
import { buildRgpsElements } from "./rgps-element-factory.js";
import { buildRgpsDegradationMap } from "./rgps-degradation-factory.js";
import { assembleRgpsDocument } from "./rgps-document-assembler.js";
import { getRgpsScenario, RGPS_CASE_IDS } from "./rgps-scenario-factory.js";
import type { GeneratedRgpsDocumentV2 } from "./rgps-scenario.types.js";

/** Gera o documento V2 para um único caso RGPS. */
export function generateRgpsDocumentV2(caseId: string): GeneratedRgpsDocumentV2 {
  const config = getRgpsScenario(caseId);
  const seed = SeedFactory.build(caseId);
  const elements = buildRgpsElements(config, seed);
  const degradationMap = buildRgpsDegradationMap(config);
  const derivedExpectedFindings = deriveExpectedFindings(
    degradationMap.degradations,
    elements,
  );
  const text = assembleRgpsDocument(config.documentType, elements, degradationMap);

  return {
    caseId,
    domain: "RGPS",
    documentType: config.documentType,
    quality: config.quality,
    text,
    derivedExpectedFindings,
    metadata: {
      generatorVersion: "v2",
      generatedAt: "2026-06-06T00:00:00.000Z",
      synthetic: true,
    },
  };
}

/** Gera todos os 15 documentos RGPS. */
export function generateAllRgpsDocumentsV2(): GeneratedRgpsDocumentV2[] {
  return RGPS_CASE_IDS.map(generateRgpsDocumentV2);
}

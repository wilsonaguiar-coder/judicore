/**
 * FASE 9.0.9 — Família Generator V2 — API Pública
 */

import { SeedFactory } from "../seed-factory.js";
import { deriveExpectedFindings } from "../expected-finding-deriver.js";
import { buildFamiliaElements } from "./familia-element-factory.js";
import { buildFamiliaDegradationMap } from "./familia-degradation-factory.js";
import { assembleFamiliaDocument } from "./familia-document-assembler.js";
import { getFamiliaScenario, FAMILIA_CASE_IDS } from "./familia-scenario-factory.js";
import type { GeneratedFamiliaDocumentV2 } from "./familia-scenario.types.js";

export function generateFamiliaDocumentV2(caseId: string): GeneratedFamiliaDocumentV2 {
  const config = getFamiliaScenario(caseId);
  const seed = SeedFactory.build(caseId);
  const elements = buildFamiliaElements(config, seed);
  const degradationMap = buildFamiliaDegradationMap(config);
  const derivedExpectedFindings = deriveExpectedFindings(
    degradationMap.degradations,
    elements,
  );
  const text = assembleFamiliaDocument(config.documentType, elements, degradationMap);

  return {
    caseId,
    domain: "FAMILIA",
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

export function generateAllFamiliaDocumentsV2(): GeneratedFamiliaDocumentV2[] {
  return FAMILIA_CASE_IDS.map(generateFamiliaDocumentV2);
}

/**
 * FASE 9.0.9 — Tributário Generator V2 — API Pública
 */

import { SeedFactory } from "../seed-factory.js";
import { deriveExpectedFindings } from "../expected-finding-deriver.js";
import { buildTributarioElements } from "./tributario-element-factory.js";
import { buildTributarioDegradationMap } from "./tributario-degradation-factory.js";
import { assembleTributarioDocument } from "./tributario-document-assembler.js";
import { getTributarioScenario, TRIBUTARIO_CASE_IDS } from "./tributario-scenario-factory.js";
import type { GeneratedTributarioDocumentV2 } from "./tributario-scenario.types.js";

export function generateTributarioDocumentV2(caseId: string): GeneratedTributarioDocumentV2 {
  const config = getTributarioScenario(caseId);
  const seed = SeedFactory.build(caseId);
  const elements = buildTributarioElements(config, seed);
  const degradationMap = buildTributarioDegradationMap(config);
  const derivedExpectedFindings = deriveExpectedFindings(
    degradationMap.degradations,
    elements,
  );
  const text = assembleTributarioDocument(config.documentType, elements, degradationMap);

  return {
    caseId,
    domain: "TRIBUTARIO",
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

export function generateAllTributarioDocumentsV2(): GeneratedTributarioDocumentV2[] {
  return TRIBUTARIO_CASE_IDS.map(generateTributarioDocumentV2);
}

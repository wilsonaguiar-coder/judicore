/**
 * FASE 9.0.9 — Consumidor Generator V2 — API Pública
 */

import { SeedFactory } from "../seed-factory.js";
import { deriveExpectedFindings } from "../expected-finding-deriver.js";
import { buildConsumidorElements } from "./consumidor-element-factory.js";
import { buildConsumidorDegradationMap } from "./consumidor-degradation-factory.js";
import { assembleConsumidorDocument } from "./consumidor-document-assembler.js";
import { getConsumidorScenario, CONSUMIDOR_CASE_IDS } from "./consumidor-scenario-factory.js";
import type { GeneratedConsumidorDocumentV2 } from "./consumidor-scenario.types.js";

export function generateConsumidorDocumentV2(caseId: string): GeneratedConsumidorDocumentV2 {
  const config = getConsumidorScenario(caseId);
  const seed = SeedFactory.build(caseId);
  const elements = buildConsumidorElements(config, seed);
  const degradationMap = buildConsumidorDegradationMap(config);
  const derivedExpectedFindings = deriveExpectedFindings(
    degradationMap.degradations,
    elements,
  );
  const text = assembleConsumidorDocument(config.documentType, elements, degradationMap);

  return {
    caseId,
    domain: "CONSUMIDOR",
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

export function generateAllConsumidorDocumentsV2(): GeneratedConsumidorDocumentV2[] {
  return CONSUMIDOR_CASE_IDS.map(generateConsumidorDocumentV2);
}

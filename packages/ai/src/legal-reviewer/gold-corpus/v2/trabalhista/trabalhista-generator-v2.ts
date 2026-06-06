/**
 * FASE 9.0.9 — Trabalhista Generator V2 — API Pública
 *
 * Ponto de entrada para geração dos 15 documentos Trabalhista V2.
 * Orquestra: ScenarioFactory → SeedFactory → ElementFactory → DegradationFactory
 *            → ExpectedFindingDeriver → DocumentAssembler.
 *
 * Sem I/O externo. Determinístico por caseId.
 */

import { SeedFactory } from "../seed-factory.js";
import { deriveExpectedFindings } from "../expected-finding-deriver.js";
import { buildTrabalhistaElements } from "./trabalhista-element-factory.js";
import { buildTrabalhistaDegradationMap } from "./trabalhista-degradation-factory.js";
import { assembleTrabalhistaDocument } from "./trabalhista-document-assembler.js";
import { getTrabalhistaScenario, TRABALHISTA_CASE_IDS } from "./trabalhista-scenario-factory.js";
import type { GeneratedTrabalhistaDocumentV2 } from "./trabalhista-scenario.types.js";

/** Gera o documento V2 para um único caso Trabalhista. */
export function generateTrabalhistaDocumentV2(caseId: string): GeneratedTrabalhistaDocumentV2 {
  const config = getTrabalhistaScenario(caseId);
  const seed = SeedFactory.build(caseId);
  const elements = buildTrabalhistaElements(config, seed);
  const degradationMap = buildTrabalhistaDegradationMap(config);
  const derivedExpectedFindings = deriveExpectedFindings(
    degradationMap.degradations,
    elements,
  );
  const text = assembleTrabalhistaDocument(config.documentType, elements, degradationMap);

  return {
    caseId,
    domain: "TRABALHISTA",
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

/** Gera todos os 15 documentos Trabalhista V2. */
export function generateAllTrabalhistaDocumentsV2(): GeneratedTrabalhistaDocumentV2[] {
  return TRABALHISTA_CASE_IDS.map(generateTrabalhistaDocumentV2);
}

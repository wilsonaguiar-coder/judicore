/**
 * FASE 9.0.5B — Documentos Jurídicos Sintéticos Pré-gerados
 *
 * Exporta os 100 documentos gerados deterministicamente a partir do goldCorpusV1.
 * Cada documento é estável — o mesmo caseId sempre produz o mesmo texto.
 *
 * IMPORTANTE: Este arquivo é geração de dados — sem lógica executável.
 */

import { GoldCorpusDocumentGeneratorService } from "./gold-corpus-document-generator.service.js";
import { goldCorpusV1 } from "./gold-corpus-v1.spec.js";
import type { GeneratedGoldCorpusDocument } from "./gold-corpus-document-generator.service.js";

const _generator = new GoldCorpusDocumentGeneratorService();

export const goldCorpusGeneratedDocuments: GeneratedGoldCorpusDocument[] =
  _generator.generateAll(goldCorpusV1);

import type { LegalArea } from "@judicore/search";

export type IndexingSource = "datajud" | "stj" | "stf" | "lexml";

export interface IndexingJobData {
  area: LegalArea;
  sources: IndexingSource[];
  // termos de busca pré-definidos por área — ampliados ao longo do tempo
  queries: string[];
  maxPages: number;
  triggeredBy: "scheduler" | "manual";
}

export interface IndexingJobResult {
  area: LegalArea;
  indexed: number;
  failed: number;
  durationMs: number;
  completedAt: string;
}

export const INDEXING_QUEUE = "indexing";

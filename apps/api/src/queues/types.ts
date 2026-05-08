import type { LegalArea } from "@judicore/search";

export type IndexingSource = "datajud" | "stj" | "stf" | "tst";

export interface IndexingJobData {
  area: LegalArea;
  sources: IndexingSource[];
  queries: string[];
  tribunais?: string[];
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

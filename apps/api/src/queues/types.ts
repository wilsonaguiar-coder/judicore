import type { LegalArea } from "@judicore/search";

export type IndexingSource = "datajud" | "stj" | "stf" | "tst";

export interface IndexingJobData {
  area: LegalArea;
  sources: IndexingSource[];
  queries: string[];
  tribunais?: string[];
  maxPages: number;
  triggeredBy: "scheduler" | "manual";
  startDate?: string;  // YYYY-MM-DD — filtro de data inicial (TST)
  endDate?: string;    // YYYY-MM-DD — filtro de data final (TST)
  delayMs?: number;    // delay entre páginas (padrão: 2000ms para TST histórico)
}

export interface IndexingJobResult {
  area: LegalArea;
  indexed: number;
  failed: number;
  durationMs: number;
  completedAt: string;
}

export const INDEXING_QUEUE = "indexing";

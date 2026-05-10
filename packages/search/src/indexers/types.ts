import type { Jurisprudencia, LegalArea } from "../types.js";

export interface IndexerOptions {
  area?: LegalArea;
  tribunais?: string[];
  maxPages?: number;
  delayMs?: number;       // pausa entre requisições (respeito ao servidor)
  startDate?: string;     // YYYY-MM-DD — filtro de data inicial (suportado pelo TST)
  endDate?: string;       // YYYY-MM-DD — filtro de data final
}

export interface IndexerResult {
  indexed: number;
  failed: number;
  source: string;
}

export interface JurisprudenciaAdapter {
  name: string;
  fetch(query: string, options: IndexerOptions): AsyncGenerator<Jurisprudencia[]>;
}

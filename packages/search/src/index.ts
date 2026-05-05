export { getElasticsearchClient } from "./client.js";
export { ensureIndices, JURISPRUDENCIA_INDEX } from "./indices.js";
export { searchJurisprudencia } from "./search.js";
export { indexJurisprudencia, bulkIndexJurisprudencia } from "./ingest.js";
export { runIndexer } from "./indexer.js";
export type { Jurisprudencia, SearchParams, SearchResult, LegalArea } from "./types.js";
export { datajudAdapter, stjAdapter, stfAdapter } from "./indexers/index.js";
export type { JurisprudenciaAdapter, IndexerOptions, IndexerResult } from "./indexers/types.js";

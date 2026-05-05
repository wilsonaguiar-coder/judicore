import { bulkIndexJurisprudencia } from "./ingest.js";
import { ensureIndices } from "./indices.js";
import type { JurisprudenciaAdapter, IndexerOptions, IndexerResult } from "./indexers/types.js";

export async function runIndexer(
  adapter: JurisprudenciaAdapter,
  query: string,
  options: IndexerOptions = {}
): Promise<IndexerResult> {
  await ensureIndices();

  let indexed = 0;
  let failed = 0;

  console.log(`[${adapter.name}] Iniciando indexação para: "${query}"`);

  for await (const batch of adapter.fetch(query, options)) {
    const batchFinal = options.area
      ? batch.map((doc) => ({ ...doc, area: options.area! }))
      : batch;
    try {
      await bulkIndexJurisprudencia(batchFinal);
      indexed += batch.length;
      console.log(`[${adapter.name}] +${batch.length} (total: ${indexed})`);
    } catch (err) {
      failed += batch.length;
      console.error(`[${adapter.name}] Falha no batch:`, err);
    }
  }

  console.log(`[${adapter.name}] Concluído. Indexados: ${indexed}, Falhos: ${failed}`);
  return { indexed, failed, source: adapter.name };
}

import { Worker } from "bullmq";
import { getRedisConnection } from "./redis.js";
import { INDEXING_QUEUE } from "./types.js";
import type { IndexingJobData, IndexingJobResult } from "./types.js";
import { runIndexer, datajudAdapter, stjAdapter, stfAdapter } from "@judicore/search";
import type { JurisprudenciaAdapter, IndexerOptions } from "@judicore/search";

const ADAPTER_MAP: Record<string, JurisprudenciaAdapter> = {
  datajud: datajudAdapter,
  stj:     stjAdapter,
  stf:     stfAdapter,
};

export function startIndexingWorker(): Worker<IndexingJobData, IndexingJobResult> {
  const worker = new Worker<IndexingJobData, IndexingJobResult>(
    INDEXING_QUEUE,
    async (job) => {
      const { area, sources = ["datajud", "stj"], queries, maxPages } = job.data;
      const start = Date.now();

      console.log(`[worker] Iniciando job ${job.id} — área: ${area}, fontes: ${sources.join(", ")}`);

      let totalIndexed = 0;
      let totalFailed = 0;

      const options: IndexerOptions = {
        area,
        maxPages,
        delayMs: 1200,
      };

      for (const source of sources) {
        const adapter = ADAPTER_MAP[source];
        if (!adapter) continue;

        for (const query of queries) {
          await job.updateProgress({
            source,
            query,
            indexed: totalIndexed,
          });

          const result = await runIndexer(adapter, query, options);
          totalIndexed += result.indexed;
          totalFailed += result.failed;
        }
      }

      const result: IndexingJobResult = {
        area,
        indexed: totalIndexed,
        failed: totalFailed,
        durationMs: Date.now() - start,
        completedAt: new Date().toISOString(),
      };

      console.log(`[worker] Job ${job.id} concluído: +${totalIndexed} indexados em ${result.durationMs}ms`);
      return result;
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
      stalledInterval: 120000, // verifica stall a cada 2 min (padrão 30s — insuficiente com inteiro teor)
      maxStalledCount: 3,      // permite 3 stalls antes de falhar
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[worker] Job ${job?.id} falhou (tentativa ${job?.attemptsMade}):`, err.message);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`[worker] Job ${jobId} travou e será re-enfileirado`);
  });

  return worker;
}

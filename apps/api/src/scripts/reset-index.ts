/**
 * Para todos os jobs, limpa a fila BullMQ e apaga o índice Elasticsearch.
 * Uso: ELASTICSEARCH_URL=... REDIS_URL=... npx tsx src/scripts/reset-index.ts
 */

import { Queue } from "bullmq";
import { getElasticsearchClient } from "@judicore/search";
import { getRedisConnection } from "../queues/redis.js";
import { INDEXING_QUEUE } from "../queues/types.js";

const client = getElasticsearchClient();
const INDEX  = "jurisprudencia";

async function main() {
  // 1. Limpa a fila BullMQ (jobs ativos, aguardando, repetíveis, falhos, concluídos)
  console.log("Limpando fila BullMQ...");
  const queue = new Queue(INDEXING_QUEUE, { connection: getRedisConnection() });

  const repeatables = await queue.getRepeatableJobs();
  for (const job of repeatables) {
    await queue.removeRepeatableByKey(job.key);
    console.log(`  Removido agendamento: ${job.name}`);
  }

  await queue.drain(true);   // remove jobs aguardando e ativos
  await queue.clean(0, 1000, "completed");
  await queue.clean(0, 1000, "failed");
  await queue.close();
  console.log("  Fila limpa.");

  // 2. Apaga o índice Elasticsearch
  console.log("Apagando índice Elasticsearch...");
  const exists = await client.indices.exists({ index: INDEX });
  if (exists) {
    await client.indices.delete({ index: INDEX });
    console.log(`  Índice '${INDEX}' apagado.`);
  } else {
    console.log(`  Índice '${INDEX}' não existe — nada a apagar.`);
  }

  console.log("\nConcluído. Suba o judicore-search para recriar o índice e reativar os agendamentos.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });

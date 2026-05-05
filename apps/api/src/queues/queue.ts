import { Queue } from "bullmq";
import { getRedisConnection } from "./redis.js";
import { INDEXING_QUEUE } from "./types.js";
import type { IndexingJobData } from "./types.js";

let _queue: Queue<IndexingJobData> | null = null;

export function getIndexingQueue(): Queue<IndexingJobData> {
  if (!_queue) {
    _queue = new Queue<IndexingJobData>(INDEXING_QUEUE, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 60_000 }, // 1min, 2min, 4min
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return _queue;
}

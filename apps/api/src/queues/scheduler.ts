import { getIndexingQueue } from "./queue.js";
import { SCHEDULE_CONFIG, buildJobData } from "./schedule-config.js";

export async function registerScheduledJobs(): Promise<void> {
  const queue = getIndexingQueue();

  // Remove jobs recorrentes anteriores para evitar duplicatas ao reiniciar
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    await queue.removeRepeatableByKey(job.key);
  }

  for (const config of SCHEDULE_CONFIG) {
    const jobData = buildJobData(config.area, config.sources, config.maxPages, "scheduler");

    await queue.add(
      `indexing:${config.area}`,
      jobData,
      {
        repeat: { pattern: config.cron, tz: "America/Sao_Paulo" },
        jobId: `scheduled:${config.area}`,
      }
    );

    console.log(`[scheduler] Agendado: ${config.area} → cron "${config.cron}"`);
  }

  console.log(`[scheduler] ${SCHEDULE_CONFIG.length} jobs agendados.`);
}

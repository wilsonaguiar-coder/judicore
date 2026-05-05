import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getIndexingQueue } from "../queues/queue.js";
import { buildJobData, SCHEDULE_CONFIG } from "../queues/schedule-config.js";
import type { LegalArea } from "@judicore/search";

const triggerSchema = z.object({
  area: z.enum([
    "TRIBUTARIO", "PREVIDENCIARIO", "ADMINISTRATIVO", "CRIMINAL",
    "AMBIENTAL", "TRABALHISTA", "CIVIL", "OUTRO",
  ]),
  sources: z.array(z.enum(["datajud", "stj", "stf"])).optional(),
  maxPages: z.number().int().min(1).max(10).optional(),
});

export async function adminRoutes(app: FastifyInstance) {
  const authenticate = (app as any).authenticate;

  async function requireAdmin(request: any, reply: any) {
    const payload = request.user as { role?: string };
    if (payload.role !== "ADMIN") {
      return reply.status(403).send({ error: "Acesso restrito a administradores" });
    }
  }

  // GET /admin/jobs — lista status da fila
  app.get(
    "/jobs",
    { onRequest: [authenticate, requireAdmin] },
    async () => {
      const queue = getIndexingQueue();

      const [active, waiting, completed, failed, delayed, repeatable] = await Promise.all([
        queue.getActive(),
        queue.getWaiting(),
        queue.getCompleted(0, 9),
        queue.getFailed(0, 9),
        queue.getDelayed(),
        queue.getRepeatableJobs(),
      ]);

      return {
        counts: {
          active:    active.length,
          waiting:   waiting.length,
          delayed:   delayed.length,
        },
        active: active.map(serializeJob),
        waiting: waiting.map(serializeJob),
        recentCompleted: completed.map(serializeJob),
        recentFailed: failed.map(serializeJob),
        scheduled: repeatable.map((j) => ({
          key:   j.key,
          name:  j.name,
          cron:  j.pattern,
          next:  j.next ? new Date(j.next).toISOString() : null,
        })),
      };
    }
  );

  // POST /admin/jobs/trigger — dispara indexação manual para uma área
  app.post(
    "/jobs/trigger",
    { onRequest: [authenticate, requireAdmin] },
    async (request, reply) => {
      const body = triggerSchema.safeParse(request.body);
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

      const { area, sources, maxPages } = body.data;

      // Usa configuração padrão da área se não informado
      const defaultConfig = SCHEDULE_CONFIG.find((c) => c.area === area);
      const jobData = buildJobData(
        area as LegalArea,
        sources ?? defaultConfig?.sources ?? ["datajud", "stj", "stf"],
        maxPages ?? defaultConfig?.maxPages ?? 3,
        "manual"
      );

      const queue = getIndexingQueue();
      const job = await queue.add(`manual:${area}`, jobData, {
        priority: 1, // prioridade alta — manual passa na frente do scheduler
      });

      return reply.status(202).send({
        jobId: job.id,
        area,
        queries: jobData.queries.length,
        sources: jobData.sources,
        message: "Job enfileirado com sucesso",
      });
    }
  );

  // GET /admin/jobs/:id — status de um job específico
  app.get(
    "/jobs/:id",
    { onRequest: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const queue = getIndexingQueue();
      const job = await queue.getJob(id);

      if (!job) return reply.status(404).send({ error: "Job não encontrado" });

      return serializeJob(job);
    }
  );

  // DELETE /admin/jobs/:id — cancela job pendente
  app.delete(
    "/jobs/:id",
    { onRequest: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const queue = getIndexingQueue();
      const job = await queue.getJob(id);

      if (!job) return reply.status(404).send({ error: "Job não encontrado" });

      await job.remove();
      return reply.status(204).send();
    }
  );
}

function serializeJob(job: any) {
  return {
    id:          job.id,
    name:        job.name,
    data:        job.data,
    progress:    job.progress,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    timestamp:   job.timestamp ? new Date(job.timestamp).toISOString() : null,
    processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
    finishedOn:  job.finishedOn  ? new Date(job.finishedOn).toISOString()  : null,
  };
}

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getIndexingQueue } from "../queues/queue.js";
import { buildJobData, SCHEDULE_CONFIG } from "../queues/schedule-config.js";
import { getElasticsearchClient, JURISPRUDENCIA_INDEX, ensureIndices } from "@judicore/search";
import type { LegalArea } from "@judicore/search";
import { prisma } from "@judicore/db";

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

  // GET /admin/stats — estatísticas do índice Elasticsearch
  app.get(
    "/stats",
    { onRequest: [authenticate, requireAdmin] },
    async () => {
      await ensureIndices();
      const es = getElasticsearchClient();
      const res = await es.search({
        index: JURISPRUDENCIA_INDEX,
        body: {
          size: 0,
          track_total_hits: true,
          aggs: {
            por_area: { terms: { field: "area", size: 20 } },
            por_tribunal: { terms: { field: "tribunal", size: 40 } },
          },
        },
      });

      const total = (res.hits.total as any)?.value ?? 0;
      const areasBuckets = (res.aggregations?.por_area as any)?.buckets ?? [];
      const tribunaisBuckets = (res.aggregations?.por_tribunal as any)?.buckets ?? [];

      return {
        total,
        porArea: areasBuckets.map((b: any) => ({ area: b.key, count: b.doc_count })),
        porTribunal: tribunaisBuckets.map((b: any) => ({ tribunal: b.key, count: b.doc_count })),
      };
    }
  );

  // GET /admin/jobs — lista status da fila
  app.get(
    "/jobs",
    { onRequest: [authenticate, requireAdmin] },
    async () => {
      const queue = getIndexingQueue();

      const [active, waiting, prioritized, completed, failed, delayed, repeatable] = await Promise.all([
        queue.getActive(),
        queue.getWaiting(),
        queue.getJobs(["prioritized"]),
        queue.getCompleted(0, 9),
        queue.getFailed(0, 9),
        queue.getDelayed(),
        queue.getRepeatableJobs(),
      ]);

      const allWaiting = [...waiting, ...prioritized].filter(Boolean);

      return {
        counts: {
          active:    active.filter(Boolean).length,
          waiting:   allWaiting.length,
          delayed:   delayed.filter(Boolean).length,
        },
        active: active.filter(Boolean).map(serializeJob),
        waiting: allWaiting.map(serializeJob),
        recentCompleted: completed.filter(Boolean).map(serializeJob),
        recentFailed: failed.filter(Boolean).map(serializeJob),
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

  // POST /admin/jobs/trigger-all — dispara indexação para todas as áreas
  app.post(
    "/jobs/trigger-all",
    { onRequest: [authenticate, requireAdmin] },
    async (request, reply) => {
      const body = z.object({
        sources: z.array(z.enum(["datajud", "stj", "stf"])).optional(),
        maxPages: z.number().int().min(1).max(10).optional(),
      }).safeParse(request.body);
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

      const { sources, maxPages } = body.data;
      const queue = getIndexingQueue();

      const areas: LegalArea[] = ["TRIBUTARIO", "PREVIDENCIARIO", "ADMINISTRATIVO", "CRIMINAL", "AMBIENTAL", "TRABALHISTA", "CIVIL", "OUTRO"];
      const jobs = await Promise.all(
        areas.map((area) => {
          const defaultConfig = SCHEDULE_CONFIG.find((c) => c.area === area);
          const jobData = buildJobData(
            area,
            sources ?? defaultConfig?.sources ?? ["datajud", "stj"],
            maxPages ?? defaultConfig?.maxPages ?? 5,
            "manual"
          );
          return queue.add(`manual:${area}`, jobData, { priority: 1 });
        })
      );

      return reply.status(202).send({
        enqueued: jobs.length,
        jobIds: jobs.map((j) => j.id),
        message: "Todas as áreas enfileiradas",
      });
    }
  );

  // POST /admin/jobs/clean — remove completed e failed da fila
  app.post(
    "/jobs/clean",
    { onRequest: [authenticate, requireAdmin] },
    async () => {
      const queue = getIndexingQueue();
      const [completed, failed] = await Promise.all([
        queue.clean(0, 1000, "completed"),
        queue.clean(0, 1000, "failed"),
      ]);
      return { removed: { completed: completed.length, failed: failed.length } };
    }
  );

  // GET /admin/usage — consumo de tokens por serviço/dia (últimos 30 dias)
  app.get(
    "/usage",
    { onRequest: [authenticate, requireAdmin] },
    async (request) => {
      const { days } = (request.query as any);
      const period = Math.min(parseInt(days ?? "30") || 30, 90);
      const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

      const logs = await prisma.usageLog.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
      });

      // Agrega por dia + serviço
      const byDay: Record<string, { date: string; groqInput: number; groqOutput: number; geminiInput: number }> = {};
      let totalGroqInput = 0, totalGroqOutput = 0, totalGeminiInput = 0;

      for (const log of logs) {
        const date = log.createdAt.toISOString().slice(0, 10);
        if (!byDay[date]) byDay[date] = { date, groqInput: 0, groqOutput: 0, geminiInput: 0 };
        if (log.service === "groq") {
          byDay[date].groqInput  += log.inputTokens;
          byDay[date].groqOutput += log.outputTokens;
          totalGroqInput  += log.inputTokens;
          totalGroqOutput += log.outputTokens;
        } else {
          byDay[date].geminiInput += log.inputTokens;
          totalGeminiInput += log.inputTokens;
        }
      }

      // Agrega por tipo de documento
      const byDocType: Record<string, { input: number; output: number; count: number }> = {};
      for (const log of logs.filter(l => l.service === "groq" && l.docType)) {
        const k = log.docType!;
        if (!byDocType[k]) byDocType[k] = { input: 0, output: 0, count: 0 };
        byDocType[k].input  += log.inputTokens;
        byDocType[k].output += log.outputTokens;
        byDocType[k].count  += 1;
      }

      return {
        period,
        totals: { groqInput: totalGroqInput, groqOutput: totalGroqOutput, geminiInput: totalGeminiInput },
        byDay: Object.values(byDay),
        byDocType,
      };
    }
  );

  // POST /admin/usage/log — endpoint interno para o serviço Python registrar uso do Gemini
  app.post("/usage/log", async (request, reply) => {
    const secret = process.env["INTERNAL_SECRET"] ?? process.env["JWT_SECRET"] ?? "";
    const authHeader = (request.headers["x-internal-secret"] as string) ?? "";
    if (authHeader !== secret) return reply.status(401).send({ error: "Não autorizado" });

    const body = z.object({
      service:      z.string(),
      model:        z.string(),
      operation:    z.string(),
      inputTokens:  z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative().default(0),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    await prisma.usageLog.create({ data: body.data });
    return reply.status(201).send({ ok: true });
  });

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

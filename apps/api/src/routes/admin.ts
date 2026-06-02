import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { spawn } from "node:child_process";
import { promises as fsp } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { getIndexingQueue } from "../queues/queue.js";
import { buildJobData, SCHEDULE_CONFIG } from "../queues/schedule-config.js";
import { getElasticsearchClient, JURISPRUDENCIA_INDEX, ensureIndices } from "@judicore/search";
import type { LegalArea } from "@judicore/search";
import { prisma } from "@judicore/db";

const SEARCH_SERVICE_URL = process.env["SEARCH_SERVICE_URL"] ?? "http://127.0.0.1:7860";

// ── TRF ingestion ─────────────────────────────────────────────────────────────

const __routeDir = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__routeDir, "../../src/scripts");
const TRF_VENV = process.env["TRF_VENV_PATH"] ?? "/opt/judicore/trf_venv";
const TRF_PYTHON = `${TRF_VENV}/bin/python3`;
const ES_URL_DEFAULT = process.env["ELASTICSEARCH_URL"] ?? "http://localhost:9200";

const VALID_TRFS = ["TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6"] as const;

interface TrfJob {
  id: string;
  tribunal: string;
  status: "running" | "completed" | "failed";
  lines: string[];
  indexed: number;
  startedAt: string;
  finishedAt: string | null;
}

const trfJobs = new Map<string, TrfJob>();

async function ensureTrfVenv(): Promise<void> {
  try {
    await fsp.access(TRF_PYTHON);
    return;
  } catch {
    await fsp.mkdir("/opt/judicore", { recursive: true });
    await spawnAsync("python3", ["-m", "venv", TRF_VENV]);
    await spawnAsync(TRF_PYTHON, ["-m", "pip", "install", "--quiet", "elasticsearch>=8,<9", "pymupdf"]);
  }
}

function spawnAsync(cmd: string, args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args);
    p.on("close", (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited with code ${code}`))));
    p.on("error", rej);
  });
}

function getTrfScriptPath(tribunal: string): string {
  const num = tribunal.replace("TRF", "").toLowerCase();
  return resolve(SCRIPTS_DIR, `trf${num}_ingest_es.py`);
}

async function proxyToSearchService(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SEARCH_SERVICE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const triggerSchema = z.object({
  area: z.enum([
    "TRIBUTARIO", "PREVIDENCIARIO", "ADMINISTRATIVO", "CRIMINAL",
    "AMBIENTAL", "TRABALHISTA", "CIVIL", "OUTRO",
  ]),
  sources: z.array(z.enum(["tst"])).optional(),
  maxPages: z.number().int().min(1).max(10000).optional(),
});

export async function adminRoutes(app: FastifyInstance) {
  const authenticate = (app as any).authenticate;

  async function requireAdmin(request: any, reply: any) {
    const payload = request.user as { role?: string };
    if (payload.role !== "ADMIN") {
      return reply.status(403).send({ error: "Acesso restrito a administradores" });
    }
  }

  await registerUserRoutes(app, authenticate, requireAdmin);

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
        sources: z.array(z.enum(["tst"])).optional(),
        maxPages: z.number().int().min(1).max(10000).optional(),
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
            sources ?? defaultConfig?.sources ?? ["tst"],
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

  // GET /admin/lancedb/info — última data indexada por tribunal no LanceDB
  app.get(
    "/lancedb/info",
    { onRequest: [authenticate, requireAdmin] },
    async (_request, reply) => {
      const { status, body } = await proxyToSearchService("/index-info");
      return reply.status(status).send(body);
    }
  );

  // POST /admin/lancedb/update — dispara atualização incremental do LanceDB
  app.post(
    "/lancedb/update",
    { onRequest: [authenticate, requireAdmin] },
    async (request, reply) => {
      const schema = z.object({
        sources:      z.array(z.enum(["stf", "stj"])).min(1).default(["stf", "stj"]),
        since_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        year:         z.number().int().min(2020).max(2030).optional(),
        skip_browser: z.boolean().default(false),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      const { status, body } = await proxyToSearchService("/update", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      return reply.status(status).send(body);
    }
  );

  // GET /admin/lancedb/update/:jobId — status de um job de atualização LanceDB
  app.get(
    "/lancedb/update/:jobId",
    { onRequest: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const { status, body } = await proxyToSearchService(`/update/${jobId}`);
      return reply.status(status).send(body);
    }
  );

  // POST /admin/lancedb/stj/upload — recebe PDFs do cliente e envia ao serviço Python
  app.post(
    "/lancedb/stj/upload",
    {
      onRequest: [authenticate, requireAdmin],
      config: { rawBody: true },
    },
    async (request, reply) => {
      // Lê os arquivos via multipart e reconstrói um FormData para o serviço Python
      const parts = (request as any).parts({ limits: { fileSize: 30 * 1024 * 1024, files: 50 } });
      const form = new FormData();

      for await (const part of parts) {
        if (part.type === "file") {
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) chunks.push(chunk);
          const buf = Buffer.concat(chunks);
          form.append("files", new Blob([buf], { type: part.mimetype }), part.filename);
        }
      }

      const res = await fetch(`${SEARCH_SERVICE_URL}/stj/upload`, {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      return reply.status(res.status).send(body);
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

      // Agrega por dia + serviço (groq e openai separados)
      const byDay: Record<string, { date: string; groqInput: number; groqOutput: number; openaiInput: number; openaiOutput: number; geminiInput: number }> = {};
      let totalGroqInput = 0, totalGroqOutput = 0, totalOpenaiInput = 0, totalOpenaiOutput = 0, totalGeminiInput = 0;

      for (const log of logs) {
        const date = log.createdAt.toISOString().slice(0, 10);
        if (!byDay[date]) byDay[date] = { date, groqInput: 0, groqOutput: 0, openaiInput: 0, openaiOutput: 0, geminiInput: 0 };
        if (log.service === "groq") {
          byDay[date].groqInput  += log.inputTokens;
          byDay[date].groqOutput += log.outputTokens;
          totalGroqInput  += log.inputTokens;
          totalGroqOutput += log.outputTokens;
        } else if (log.service === "openai") {
          byDay[date].openaiInput  += log.inputTokens;
          byDay[date].openaiOutput += log.outputTokens;
          totalOpenaiInput  += log.inputTokens;
          totalOpenaiOutput += log.outputTokens;
        } else {
          byDay[date].geminiInput += log.inputTokens;
          totalGeminiInput += log.inputTokens;
        }
      }

      // Agrega por tipo de documento (separado por serviço)
      const byDocType: Record<string, { groqInput: number; groqOutput: number; openaiInput: number; openaiOutput: number; count: number }> = {};
      for (const log of logs.filter((l: (typeof logs)[0]) => (l.service === "groq" || l.service === "openai") && l.docType)) {
        const k = log.docType!;
        if (!byDocType[k]) byDocType[k] = { groqInput: 0, groqOutput: 0, openaiInput: 0, openaiOutput: 0, count: 0 };
        if (log.service === "groq") {
          byDocType[k].groqInput  += log.inputTokens;
          byDocType[k].groqOutput += log.outputTokens;
        } else {
          byDocType[k].openaiInput  += log.inputTokens;
          byDocType[k].openaiOutput += log.outputTokens;
        }
        byDocType[k].count += 1;
      }

      return {
        period,
        totals: { groqInput: totalGroqInput, groqOutput: totalGroqOutput, openaiInput: totalOpenaiInput, openaiOutput: totalOpenaiOutput, geminiInput: totalGeminiInput },
        byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
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

  // POST /admin/trf/upload — recebe PDF(s) de boletim TRF e indexa no ES
  app.post(
    "/trf/upload",
    {
      onRequest: [authenticate, requireAdmin],
      config: { rawBody: true },
      bodyLimit: 200 * 1024 * 1024, // 200 MB — suficiente para um lote mensal
    },
    async (request, reply) => {
      const tribunal = ((request.query as any).tribunal as string)?.toUpperCase();
      if (!VALID_TRFS.includes(tribunal as any)) {
        return reply.status(400).send({ error: `Tribunal inválido. Use: ${VALID_TRFS.join(", ")}` });
      }

      const scriptPath = getTrfScriptPath(tribunal);
      try {
        await fsp.access(scriptPath);
      } catch {
        return reply.status(400).send({ error: `Script de ingestão para ${tribunal} ainda não implementado` });
      }

      const jobId = randomUUID();
      const tmpDir = `/tmp/trf_upload_${jobId}`;
      await fsp.mkdir(tmpDir, { recursive: true });

      const parts = (request as any).parts({ limits: { fileSize: 50 * 1024 * 1024, files: 100 } });
      let fileCount = 0;

      for await (const part of parts) {
        if (part.type === "file" && part.filename?.toLowerCase().endsWith(".pdf")) {
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) chunks.push(chunk);
          await fsp.writeFile(resolve(tmpDir, part.filename), Buffer.concat(chunks));
          fileCount++;
        } else if (part.type === "file") {
          for await (const _ of part.file) {} // drain
        }
      }

      if (fileCount === 0) {
        await fsp.rm(tmpDir, { recursive: true, force: true });
        return reply.status(400).send({ error: "Nenhum PDF enviado" });
      }

      const job: TrfJob = {
        id: jobId,
        tribunal,
        status: "running",
        lines: [`Iniciando ingestão ${tribunal} — ${fileCount} PDF(s)…`],
        indexed: 0,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      };
      trfJobs.set(jobId, job);

      // executa em background
      (async () => {
        try {
          job.lines.push("Verificando ambiente Python…");
          await ensureTrfVenv();
          job.lines.push("Ambiente pronto. Processando PDFs…");

          const proc = spawn(TRF_PYTHON, [
            scriptPath, "--folder", tmpDir, "--es-url", ES_URL_DEFAULT, "--batch", "50", "--reset",
          ]);

          proc.stdout.on("data", (data: Buffer) => {
            const lines = data.toString("utf8").split("\n").filter(Boolean);
            job.lines.push(...lines);
            if (job.lines.length > 500) job.lines = job.lines.slice(-500);
          });

          proc.stderr.on("data", (data: Buffer) => {
            const lines = data.toString("utf8").split("\n").filter(Boolean);
            job.lines.push(...lines);
          });

          await new Promise<void>((res, rej) => {
            proc.on("close", (code) => (code === 0 ? res() : rej(new Error(`Processo encerrou com código ${code}`))));
            proc.on("error", rej);
          });

          const allOutput = job.lines.join("\n");
          const m = allOutput.match(/Indexados\s*:\s*(\d+)/i);
          job.indexed = m?.[1] ? parseInt(m[1]) : 0;
          job.status = "completed";
        } catch (e: any) {
          job.lines.push(`❌ Erro: ${e.message}`);
          job.status = "failed";
        } finally {
          job.finishedAt = new Date().toISOString();
          await fsp.rm(tmpDir, { recursive: true, force: true });
        }
      })();

      return reply.status(202).send({ jobId, tribunal, files: fileCount });
    }
  );

  // GET /admin/trf/job/:id — status de um job de ingestão TRF
  app.get(
    "/trf/job/:id",
    { onRequest: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const job = trfJobs.get(id);
      if (!job) return reply.status(404).send({ error: "Job não encontrado" });
      return job;
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

function hashPassword(password: string): string {
  return createHash("sha256").update(password + (process.env["JWT_SECRET"] ?? "")).digest("hex");
}

// ── User management ───────────────────────────────────────────────────────────

async function registerUserRoutes(app: FastifyInstance, authenticate: any, requireAdmin: any) {
  // GET /admin/users — lista todos os usuários
  app.get("/users", { onRequest: [authenticate, requireAdmin] }, async () => {
    return prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, accessExpiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  });

  // POST /admin/users — cria usuário
  app.post("/users", { onRequest: [authenticate, requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
      role: z.enum(["COMUM", "SERVIDOR", "ADMIN"]).default("COMUM"),
      accessExpiresAt: z.string().datetime().nullable().optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (existing) return reply.status(409).send({ error: "E-mail já cadastrado" });

    const user = await prisma.user.create({
      data: {
        name: body.data.name,
        email: body.data.email,
        passwordHash: hashPassword(body.data.password),
        role: body.data.role,
        accessExpiresAt: body.data.accessExpiresAt ? new Date(body.data.accessExpiresAt) : null,
      },
      select: { id: true, email: true, name: true, role: true, accessExpiresAt: true, createdAt: true },
    });
    return reply.status(201).send(user);
  });

  // PATCH /admin/users/:id — atualiza papel, nome, expiração ou senha
  app.patch("/users/:id", { onRequest: [authenticate, requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(2).optional(),
      role: z.enum(["COMUM", "SERVIDOR", "ADMIN"]).optional(),
      accessExpiresAt: z.string().datetime().nullable().optional(),
      password: z.string().min(8).optional(),
    });
    const { id } = request.params as { id: string };
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const data: Record<string, unknown> = {};
    if (body.data.name !== undefined) data["name"] = body.data.name;
    if (body.data.role !== undefined) data["role"] = body.data.role;
    if (body.data.accessExpiresAt !== undefined) {
      data["accessExpiresAt"] = body.data.accessExpiresAt ? new Date(body.data.accessExpiresAt) : null;
    }
    if (body.data.password) data["passwordHash"] = hashPassword(body.data.password);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, accessExpiresAt: true, createdAt: true },
    });
    return user;
  });

  // DELETE /admin/users/:id — remove usuário (não permite auto-exclusão)
  app.delete("/users/:id", { onRequest: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const requester = request.user as { sub: string };
    if (id === requester.sub) {
      return reply.status(400).send({ error: "Não é possível excluir o próprio usuário" });
    }
    await prisma.user.delete({ where: { id } });
    return reply.status(204).send();
  });
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

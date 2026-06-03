// Rotas administrativas para execução manual dos testes/quality lab.
//
//   POST   /admin/testes/run-legal     → SSE, roda pnpm test:legal
//   POST   /admin/testes/run-quality   → SSE, roda pnpm quality:run --count=X
//          body: { count: number, maxCostUsd: number, area?: string }
//   POST   /admin/testes/quality-report → SSE, roda pnpm quality:report
//   GET    /admin/testes/status        → estado atual dos jobs in-memory
//   GET    /admin/testes/reports       → lista relatórios disponíveis
//   GET    /admin/testes/reports/:kind/:file → serve report.html | report.json | results.json
//
// Concorrência: lock in-memory por tipo. Segundo POST do mesmo tipo → 409.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fsp, createReadStream } from "node:fs";

const __routeDir = dirname(fileURLToPath(import.meta.url));
// Em produção: apps/api/dist/routes → ../../../../ = /opt/judicore
// Em dev:      apps/api/src/routes  → ../../../../ = /opt/judicore (mesmo)
const REPO_ROOT = resolve(__routeDir, "../../../..");
const AI_PACKAGE_DIR = resolve(REPO_ROOT, "packages/ai");
const TESTS_REPORT_DIR = resolve(AI_PACKAGE_DIR, "tests/report/output");
const QUALITY_OUTPUT_DIR = resolve(AI_PACKAGE_DIR, "quality-lab/output");

type JobKind = "legal" | "quality" | "quality-report";

interface RunningJob {
  kind: JobKind;
  startedAt: string;
  process: ChildProcess;
  exitCode: number | null;
  finishedAt: string | null;
}

const runningJobs = new Map<JobKind, RunningJob>();

function sseHeaders(reply: FastifyReply): void {
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.setHeader("X-Accel-Buffering", "no");
  reply.raw.flushHeaders();
}

function sseSend(reply: FastifyReply, event: string, data: unknown): void {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function streamCommand(
  reply: FastifyReply,
  kind: JobKind,
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = {},
): void {
  sseHeaders(reply);

  const child = spawn(command, args, {
    cwd: AI_PACKAGE_DIR,
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
  const job: RunningJob = {
    kind,
    startedAt: new Date().toISOString(),
    process: child,
    exitCode: null,
    finishedAt: null,
  };
  runningJobs.set(kind, job);

  sseSend(reply, "start", { kind, command: `${command} ${args.join(" ")}`, startedAt: job.startedAt });

  function pump(buffer: string, isErr: boolean) {
    for (const line of buffer.split(/\r?\n/)) {
      if (line.length === 0) continue;
      sseSend(reply, "log", { line, stderr: isErr });
    }
  }

  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => pump(chunk, false));
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => pump(chunk, true));

  child.on("close", (code) => {
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();
    sseSend(reply, "done", { kind, exitCode: code, finishedAt: job.finishedAt });
    reply.raw.end();
    // Mantém entrada no map por 60s para consulta posterior
    setTimeout(() => {
      const cur = runningJobs.get(kind);
      if (cur && cur.startedAt === job.startedAt) runningJobs.delete(kind);
    }, 60_000);
  });

  child.on("error", (err) => {
    sseSend(reply, "error", { message: String(err) });
    reply.raw.end();
    runningJobs.delete(kind);
  });

  // Fechamento da conexão pelo cliente → não mata o processo (continua rodando
  // em background). O usuário pode reabrir conexão chamando /status.
}

function isJobRunning(kind: JobKind): boolean {
  const j = runningJobs.get(kind);
  return !!j && j.exitCode === null;
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function testesRoutes(app: FastifyInstance) {
  const authenticate = (app as any).authenticate;

  async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    const payload = request.user as { role?: string };
    if (payload.role !== "ADMIN") {
      return reply.status(403).send({ error: "Acesso restrito a administradores" });
    }
  }

  // POST /admin/testes/run-legal — regressão técnica (rápido, sem OpenAI)
  app.post(
    "/run-legal",
    { onRequest: [authenticate, requireAdmin] },
    async (_request, reply) => {
      if (isJobRunning("legal")) {
        return reply.status(409).send({ error: "Execução já em andamento" });
      }
      streamCommand(reply, "legal", "pnpm", ["test:legal"]);
    },
  );

  // POST /admin/testes/run-quality — avaliação em massa (lento, com OpenAI)
  app.post(
    "/run-quality",
    { onRequest: [authenticate, requireAdmin] },
    async (request, reply) => {
      if (isJobRunning("quality")) {
        return reply.status(409).send({ error: "Execução já em andamento" });
      }
      const body = (request.body ?? {}) as {
        count?: number;
        maxCostUsd?: number;
        maxTokens?: number;
        area?: string;
        documentType?: string;
        trap?: string;
        offset?: number;
      };
      const count = Math.max(1, Math.min(100, Number.parseInt(String(body.count ?? 10), 10)));
      const maxCostUsd = Math.max(0.5, Math.min(50, Number.parseFloat(String(body.maxCostUsd ?? 5))));
      const maxTokens = Math.max(10_000, Math.min(2_000_000, Number.parseInt(String(body.maxTokens ?? 500_000), 10)));
      const offset = Math.max(0, Math.min(500, Number.parseInt(String(body.offset ?? 0), 10)));
      const validAreas = ["RPPS", "RGPS", "TRABALHISTA", "CRIMINAL", "CRIMINAL_MERITO", "CIVEL", "CIVEL_GERAL", "CONSUMIDOR", "FAZENDA_PUBLICA", "EXECUCAO_CUMPRIMENTO", "JEF_CIVEL", "JEF_ESTADUAL", "JEF_FEDERAL"];
      const area = body.area && validAreas.includes(body.area) ? body.area : undefined;
      const validTypes = ["PETICAO_INICIAL", "RECURSO", "SENTENCA", "DECISAO", "DESPACHO"];
      const documentType = body.documentType && validTypes.includes(body.documentType) ? body.documentType : undefined;
      const validTraps = [
        "JURISPRUDENCIA_CONTRARIA","ARTIGO_INCOMPATIVEL","RECURSO_INADEQUADO","COMPETENCIA_INCORRETA",
        "TESE_EQUIVOCADA","PRECEDENTE_SUPERADO","FATO_INCOMPLETO","LINGUAGEM_DECISORIA",
        "TEMA_STF_IGNORADO","RESERVA_POSSIVEL_SEM_MIN_EXIST","PRESCRICAO_QUINQUENAL_IGNORADA",
        "LEGITIMIDADE_PASSIVA_INCORRETA","SEPARACAO_PODERES_INCORRETA","SOLIDARIEDADE_INCORRETA",
        "EXCESSO_EXECUCAO_IGNORADO","TITULO_INEXIGIVEL_IGNORADO","ERRO_CALCULO_IGNORADO",
        "PRESCRICAO_INTERCORRENTE_IGNORADA","PENHORA_VERBA_ALIMENTAR","IMPENHORABILIDADE_IGNORADA",
        "RITO_FAZENDA_CONFUNDIDO","JUROS_INCORRETOS","CORRECAO_MONETARIA_INCORRETA","LEGITIMIDADE_EC_INCORRETA",
        "JEF_PERICIA_COMPLEXA","JEF_VALOR_EXCEDENTE","JEF_RECURSO_ERRADO","JEF_LEGITIMIDADE_PASSIVA",
        "JEF_TUTELA_SEM_PERICULUM","JEF_TUTELA_SEM_FUMUS","JEF_TUTELA_DESPROPORCIONAL","JEF_TUTELA_ARTIFICIAL",
      ];
      const trap = body.trap && validTraps.includes(body.trap) ? body.trap : undefined;

      const args = ["quality:run", "--", `--count=${count}`];
      if (area)         args.push(`--area=${area}`);
      if (documentType) args.push(`--type=${documentType}`);
      if (trap)         args.push(`--trap=${trap}`);
      if (offset > 0)   args.push(`--offset=${offset}`);

      streamCommand(reply, "quality", "pnpm", args, {
        JUDICORE_QUALITY_MAX_CASES: String(count),
        JUDICORE_QUALITY_MAX_TOKENS: String(maxTokens),
        JUDICORE_QUALITY_MAX_COST_USD: String(maxCostUsd),
      });
    },
  );

  // POST /admin/testes/quality-report — gera report.html/json após run
  app.post(
    "/quality-report",
    { onRequest: [authenticate, requireAdmin] },
    async (_request, reply) => {
      if (isJobRunning("quality-report")) {
        return reply.status(409).send({ error: "Geração de relatório já em andamento" });
      }
      streamCommand(reply, "quality-report", "pnpm", ["quality:report"]);
    },
  );

  // GET /admin/testes/status — estado in-memory
  app.get(
    "/status",
    { onRequest: [authenticate, requireAdmin] },
    async () => {
      const jobs: Record<string, unknown> = {};
      for (const [kind, job] of runningJobs) {
        jobs[kind] = {
          kind: job.kind,
          startedAt: job.startedAt,
          running: job.exitCode === null,
          exitCode: job.exitCode,
          finishedAt: job.finishedAt,
        };
      }
      return { jobs };
    },
  );

  // GET /admin/testes/reports — lista o que está disponível em disco
  app.get(
    "/reports",
    { onRequest: [authenticate, requireAdmin] },
    async () => {
      async function statSafe(dir: string, files: string[]) {
        const out: Record<string, { size: number; mtime: string } | null> = {};
        for (const f of files) {
          try {
            const s = await fsp.stat(resolve(dir, f));
            out[f] = { size: s.size, mtime: s.mtime.toISOString() };
          } catch {
            out[f] = null;
          }
        }
        return out;
      }
      return {
        legal: await statSafe(TESTS_REPORT_DIR, ["report.html", "report.json"]),
        quality: await statSafe(QUALITY_OUTPUT_DIR, ["report.html", "report.json", "results.json", "cases.json"]),
      };
    },
  );

  // GET /admin/testes/reports/:kind/:file — serve o arquivo (html/json)
  app.get<{ Params: { kind: string; file: string } }>(
    "/reports/:kind/:file",
    { onRequest: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { kind, file } = request.params;
      // Whitelist estrita — sem path traversal
      const allowed: Record<string, { dir: string; files: string[] }> = {
        legal: { dir: TESTS_REPORT_DIR, files: ["report.html", "report.json"] },
        quality: {
          dir: QUALITY_OUTPUT_DIR,
          files: ["report.html", "report.json", "results.json", "cases.json"],
        },
      };
      const config = allowed[kind];
      if (!config || !config.files.includes(file)) {
        return reply.status(404).send({ error: "Relatório não encontrado" });
      }
      const safeName = basename(file);
      const full = resolve(config.dir, safeName);
      try {
        await fsp.access(full);
      } catch {
        return reply.status(404).send({ error: "Arquivo ainda não gerado" });
      }
      const isHtml = file.endsWith(".html");
      reply.header("Content-Type", isHtml ? "text/html; charset=utf-8" : "application/json; charset=utf-8");
      reply.header("Cache-Control", "no-store");
      return reply.send(createReadStream(full));
    },
  );
}

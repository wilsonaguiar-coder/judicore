import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { authRoutes } from "./routes/auth.js";
import { casesRoutes } from "./routes/cases.js";
import { searchRoutes } from "./routes/search.js";
import { documentsRoutes } from "./routes/documents.js";
import { streamRoutes } from "./routes/stream.js";
import { adminRoutes } from "./routes/admin.js";
import { exportRoutes } from "./routes/export.js";
import { ensureIndices } from "@judicore/search";
import { startIndexingWorker } from "./queues/worker.js";
import { registerScheduledJobs } from "./queues/scheduler.js";

const app = Fastify({ logger: true, bodyLimit: 200 * 1024 * 1024 });

await app.register(cors, {
  origin: process.env["FRONTEND_URL"] ?? "http://localhost:3000",
  credentials: true,
});

await app.register(jwt, {
  secret: process.env["JWT_SECRET"] ?? "dev-secret-change-in-production",
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

await app.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024, files: 50 },
});

app.decorate("authenticate", async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

await app.register(authRoutes,    { prefix: "/auth" });
await app.register(casesRoutes,   { prefix: "/cases" });
await app.register(searchRoutes,  { prefix: "/search" });
await app.register(documentsRoutes, { prefix: "/documents" });
await app.register(streamRoutes,  { prefix: "/stream" });
await app.register(adminRoutes,   { prefix: "/admin" });
await app.register(exportRoutes,  { prefix: "/export" });

app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

try {
  await ensureIndices();

  // Worker iniciado apenas pelo processo judicore-search (não pela API)
  if (process.env["START_WORKER"] === "true") {
    startIndexingWorker();
    await registerScheduledJobs();
  }

  const port = Number(process.env["PORT"] ?? 3001);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API rodando em http://localhost:${port}`);
} catch (err) {
  (app.log as any).error(err);
  process.exit(1);
}

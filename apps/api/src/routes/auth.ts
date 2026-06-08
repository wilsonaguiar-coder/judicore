import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@judicore/db";
import { createHash } from "crypto";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2),
  role: z.enum(["COMUM", "SERVIDOR", "ADMIN"]).optional(),
  accessExpiresAt: z.string().datetime().optional(),
});

function hashPassword(password: string): string {
  return createHash("sha256").update(password + process.env["JWT_SECRET"]).digest("hex");
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (existing) return reply.status(409).send({ error: "E-mail já cadastrado" });

    const user = await prisma.user.create({
      data: {
        email: body.data.email,
        name: body.data.name,
        passwordHash: hashPassword(body.data.password),
        role: body.data.role ?? "COMUM",
        accessExpiresAt: body.data.accessExpiresAt ? new Date(body.data.accessExpiresAt) : null,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    const token = app.jwt.sign({ sub: user.id, role: user.role });
    return reply.status(201).send({ user, token });
  });

  app.post("/login", async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const user = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (!user || user.passwordHash !== hashPassword(body.data.password)) {
      return reply.status(401).send({ error: "Credenciais inválidas" });
    }

    if (user.role !== "ADMIN" && user.accessExpiresAt && user.accessExpiresAt < new Date()) {
      return reply.status(403).send({ error: "Acesso expirado. Entre em contato para renovar seu acesso." });
    }

    const token = app.jwt.sign({ sub: user.id, role: user.role });
    return { user: { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      role: user.role,
      monthlyPieceLimit: user.monthlyPieceLimit,
      piecesUsedCurrentCycle: user.piecesUsedCurrentCycle,
      currentCycleStart: user.currentCycleStart,
      currentCycleEnd: user.currentCycleEnd
    }, token };
  });

  app.get("/me", { onRequest: [(app as any).authenticate] }, async (request) => {
    const payload = request.user as { sub: string };
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, defaultArea: true, accessExpiresAt: true, monthlyPieceLimit: true, piecesUsedCurrentCycle: true, currentCycleStart: true, currentCycleEnd: true },
    });
    return { user };
  });
}

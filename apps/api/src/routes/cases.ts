import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@judicore/db";

const createCaseSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  area: z.enum(["TRIBUTARIO", "PREVIDENCIARIO", "ADMINISTRATIVO", "CRIMINAL", "AMBIENTAL", "TRABALHISTA", "CIVIL", "OUTRO"]),
  processNum: z.string().optional(),
});

export async function casesRoutes(app: FastifyInstance) {
  const authenticate = (app as any).authenticate;

  app.get("/", { onRequest: [authenticate] }, async (request) => {
    const { sub } = request.user as { sub: string };
    return prisma.case.findMany({
      where: { userId: sub },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, title: true, area: true, processNum: true,
        createdAt: true, updatedAt: true,
        _count: { select: { searches: true, documents: true } },
      },
    });
  });

  app.post("/", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string };
    const body = createCaseSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const newCase = await prisma.case.create({
      data: { ...body.data, userId: sub },
    });
    return reply.status(201).send(newCase);
  });

  app.get("/:id", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string };
    const { id } = request.params as { id: string };

    const caseData = await prisma.case.findFirst({
      where: { id, userId: sub },
      include: {
        searches: { orderBy: { createdAt: "desc" }, take: 10 },
        documents: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!caseData) return reply.status(404).send({ error: "Caso não encontrado" });
    return caseData;
  });

  app.delete("/:id", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string };
    const { id } = request.params as { id: string };

    const existing = await prisma.case.findFirst({ where: { id, userId: sub } });
    if (!existing) return reply.status(404).send({ error: "Caso não encontrado" });

    await prisma.case.delete({ where: { id } });
    return reply.status(204).send();
  });
}

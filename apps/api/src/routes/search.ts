import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@judicore/db";
import { searchJurisprudencia } from "@judicore/search";

const searchSchema = z.object({
  query: z.string().min(3),
  caseId: z.string(),
  area: z.enum(["TRIBUTARIO", "PREVIDENCIARIO", "ADMINISTRATIVO", "CRIMINAL", "AMBIENTAL", "TRABALHISTA", "CIVIL", "OUTRO"]).optional(),
  tribunais: z.array(z.string()).optional(),
  size: z.number().int().min(1).max(20).default(10),
});

export async function searchRoutes(app: FastifyInstance) {
  const authenticate = (app as any).authenticate;

  app.post("/", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string };
    const body = searchSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    // Verifica que o caso pertence ao usuário
    const caseData = await prisma.case.findFirst({
      where: { id: body.data.caseId, userId: sub },
    });
    if (!caseData) return reply.status(404).send({ error: "Caso não encontrado" });

    // 1. Elasticsearch busca — SEM IA
    const result = await searchJurisprudencia({
      query: body.data.query,
      area: body.data.area,
      tribunais: body.data.tribunais,
      size: body.data.size,
    });

    // 2. Persiste a busca para histórico
    await prisma.search.create({
      data: {
        caseId: body.data.caseId,
        query: body.data.query,
        area: body.data.area ?? caseData.area,
        resultsJson: result.hits as any,
      },
    });

    return {
      hits: result.hits,
      total: result.total,
      took: result.took,
    };
  });
}

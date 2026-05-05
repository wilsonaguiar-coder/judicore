import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@judicore/db";
import { generateDocument, analyzeCase } from "@judicore/ai";
import type { Jurisprudencia } from "@judicore/ai";

const generateSchema = z.object({
  caseId: z.string(),
  type: z.enum(["DESPACHO", "DECISAO", "SENTENCA"]),
  jurisprudencias: z.array(z.object({
    id: z.string(),
    tribunal: z.string(),
    numero: z.string(),
    ementa: z.string(),
    relator: z.string(),
    dataJulgamento: z.string(),
    url: z.string(),
  })),
});

const analyzeSchema = z.object({
  caseId: z.string(),
  jurisprudencias: generateSchema.shape.jurisprudencias,
});

export async function documentsRoutes(app: FastifyInstance) {
  const authenticate = (app as any).authenticate;

  app.post("/generate", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string };
    const body = generateSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const caseData = await prisma.case.findFirst({
      where: { id: body.data.caseId, userId: sub },
    });
    if (!caseData) return reply.status(404).send({ error: "Caso não encontrado" });

    // IA entra aqui — com contexto fechado (apenas jurisprudências passadas pelo cliente)
    const result = await generateDocument({
      type: body.data.type,
      caseDescription: caseData.description,
      jurisprudencias: body.data.jurisprudencias as Jurisprudencia[],
    });

    const doc = await prisma.document.create({
      data: {
        caseId: body.data.caseId,
        type: body.data.type,
        content: result.content,
        sourcesJson: result.sourcesUsed as any,
        modelUsed: result.modelUsed,
      },
    });

    return {
      document: doc,
      usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
    };
  });

  app.post("/analyze", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string };
    const body = analyzeSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const caseData = await prisma.case.findFirst({
      where: { id: body.data.caseId, userId: sub },
    });
    if (!caseData) return reply.status(404).send({ error: "Caso não encontrado" });

    const result = await analyzeCase({
      caseDescription: caseData.description,
      jurisprudencias: body.data.jurisprudencias as Jurisprudencia[],
    });

    return {
      analysis: result.content,
      sourcesUsed: result.sourcesUsed,
      usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
    };
  });

  app.get("/case/:caseId", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string };
    const { caseId } = request.params as { caseId: string };

    const caseData = await prisma.case.findFirst({ where: { id: caseId, userId: sub } });
    if (!caseData) return reply.status(404).send({ error: "Caso não encontrado" });

    return prisma.document.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    });
  });
}

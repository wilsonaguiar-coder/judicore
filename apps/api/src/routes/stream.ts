import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@judicore/db";
import { generateDocumentStream, analyzeCaseStream } from "@judicore/ai";
import type { Jurisprudencia } from "@judicore/ai";

const jurisprudenciaSchema = z.object({
  id: z.string(),
  tribunal: z.string(),
  numero: z.string(),
  ementa: z.string(),
  relator: z.string(),
  dataJulgamento: z.string(),
  url: z.string(),
});

const ALL_DOC_TYPES = ["DESPACHO", "DECISAO", "SENTENCA", "PETICAO_INICIAL", "RECURSO"] as const;

const DOC_TYPES_BY_ROLE: Record<string, readonly string[]> = {
  COMUM:    ["PETICAO_INICIAL", "RECURSO"],
  SERVIDOR: ["DESPACHO", "DECISAO", "SENTENCA"],
  ADMIN:    ALL_DOC_TYPES,
};

const streamSchema = z.object({
  caseId: z.string().optional(),
  type: z.enum(ALL_DOC_TYPES),
  jurisprudencias: z.array(jurisprudenciaSchema),
  instruction: z.string().optional(),
});

export async function streamRoutes(app: FastifyInstance) {
  const authenticate = (app as any).authenticate;

  // SSE: POST /stream/generate
  // Retorna Server-Sent Events com chunks de texto
  app.post("/generate", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub, role } = request.user as { sub: string; role: string };
    const body = streamSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const allowed = DOC_TYPES_BY_ROLE[role] ?? [];
    if (!allowed.includes(body.data.type)) {
      return reply.status(403).send({ error: `Seu perfil não permite gerar documentos do tipo ${body.data.type}` });
    }

    let caseDescription = "";
    if (body.data.caseId) {
      const caseData = await prisma.case.findFirst({
        where: { id: body.data.caseId, userId: sub },
      });
      if (!caseData) return reply.status(404).send({ error: "Caso não encontrado" });
      caseDescription = caseData.description;
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders();

    let fullContent = "";

    try {
      const stream = generateDocumentStream({
        type: body.data.type,
        caseDescription,
        jurisprudencias: body.data.jurisprudencias as Jurisprudencia[],
        instruction: body.data.instruction,
      });

      for await (const chunk of stream) {
        fullContent += chunk;
        reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      if (body.data.caseId) {
        const doc = await prisma.document.create({
          data: {
            caseId: body.data.caseId,
            type: body.data.type,
            content: fullContent,
            instruction: body.data.instruction ?? null,
            sourcesJson: body.data.jurisprudencias as any,
            modelUsed: "claude-sonnet-4-6",
          },
        });
        reply.raw.write(`data: ${JSON.stringify({ done: true, documentId: doc.id })}\n\n`);
      } else {
        reply.raw.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
    } catch (err: any) {
      reply.raw.write(`data: ${JSON.stringify({ error: err.message ?? "Erro interno" })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });
}

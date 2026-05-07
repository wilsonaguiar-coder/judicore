import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@judicore/db";
import { generateDocx } from "../lib/docx-export.js";

export async function exportRoutes(app: FastifyInstance) {
  const authenticate = (app as any).authenticate;

  // POST /export/raw — exporta conteúdo em memória (busca livre, sem caso associado)
  const rawSchema = z.object({
    type:    z.enum(["DESPACHO", "DECISAO", "SENTENCA", "PETICAO_INICIAL", "RECURSO"]),
    content: z.string().min(1),
  });

  app.post("/raw", { onRequest: [authenticate] }, async (request, reply) => {
    const body = rawSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const buffer = await generateDocx({
      type:        body.data.type,
      content:     body.data.content,
      caseTitle:   "Pesquisa livre",
      generatedAt: new Date(),
      sources:     [],
    });

    const filename = `judicore_${body.data.type.toLowerCase()}_${Date.now()}.docx`;

    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(buffer);
  });

  // GET /export/:documentId — baixa o documento como .docx
  app.get("/:documentId", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string };
    const { documentId } = request.params as { documentId: string };

    const doc = await prisma.document.findFirst({
      where: { id: documentId },
      include: {
        case: { select: { userId: true, title: true, processNum: true } },
      },
    });

    if (!doc) return reply.status(404).send({ error: "Documento não encontrado" });
    if (doc.case.userId !== sub) return reply.status(403).send({ error: "Acesso negado" });

    const sources = (doc.sourcesJson as any[]).map((s) => ({
      tribunal:       s.tribunal ?? "",
      numero:         s.numero ?? "",
      dataJulgamento: s.dataJulgamento ?? "",
    }));

    const buffer = await generateDocx({
      type:        doc.type,
      content:     doc.content,
      caseTitle:   doc.case.title,
      processNum:  doc.case.processNum,
      sources,
      generatedAt: doc.createdAt,
    });

    const filename = `judicore_${doc.type.toLowerCase()}_${doc.id.slice(0, 8)}.docx`;

    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(buffer);
  });
}

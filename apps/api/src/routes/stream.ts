import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@judicore/db";
import { generateDocumentStream, generatePremiumDocumentStream } from "@judicore/ai";
import type { Jurisprudencia } from "@judicore/ai";
import { extractPdfText } from "../lib/pdf-extract.js";
import { extractLawRefs, fetchLegislation } from "../lib/legislation-fetch.js";

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
    let usageInput = 0, usageOutput = 0;

    try {
      const stream = generateDocumentStream(
        {
          type: body.data.type,
          caseDescription,
          jurisprudencias: body.data.jurisprudencias as Jurisprudencia[],
          instruction: body.data.instruction,
        },
        (inp, out) => { usageInput = inp; usageOutput = out; },
      );

      for await (const chunk of stream) {
        fullContent += chunk;
        reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      prisma.usageLog.create({ data: {
        userId: sub, service: "openai", model: "gpt-4o",
        operation: "generate", inputTokens: usageInput, outputTokens: usageOutput,
        docType: body.data.type,
      }}).catch(() => {});

      if (body.data.caseId) {
        const doc = await prisma.document.create({
          data: {
            caseId: body.data.caseId,
            type: body.data.type,
            content: fullContent,
            instruction: body.data.instruction ?? null,
            sourcesJson: body.data.jurisprudencias as any,
            modelUsed: "openai/gpt-4o",
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

  // SSE: POST /stream/generate-premium — geração com upload de PDFs + legislação do Planalto
  app.post("/generate-premium", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub, role } = request.user as { sub: string; role: string };

    // Parseia multipart
    const parts = (request as any).parts({
      limits: { fileSize: 5 * 1024 * 1024, files: 5 },
    });

    const pdfBuffers: Array<{ filename: string; buffer: Buffer }> = [];
    let docType = "";
    let caseId = "";
    let jurisprudenciasJson = "[]";
    let instruction = "";

    for await (const part of parts) {
      if (part.type === "file") {
        if (!part.mimetype?.includes("pdf")) { await part.resume(); continue; }
        const buffer = await part.toBuffer();
        pdfBuffers.push({ filename: part.filename ?? "documento.pdf", buffer });
      } else {
        const val = part.value as string;
        if (part.fieldname === "type")           docType = val;
        else if (part.fieldname === "caseId")    caseId = val;
        else if (part.fieldname === "jurisprudencias") jurisprudenciasJson = val;
        else if (part.fieldname === "instruction") instruction = val;
      }
    }

    if (!ALL_DOC_TYPES.includes(docType as any)) {
      return reply.status(400).send({ error: "Tipo de documento inválido" });
    }
    const allowed = DOC_TYPES_BY_ROLE[role] ?? [];
    if (!allowed.includes(docType)) {
      return reply.status(403).send({ error: `Seu perfil não permite gerar documentos do tipo ${docType}` });
    }
    if (pdfBuffers.length === 0) {
      return reply.status(400).send({ error: "Nenhum PDF enviado" });
    }

    // Extrai texto dos PDFs em paralelo (em memória, não salva)
    const docTexts = await Promise.all(
      pdfBuffers.map((f) => extractPdfText(f.buffer, f.filename))
    );

    // Extrai referências legislativas e busca no Planalto
    const allText = docTexts.join("\n\n");
    const lawRefs = extractLawRefs(allText);
    const legislation = lawRefs.length > 0 ? await fetchLegislation(lawRefs) : {};

    let caseDescription = "";
    if (caseId) {
      const caseData = await prisma.case.findFirst({ where: { id: caseId, userId: sub } });
      caseDescription = caseData?.description ?? "";
    }

    const jurisprudencias: Jurisprudencia[] = JSON.parse(jurisprudenciasJson);

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders();

    const legislationFound = Object.keys(legislation).length;
    reply.raw.write(`data: ${JSON.stringify({ status: `PDFs processados. Legislação encontrada: ${legislationFound} lei(s). Gerando documento...` })}\n\n`);

    let fullContent = "";
    let usageInput = 0, usageOutput = 0;
    try {
      const stream = generatePremiumDocumentStream(
        {
          type: docType as any,
          documents: docTexts,
          jurisprudencias,
          legislation,
          caseDescription,
          instruction: instruction || undefined,
        },
        (inp, out) => { usageInput = inp; usageOutput = out; },
      );

      for await (const chunk of stream) {
        fullContent += chunk;
        reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      prisma.usageLog.create({ data: {
        userId: sub, service: "openai", model: "gpt-4o",
        operation: "generate", inputTokens: usageInput, outputTokens: usageOutput,
        docType,
      }}).catch(() => {});

      if (caseId) {
        const doc = await prisma.document.create({
          data: {
            caseId,
            type: docType as any,
            content: fullContent,
            instruction: instruction || null,
            sourcesJson: jurisprudencias as any,
            modelUsed: "openai/gpt-4o",
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

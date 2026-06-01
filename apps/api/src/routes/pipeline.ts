import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@judicore/db";
import { LegalPipeline, LegalDraftService, LegalAuditService } from "@judicore/ai";
import type { PipelineInput } from "@judicore/ai";

const jurisprudenciaInputSchema = z.object({
  id: z.string(),
  tribunal: z.string(),
  numero: z.string(),
  tema: z.string(),
  ementa: z.string(),
  tese: z.string(),
  relator: z.string().optional(),
  dataJulgamento: z.string().optional(),
  url: z.string().optional(),
});

const ALL_DOC_TYPES = ["DESPACHO", "DECISAO", "SENTENCA", "PETICAO_INICIAL", "RECURSO"] as const;

const DOC_TYPES_BY_ROLE: Record<string, readonly string[]> = {
  COMUM:    ["PETICAO_INICIAL", "RECURSO"],
  SERVIDOR: ["DESPACHO", "DECISAO", "SENTENCA"],
  ADMIN:    ALL_DOC_TYPES,
};

const pipelineSchema = z.object({
  caseId: z.string().optional(),
  caseDescription: z.string().optional(),
  type: z.enum(ALL_DOC_TYPES),
  jurisprudencias: z.array(jurisprudenciaInputSchema),
  instruction: z.string().optional(),
});

const retrySchema = z.object({
  corrections: z.string().optional(),
});

function sseWrite(reply: { raw: { write: (s: string) => void } }, data: unknown): void {
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function pipelineRoutes(app: FastifyInstance) {
  const authenticate = (app as any).authenticate;
  const pipeline = new LegalPipeline();

  // POST /pipeline/generate — SSE pipeline completo
  app.post("/generate", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub, role } = request.user as { sub: string; role: string };
    const body = pipelineSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const allowed = DOC_TYPES_BY_ROLE[role] ?? [];
    if (!allowed.includes(body.data.type)) {
      return reply.status(403).send({ error: `Perfil não permite gerar ${body.data.type}` });
    }

    let caseDescription = body.data.caseDescription ?? "";
    if (body.data.caseId) {
      const caseData = await prisma.case.findFirst({ where: { id: body.data.caseId, userId: sub } });
      if (!caseData) return reply.status(404).send({ error: "Caso não encontrado" });
      if (!caseDescription) caseDescription = caseData.description;
    }

    const generation = await prisma.legalGeneration.create({
      data: { userId: sub, caseId: body.data.caseId ?? null, status: "PENDING" },
    });

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders();

    const input: PipelineInput = {
      userId: sub,
      caseId: body.data.caseId,
      caseDescription,
      documentType: body.data.type,
      jurisprudencias: body.data.jurisprudencias,
      instruction: body.data.instruction,
    };

    let fullDraft = "";
    let documentId: string | undefined;

    const onStageComplete = async (stage: string, data: unknown): Promise<void> => {
      const d = data as Record<string, unknown>;
      try {
        if (stage === "classification") {
          const c = d["classification"] as Record<string, unknown>;
          const u = d["usage"] as Record<string, unknown>;
          await prisma.legalGeneration.update({ where: { id: generation.id }, data: { status: "CLASSIFYING" } });
          await prisma.legalClassificationRecord.create({
            data: {
              generationId: generation.id,
              tipoJustica: c["tipo_justica"] as "TRABALHO" | "FEDERAL" | "ESTADUAL",
              tipoPeca: c["tipo_peca"] as "PETICAO_INICIAL" | "RECURSO" | "SENTENCA" | "DECISAO" | "DESPACHO",
              regimeJuridico: (c["regime_juridico"] as "CLT" | "RPPS" | "RGPS" | "ESTATUTARIO" | "CIVIL" | null) ?? null,
              grau: String(c["grau"] ?? "PRIMEIRO"),
              tribunal: String(c["tribunal_competente"] ?? ""),
              assunto: String(c["assunto_principal"] ?? ""),
              confianca: Number(c["confianca"] ?? 0),
              dataJson: c as any,
              modelUsed: String((u as Record<string, unknown>)["model"] ?? "gpt-4.1"),
              inputTokens: Number((u as Record<string, unknown>)["inputTokens"] ?? 0),
              outputTokens: Number((u as Record<string, unknown>)["outputTokens"] ?? 0),
            },
          });
        } else if (stage === "extraction") {
          const u = d["usage"] as Record<string, unknown>;
          await prisma.legalGeneration.update({ where: { id: generation.id }, data: { status: "EXTRACTING" } });
          await prisma.legalExtractionRecord.create({
            data: {
              generationId: generation.id,
              dataJson: d["extraction"] as any,
              modelUsed: String(u["model"] ?? "gpt-4.1"),
              inputTokens: Number(u["inputTokens"] ?? 0),
              outputTokens: Number(u["outputTokens"] ?? 0),
            },
          });
        } else if (stage === "matrix") {
          const m = d["matrix"] as Record<string, unknown>;
          const u = d["usage"] as Record<string, unknown>;
          await prisma.legalGeneration.update({ where: { id: generation.id }, data: { status: "BUILDING_MATRIX" } });
          const teses = (m["teses"] as unknown[] | undefined) ?? [];
          await prisma.legalMatrixRecord.create({
            data: {
              generationId: generation.id,
              teseCount: teses.length,
              dataJson: m as any,
              modelUsed: String(u["model"] ?? "gpt-4.1"),
              inputTokens: Number(u["inputTokens"] ?? 0),
              outputTokens: Number(u["outputTokens"] ?? 0),
            },
          });
        } else if (stage === "draft") {
          fullDraft = String(d["content"] ?? "");
          await prisma.legalGeneration.update({ where: { id: generation.id }, data: { status: "DRAFTING" } });
          await prisma.legalDraftRecord.create({
            data: {
              generationId: generation.id,
              content: fullDraft,
              modelUsed: "openai/gpt-4.1",
              inputTokens: Number(d["inputTokens"] ?? 0),
              outputTokens: Number(d["outputTokens"] ?? 0),
            },
          });
          if (body.data.caseId) {
            const doc = await prisma.document.create({
              data: {
                caseId: body.data.caseId,
                type: body.data.type,
                content: fullDraft,
                instruction: body.data.instruction ?? null,
                sourcesJson: body.data.jurisprudencias as any,
                modelUsed: "openai/gpt-4.1",
              },
            });
            documentId = doc.id;
            await prisma.legalGeneration.update({ where: { id: generation.id }, data: { documentId: doc.id } });
          }
        } else if (stage === "audit") {
          const a = d["audit"] as Record<string, unknown>;
          const u = d["usage"] as Record<string, unknown>;
          const erros = (a["erros"] as unknown[] | undefined) ?? [];
          const aprovada = Boolean(a["aprovada"]);
          await prisma.legalGeneration.update({
            where: { id: generation.id },
            data: { status: aprovada ? "APPROVED" : "REJECTED" },
          });
          await prisma.legalAuditRecord.create({
            data: {
              generationId: generation.id,
              aprovada,
              score: Number(a["score"] ?? 0),
              erroCount: erros.length,
              dataJson: a as any,
              modelUsed: String(u["model"] ?? "gpt-4.1"),
              inputTokens: Number(u["inputTokens"] ?? 0),
              outputTokens: Number(u["outputTokens"] ?? 0),
            },
          });
        }
      } catch { /* log silently */ }
    };

    try {
      await prisma.legalGeneration.update({ where: { id: generation.id }, data: { status: "CLASSIFYING" } });

      for await (const event of pipeline.run(input, generation.id, onStageComplete)) {
        if (event.event === "done") {
          sseWrite(reply, { ...event.data, generationId: generation.id, documentId });
        } else {
          sseWrite(reply, event);
        }
      }

      prisma.usageLog.create({
        data: { userId: sub, service: "openai", model: "gpt-4.1", operation: "pipeline", docType: body.data.type, inputTokens: 0, outputTokens: 0 },
      }).catch(() => {});
    } catch (err: unknown) {
      sseWrite(reply, { error: String(err) });
      await prisma.legalGeneration.update({ where: { id: generation.id }, data: { status: "FAILED" } }).catch(() => {});
    } finally {
      reply.raw.end();
    }
  });

  // POST /pipeline/:generationId/retry — reprocessa com correções
  app.post("/:generationId/retry", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string };
    const { generationId } = request.params as { generationId: string };
    const body = retrySchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const original = await prisma.legalGeneration.findFirst({
      where: { id: generationId, userId: sub },
      include: { classification: true, extraction: true, matrix: true, draft: true, audit: true },
    });
    if (!original) return reply.status(404).send({ error: "Geração não encontrada" });

    const draft = original.draft;
    const classification = original.classification;
    if (!draft || !classification) {
      return reply.status(400).send({ error: "Geração original não possui rascunho ou classificação" });
    }

    const retryGeneration = await prisma.legalGeneration.create({
      data: {
        userId: sub,
        caseId: original.caseId ?? null,
        retryOf: generationId,
        status: "DRAFTING",
      },
    });

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders();

    const corrections = body.data.corrections
      ?? (original.audit?.dataJson
        ? (original.audit?.dataJson as Record<string, unknown>)?.["erros"]
            ? (original.audit.dataJson as {erros: Array<{correcao: string}>}).erros.map((e) => `- ${e.correcao}`).join("\n")
            : undefined
        : undefined);

    const classificacaoData = classification.dataJson as Record<string, unknown>;
    const matrizData = (original.matrix?.dataJson ?? { teses: [] }) as Record<string, unknown>;

    const drafter = new LegalDraftService();
    const auditor = new LegalAuditService();

    let fullDraft = "";
    let draftInput = 0, draftOutput = 0;

    sseWrite(reply, { event: "phase", data: { phase: "drafting", generationId: retryGeneration.id } });

    try {
      const draftStream = drafter.draft(
        classificacaoData as any,
        (original.extraction?.dataJson ?? {}) as any,
        matrizData as any,
        [],
        (inp: number, out: number) => { draftInput = inp; draftOutput = out; },
        undefined,
        corrections as string | undefined,
      );

      for await (const chunk of draftStream) {
        fullDraft += chunk;
        sseWrite(reply, { event: "chunk", data: chunk });
      }

      await prisma.legalDraftRecord.create({
        data: {
          generationId: retryGeneration.id,
          content: fullDraft,
          modelUsed: "openai/gpt-4.1",
          inputTokens: draftInput,
          outputTokens: draftOutput,
        },
      });

      if (original.caseId) {
        const doc = await prisma.document.create({
          data: {
            caseId: original.caseId,
            type: (classificacaoData["tipo_peca"] ?? "DESPACHO") as "DESPACHO" | "DECISAO" | "SENTENCA" | "PETICAO_INICIAL" | "RECURSO",
            content: fullDraft,
            sourcesJson: [],
            modelUsed: "openai/gpt-4.1",
          },
        });
        await prisma.legalGeneration.update({ where: { id: retryGeneration.id }, data: { documentId: doc.id } });
      }

      sseWrite(reply, { event: "phase", data: { phase: "auditing", generationId: retryGeneration.id } });

      const { audit, usage: auditUsage } = await auditor.audit(
        fullDraft,
        classificacaoData as any,
        matrizData as any,
      );

      await prisma.legalAuditRecord.create({
        data: {
          generationId: retryGeneration.id,
          aprovada: audit.aprovada,
          score: audit.score,
          erroCount: audit.erros.length,
          dataJson: audit as any,
          modelUsed: auditUsage.model,
          inputTokens: auditUsage.inputTokens,
          outputTokens: auditUsage.outputTokens,
        },
      });

      await prisma.legalGeneration.update({
        where: { id: retryGeneration.id },
        data: { status: audit.aprovada ? "APPROVED" : "REJECTED" },
      });

      sseWrite(reply, { event: "audit", data: audit });
      sseWrite(reply, { event: "done", data: { generationId: retryGeneration.id, aprovada: audit.aprovada } });
    } catch (err: unknown) {
      sseWrite(reply, { event: "error", data: { message: String(err), phase: "retry", fatal: true } });
      await prisma.legalGeneration.update({ where: { id: retryGeneration.id }, data: { status: "FAILED" } }).catch(() => {});
    } finally {
      reply.raw.end();
    }
  });

  // GET /pipeline/:generationId — status e detalhes da geração
  app.get("/:generationId", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string };
    const { generationId } = request.params as { generationId: string };

    const generation = await prisma.legalGeneration.findFirst({
      where: { id: generationId, userId: sub },
      include: { classification: true, extraction: true, matrix: true, draft: true, audit: true },
    });

    if (!generation) return reply.status(404).send({ error: "Geração não encontrada" });
    return reply.send(generation);
  });
}

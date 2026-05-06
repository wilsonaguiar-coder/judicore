import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@judicore/db";

const SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL ?? "http://127.0.0.1:7860";

const searchSchema = z.object({
  query: z.string().min(3),
  caseId: z.string(),
  area: z.enum(["TRIBUTARIO", "PREVIDENCIARIO", "ADMINISTRATIVO", "CRIMINAL", "AMBIENTAL", "TRABALHISTA", "CIVIL", "OUTRO"]).optional(),
  tribunais: z.array(z.string()).optional(),
  size: z.number().int().min(1).max(20).default(10),
});

interface RagResult {
  doc_id: string;
  tribunal: string;
  tipo: string;
  processo: string;
  relator: string;
  orgao_julgador: string;
  data_julgamento: string;
  ementa: string;
  texto_integral: string | null;
  inteiro_teor_url: string | null;
  final_score: number;
  authority_level: string;
  authority_label: string;
  source_label: string;
}

export async function searchRoutes(app: FastifyInstance) {
  const authenticate = (app as any).authenticate;

  app.post("/", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string };
    const body = searchSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const caseData = await prisma.case.findFirst({
      where: { id: body.data.caseId, userId: sub },
    });
    if (!caseData) return reply.status(404).send({ error: "Caso não encontrado" });

    const t0 = Date.now();

    const ragBody: Record<string, unknown> = {
      query: body.data.query,
      top_k: body.data.size,
    };
    if (body.data.tribunais?.length) ragBody.tribunais = body.data.tribunais;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55_000);

    let ragRes: Response;
    try {
      ragRes = await fetch(`${SEARCH_SERVICE_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ragBody),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timer);
      if (fetchErr.name === "AbortError") {
        return reply.status(504).send({ error: "Serviço de busca não respondeu em 55s — tente novamente" });
      }
      return reply.status(502).send({ error: "Erro ao conectar ao serviço de busca", detail: String(fetchErr) });
    } finally {
      clearTimeout(timer);
    }

    if (!ragRes.ok) {
      const err = await ragRes.text();
      return reply.status(502).send({ error: "Erro no serviço de busca", detail: err });
    }

    const ragHits = (await ragRes.json()) as RagResult[];

    const hits = ragHits.map((r) => ({
      id: r.doc_id,
      tribunal: r.tribunal,
      numero: r.processo,
      ementa: r.ementa,
      relator: r.relator,
      dataJulgamento: r.data_julgamento,
      area: "OUTRO",
      url: r.inteiro_teor_url ?? "",
      score: r.final_score,
      tipo: r.tipo,
      autoridade: r.authority_label,
      fonte: r.source_label,
      textoIntegral: r.texto_integral ?? null,
    }));

    await prisma.search.create({
      data: {
        caseId: body.data.caseId,
        query: body.data.query,
        area: body.data.area ?? caseData.area,
        resultsJson: hits as any,
      },
    });

    return {
      hits,
      total: hits.length,
      took: Date.now() - t0,
    };
  });
}

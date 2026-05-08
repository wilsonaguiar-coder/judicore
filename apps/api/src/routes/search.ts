import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@judicore/db";
import { searchJurisprudencia } from "@judicore/search";

const SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL ?? "http://127.0.0.1:7860";

// Tribunais cobertos pelo LanceDB (vetor + inteiro teor)
const LANCE_TRIBUNAIS = new Set(["STF", "STJ", "TJSP"]);

const searchSchema = z.object({
  query: z.string().min(3),
  caseId: z.string().optional(),
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

// Reciprocal Rank Fusion — normaliza scores de fontes distintas
function rrfMerge(lists: any[][], topK: number, k = 60): any[] {
  const scores = new Map<string, { item: any; score: number }>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      const prev = scores.get(item.id);
      const add = 1 / (k + rank + 1);
      if (prev) prev.score += add;
      else scores.set(item.id, { item, score: add });
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((v) => ({ ...v.item, score: v.score }));
}

export async function searchRoutes(app: FastifyInstance) {
  const authenticate = (app as any).authenticate;

  app.post("/", { onRequest: [authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string };
    const body = searchSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    let caseData = null;
    if (body.data.caseId) {
      caseData = await prisma.case.findFirst({ where: { id: body.data.caseId, userId: sub } });
      if (!caseData) return reply.status(404).send({ error: "Caso não encontrado" });
    }

    const t0 = Date.now();
    const { query, area, size } = body.data;
    const requestedTribunais = body.data.tribunais ?? [];
    const queryAll = requestedTribunais.length === 0;

    const lanceTribunais = queryAll ? [] : requestedTribunais.filter((t) => LANCE_TRIBUNAIS.has(t));
    const esTribunais    = queryAll ? [] : requestedTribunais.filter((t) => !LANCE_TRIBUNAIS.has(t));
    const needsLance = queryAll || lanceTribunais.length > 0;
    const needsES    = queryAll || esTribunais.length > 0;

    async function queryLance(): Promise<any[]> {
      const ragBody: Record<string, unknown> = { query, top_k: size };
      if (lanceTribunais.length) ragBody.tribunais = lanceTribunais;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 55_000);
      try {
        const res = await fetch(`${SEARCH_SERVICE_URL}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ragBody),
          signal: controller.signal,
        });
        if (!res.ok) return [];
        const hits = (await res.json()) as RagResult[];
        return hits.map((r) => ({
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
      } catch {
        return [];
      } finally {
        clearTimeout(timer);
      }
    }

    async function queryES(): Promise<any[]> {
      try {
        const result = await searchJurisprudencia({
          query,
          ...(area ? { area } : {}),
          ...(esTribunais.length ? { tribunais: esTribunais } : {}),
          size,
        });
        return result.hits.map((h) => ({
          ...h,
          tipo: "",
          autoridade: "",
          fonte: "datajud",
          textoIntegral: null,
        }));
      } catch {
        return [];
      }
    }

    const [lanceHits, esHits] = await Promise.all([
      needsLance ? queryLance() : Promise.resolve([]),
      needsES    ? queryES()    : Promise.resolve([]),
    ]);

    if (needsLance && needsES && lanceHits.length === 0 && esHits.length === 0) {
      return reply.status(502).send({ error: "Nenhuma fonte de busca respondeu — tente novamente" });
    }

    const hits = (needsLance && needsES)
      ? rrfMerge([lanceHits, esHits], size)
      : [...lanceHits, ...esHits].slice(0, size);

    if (body.data.caseId && caseData) {
      await prisma.search.create({
        data: {
          caseId: body.data.caseId,
          query,
          area: area ?? caseData.area,
          resultsJson: hits as any,
        },
      });
    }

    return { hits, total: hits.length, took: Date.now() - t0 };
  });
}

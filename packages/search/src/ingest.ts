import { getElasticsearchClient } from "./client.js";
import { JURISPRUDENCIA_INDEX } from "./indices.js";
import type { Jurisprudencia } from "./types.js";

export async function indexJurisprudencia(doc: Omit<Jurisprudencia, "score">): Promise<string> {
  const client = getElasticsearchClient();
  const { id, ...body } = doc;
  const response = await client.index({
    index: JURISPRUDENCIA_INDEX,
    ...(id ? { id } : {}),
    document: body,
  });
  return response._id;
}

export async function bulkIndexJurisprudencia(
  docs: Omit<Jurisprudencia, "score">[]
): Promise<void> {
  const client = getElasticsearchClient();
  const operations = docs.flatMap(({ id, ...doc }) => [
    { create: { _index: JURISPRUDENCIA_INDEX, ...(id ? { _id: id } : {}) } },
    doc,
  ]);
  const response = await client.bulk({ operations });
  if (response.errors) {
    const failed = response.items.filter(
      (i) => i.create?.error && i.create.error.type !== "version_conflict_engine_exception"
    );
    if (failed.length > 0) console.error(`Bulk index: ${failed.length} documentos falharam`);
  }
}

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
    { index: { _index: JURISPRUDENCIA_INDEX, ...(id ? { _id: id } : {}) } },
    doc,
  ]);
  const response = await client.bulk({ operations });
  if (response.errors) {
    const failed = response.items.filter((i) => i.index?.error);
    if (failed.length > 0) console.error(`Bulk index: ${failed.length} documentos falharam`);
  }
}

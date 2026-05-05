import { getElasticsearchClient } from "./client.js";
import { JURISPRUDENCIA_INDEX } from "./indices.js";
import type { Jurisprudencia } from "./types.js";

export async function indexJurisprudencia(doc: Omit<Jurisprudencia, "id" | "score">): Promise<string> {
  const client = getElasticsearchClient();
  const response = await client.index({
    index: JURISPRUDENCIA_INDEX,
    document: doc,
  });
  return response._id;
}

export async function bulkIndexJurisprudencia(
  docs: Omit<Jurisprudencia, "id" | "score">[]
): Promise<void> {
  const client = getElasticsearchClient();
  const operations = docs.flatMap((doc) => [
    { index: { _index: JURISPRUDENCIA_INDEX } },
    doc,
  ]);
  const response = await client.bulk({ operations });
  if (response.errors) {
    const failed = response.items.filter((i) => i.index?.error);
    console.error(`Bulk index: ${failed.length} documentos falharam`);
  }
}

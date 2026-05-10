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
): Promise<{ indexed: number; failed: number }> {
  const client = getElasticsearchClient();
  const operations = docs.flatMap(({ id, ...doc }) => [
    { index: { _index: JURISPRUDENCIA_INDEX, ...(id ? { _id: id } : {}) } },
    doc,
  ]);
  const response = await client.bulk({ operations });
  if (response.errors) {
    const failedItems = response.items.filter((i) => i.index?.error);
    if (failedItems.length > 0) {
      const firstErr = failedItems[0]?.index?.error;
      console.error(`Bulk index: ${failedItems.length}/${docs.length} falharam. Ex: [${firstErr?.type}] ${firstErr?.reason}`);
    }
    return { indexed: docs.length - failedItems.length, failed: failedItems.length };
  }
  return { indexed: docs.length, failed: 0 };
}

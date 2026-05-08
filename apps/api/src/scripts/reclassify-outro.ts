/**
 * Reclassifica documentos com area="OUTRO" usando classifyFromText na ementa.
 * Não re-busca nada externamente — apenas lê do ES e atualiza os que mudarem de área.
 *
 * Uso: npx tsx src/scripts/reclassify-outro.ts
 */

import { getElasticsearchClient, classifyFromText } from "@judicore/search";

const INDEX = "jurisprudencia";
const BATCH = 500;

const client = getElasticsearchClient();

async function main() {
  let scrollId: string | undefined;
  let processed = 0;
  let reclassified = 0;

  console.log("Buscando documentos com area=OUTRO...");

  const first = await client.search({
    index: INDEX,
    scroll: "2m",
    size: BATCH,
    query: { term: { area: "OUTRO" } },
    _source: ["ementa"],
  });

  scrollId = first._scroll_id;
  let hits = first.hits.hits;

  while (hits.length > 0) {
    const updates: { id: string; area: string }[] = [];

    for (const hit of hits) {
      const ementa: string = (hit._source as any)?.ementa ?? "";
      const newArea = classifyFromText(ementa);
      if (newArea !== "OUTRO" && hit._id) {
        updates.push({ id: hit._id, area: newArea });
      }
    }

    if (updates.length > 0) {
      const operations = updates.flatMap(({ id, area }) => [
        { update: { _index: INDEX, _id: id } },
        { doc: { area } },
      ]);
      const res = await client.bulk({ operations });
      if (res.errors) {
        const failed = res.items.filter((i: any) => i.update?.error);
        if (failed.length > 0) console.error(`  ${failed.length} falhas no batch`);
      }
      reclassified += updates.length;
    }

    processed += hits.length;
    console.log(`  Processados: ${processed} | Reclassificados: ${reclassified}`);

    const next = await client.scroll({ scroll_id: scrollId!, scroll: "2m" });
    scrollId = next._scroll_id;
    hits = next.hits.hits;
  }

  if (scrollId) await client.clearScroll({ scroll_id: scrollId }).catch(() => {});

  console.log(`\nConcluído. ${processed} documentos lidos, ${reclassified} reclassificados.`);
}

main().catch((err) => { console.error(err); process.exit(1); });

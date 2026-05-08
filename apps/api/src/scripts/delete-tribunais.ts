/**
 * Remove documentos de tribunais específicos do Elasticsearch.
 * Uso: ELASTICSEARCH_URL=http://localhost:9200 npx tsx src/scripts/delete-tribunais.ts TSE STM
 */

import { getElasticsearchClient } from "@judicore/search";

const INDEX = "jurisprudencia";
const tribunais = process.argv.slice(2);

if (tribunais.length === 0) {
  console.error("Informe ao menos um tribunal. Ex: npx tsx ... TSE STM");
  process.exit(1);
}

const client = getElasticsearchClient();

async function main() {
  for (const tribunal of tribunais) {
    console.log(`Deletando documentos do ${tribunal}...`);
    const res = await client.deleteByQuery({
      index: INDEX,
      query: { term: { tribunal } },
    });
    console.log(`  ${tribunal}: ${res.deleted} deletados, ${res.failures?.length ?? 0} falhas`);
  }
  console.log("Concluído.");
}

main().catch((err) => { console.error(err); process.exit(1); });

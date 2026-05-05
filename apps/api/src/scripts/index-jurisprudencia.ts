/**
 * CLI para indexar jurisprudência no Elasticsearch.
 *
 * Uso:
 *   pnpm --filter @judicore/api tsx src/scripts/index-jurisprudencia.ts \
 *     --query "responsabilidade civil estado" \
 *     --sources datajud,stj,stf \
 *     --area CIVIL \
 *     --tribunais STJ,TRF3 \
 *     --pages 5
 */

import { runIndexer } from "@judicore/search";
import { datajudAdapter, stjAdapter, stfAdapter } from "@judicore/search/indexers";
import type { IndexerOptions } from "@judicore/search/indexers";
import type { LegalArea } from "@judicore/search";

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const query = getArg("query") ?? "responsabilidade civil";
const sources = (getArg("sources") ?? "datajud,stj,stf").split(",");
const area = (getArg("area") as LegalArea) ?? undefined;
const tribunais = getArg("tribunais")?.split(",");
const maxPages = parseInt(getArg("pages") ?? "3", 10);

const options: IndexerOptions = { area, tribunais, maxPages, delayMs: 1000 };

const adapters: Record<string, typeof datajudAdapter> = {
  datajud: datajudAdapter,
  stj: stjAdapter,
  stf: stfAdapter,
};

console.log(`\nIndexando: "${query}"`);
console.log(`Fontes: ${sources.join(", ")}`);
console.log(`Área: ${area ?? "todas"} | Tribunais: ${tribunais?.join(", ") ?? "todos"}\n`);

let totalIndexed = 0;
let totalFailed = 0;

for (const source of sources) {
  const adapter = adapters[source];
  if (!adapter) {
    console.warn(`Fonte desconhecida: ${source}`);
    continue;
  }
  const result = await runIndexer(adapter, query, options);
  totalIndexed += result.indexed;
  totalFailed += result.failed;
}

console.log(`\n=== Resultado final ===`);
console.log(`Indexados: ${totalIndexed}`);
console.log(`Falhos:    ${totalFailed}`);
process.exit(totalFailed > 0 ? 1 : 0);

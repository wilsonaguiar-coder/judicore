import "dotenv/config";
import { getIndexingQueue } from "../queues/queue.js";
import { buildJobData } from "../queues/schedule-config.js";
import type { IndexingSource } from "../queues/types.js";
import type { LegalArea } from "@judicore/search";

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}
function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const ALL_AREAS: LegalArea[] = [
  "TRIBUTARIO", "PREVIDENCIARIO", "ADMINISTRATIVO", "CRIMINAL",
  "AMBIENTAL", "TRABALHISTA", "CIVIL", "OUTRO",
];

const rawSources = getArg("sources")?.split(/[, ]+/) ?? ["datajud", "stj", "stf", "lexml"];
const sources = rawSources.filter((s): s is IndexingSource =>
  ["datajud", "stj", "stf", "lexml"].includes(s)
);
const maxPages = parseInt(getArg("pages") ?? "3", 10);
const allAreas = hasFlag("all") || !getArg("area");
const areas: LegalArea[] = allAreas
  ? ALL_AREAS
  : [(getArg("area") as LegalArea)];

const queue = getIndexingQueue();

console.log(`\nAdicionando jobs à fila BullMQ...`);
console.log(`Áreas: ${areas.join(", ")}`);
console.log(`Fontes: ${sources.join(", ")}`);
console.log(`Páginas por job: ${maxPages}\n`);

for (const area of areas) {
  const jobData = buildJobData(area, sources, maxPages, "manual");
  const job = await queue.add(
    `manual-${area}-${Date.now()}`,
    jobData,
    { priority: 2 }
  );
  console.log(`  ✓ Job adicionado: ${area} (id: ${job.id})`);
}

console.log(`\nJobs adicionados. Acompanhe no painel admin em /dashboard/admin`);
await queue.close();
process.exit(0);

/**
 * Enfileira jobs de indexação TST histórica por semana.
 * Cada job cobre 7 dias — mantém-se dentro do limite de ~8.860 docs/query.
 *
 * Uso:
 *   cd /opt/judicore/apps/api
 *   npx tsx src/scripts/tst-historical.ts [--from 2022-01-01] [--to 2026-05-10]
 */
import "dotenv/config";
import { getIndexingQueue } from "../queues/queue.js";
import type { IndexingJobData } from "../queues/types.js";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseArg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(name);
  const val = idx !== -1 ? process.argv[idx + 1] : undefined;
  return val ?? fallback;
}

const fromStr = parseArg("--from", "2020-01-01");
const toStr   = parseArg("--to",   fmt(new Date()));

const fromDate = new Date(fromStr + "T00:00:00Z");
const toDate   = new Date(toStr   + "T00:00:00Z");

console.log(`TST histórico: ${fmt(fromDate)} → ${fmt(toDate)}`);

const queue = getIndexingQueue();
let count = 0;
let current = fromDate;

while (current <= toDate) {
  const weekEnd = addDays(current, 6);
  const startDate = fmt(current);
  const endDate   = fmt(weekEnd <= toDate ? weekEnd : toDate);

  const jobData: IndexingJobData = {
    area: "TRABALHISTA",
    sources: ["tst"],
    queries: [""],
    tribunais: ["TST"],
    maxPages: 500,
    triggeredBy: "manual",
    startDate,
    endDate,
  };

  await queue.add(`tst-hist-${startDate}`, jobData, {
    priority: 10,  // baixa prioridade — não interfere com jobs manuais
    jobId: `tst-hist-${startDate}`,  // idempotente — evita duplicatas
  });

  count++;
  current = addDays(current, 7);
}

console.log(`✓ ${count} jobs enfileirados (${count * 7} dias de dados TST)`);
console.log(`  Tempo estimado: ~${Math.round(count * 8)} minutos rodando em background`);
await queue.close();

/**
 * Enfileira jobs de indexação TST histórica por mês.
 * Cada job cobre 1 mês — evita sobreposição de r.id entre janelas.
 * Query mensal = ~3.081 acórdãos (43 páginas), bem abaixo do limite de 524MB.
 *
 * Uso:
 *   cd /opt/judicore/apps/api
 *   npx tsx src/scripts/tst-historical.ts [--from 2020-01-01] [--to 2026-05-31]
 */
import "dotenv/config";
import { getIndexingQueue } from "../queues/queue.js";
import type { IndexingJobData } from "../queues/types.js";

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseArg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(name);
  const val = idx !== -1 ? process.argv[idx + 1] : undefined;
  return val ?? fallback;
}

function firstDayOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function lastDayOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function nextMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

const fromStr = parseArg("--from", "2020-01-01");
const toStr   = parseArg("--to",   fmt(new Date()));

const fromDate = firstDayOfMonth(new Date(fromStr + "T00:00:00Z"));
const toDate   = new Date(toStr   + "T00:00:00Z");

console.log(`TST histórico (mensal): ${fmt(fromDate)} → ${fmt(toDate)}`);

const queue = getIndexingQueue();
let count = 0;
let current = fromDate;

while (current <= toDate) {
  const monthLast = lastDayOfMonth(current);
  const startDate = fmt(current);
  const endDate   = fmt(monthLast <= toDate ? monthLast : toDate);

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
    priority: 10,
    jobId: `tst-hist-${startDate}`,
  });

  count++;
  current = nextMonth(current);
}

console.log(`✓ ${count} jobs mensais enfileirados`);
console.log(`  Estimativa: ~${Math.round(count * 3)} minutos (~${Math.round(count * 3 / 60)} horas)`);
await queue.close();

/**
 * Coleta IDs de acórdãos do TST e salva na tabela tst_ids_tmp.
 * Não usa BullMQ nem Elasticsearch — roda diretamente com npx tsx.
 *
 * A tabela é permanente. Após extrair os dados para o ES, limpe com:
 *   TRUNCATE TABLE tst_ids_tmp;
 *
 * Uso:
 *   cd /opt/judicore/apps/api
 *   npx tsx src/scripts/tst-collect-ids.ts [--from 2020-01-01] [--to 2026-05-31]
 */
import "dotenv/config";
import { prisma } from "@judicore/db";

const TST_BASE = "https://jurisprudencia-backend2.tst.jus.br/rest/pesquisa-textual";
const PAGE_SIZE = 100;
const PAGE_DELAY_MS  = 12000; // entre páginas da mesma janela
const WINDOW_DAYS    = 3;     // dias por janela
const WINDOW_COOLDOWN_MS = 30000; // pausa entre janelas

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}

function parseArg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? (process.argv[idx + 1] ?? fallback) : fallback;
}

function isValidId(id: string): boolean {
  return /^[0-9a-f]{32,64}$/i.test(id);
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

async function fetchPage(startDate: string, endDate: string, page: number) {
  const res = await fetch(`${TST_BASE}/${page}/${PAGE_SIZE}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Referer": "https://jurisprudencia.tst.jus.br/",
    },
    body: JSON.stringify({
      orgao: "TST",
      termoExato: "",
      publicacaoInicial: startDate,
      publicacaoFinal: endDate,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ totalRegistros: number; registros?: Array<{ registro: any }> }>;
}

async function collectWindow(startDate: string, endDate: string): Promise<{ inserted: number; total: number }> {
  let page = 1;
  let totalPages = 1;
  let totalRegistros = 0;
  let inserted = 0;
  let consecutiveErrors = 0;

  while (page <= totalPages) {
    try {
      const data = await fetchPage(startDate, endDate, page);
      totalRegistros = data.totalRegistros ?? 0;
      totalPages = Math.ceil(totalRegistros / PAGE_SIZE) || 1;

      const registros = data.registros ?? [];

      if (!registros.length) {
        if (totalRegistros > 0) {
          consecutiveErrors++;
          if (consecutiveErrors >= 3) break;
          await delay(PAGE_DELAY_MS * 5);
          continue;
        }
        break;
      }

      consecutiveErrors = 0;

      const rows = registros
        .map(({ registro: r }) => r)
        .filter((r: any) => r?.id && isValidId(r.id))
        .map((r: any) => {
          const dataPub = (r.dtaPublicacao ?? startDate).slice(0, 10);
          return { id: r.id as string, dataPub: isValidDate(dataPub) ? dataPub : startDate };
        });

      if (rows.length > 0) {
        const values = rows.map(x => `('${x.id}', '${x.dataPub}'::date)`).join(",");
        await prisma.$executeRawUnsafe(
          `INSERT INTO tst_ids_tmp (id, data_pub) VALUES ${values} ON CONFLICT (id) DO NOTHING`
        );
        inserted += rows.length;
      }

      if (page >= totalPages) break;
      page++;
      await delay(PAGE_DELAY_MS);
    } catch (err) {
      consecutiveErrors++;
      console.error(`    Erro p${page} (${consecutiveErrors}/3):`, (err as Error).message);
      if (consecutiveErrors >= 3) break;
      await delay(PAGE_DELAY_MS * 5);
    }
  }

  return { inserted, total: totalRegistros };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const fromStr = parseArg("--from", "2020-01-01");
const toStr   = parseArg("--to",   fmt(new Date()));

await prisma.$executeRaw`
  CREATE TABLE IF NOT EXISTS tst_ids_tmp (
    id       VARCHAR(64) PRIMARY KEY,
    data_pub DATE NOT NULL
  )
`;

const [[{ total_existente }]] = await prisma.$queryRaw<[[{ total_existente: bigint }]]>`
  SELECT COUNT(*) AS total_existente FROM tst_ids_tmp
`;

console.log(`TST coleta de IDs: ${fromStr} → ${toStr} (janelas de ${WINDOW_DAYS} dias)`);
console.log(`Tabela tst_ids_tmp: ${total_existente} registros existentes\n`);

let current  = new Date(fromStr + "T00:00:00Z");
const toDate = new Date(toStr   + "T00:00:00Z");
let windowNum   = 0;
let totalInserted = 0;

while (current <= toDate) {
  const end       = addDays(current, WINDOW_DAYS - 1);
  const startDate = fmt(current);
  const endDate   = fmt(end <= toDate ? end : toDate);

  // Resumabilidade: pula janela se já tiver dados nesse intervalo
  const [[{ count: existingInWindow }]] = await prisma.$queryRaw<[[{ count: bigint }]]>`
    SELECT COUNT(*) AS count FROM tst_ids_tmp
    WHERE data_pub BETWEEN ${startDate}::date AND ${endDate}::date
  `;

  windowNum++;

  if (Number(existingInWindow) > 0) {
    process.stdout.write(`[${windowNum}] ${startDate}→${endDate}: já coletado (${existingInWindow} docs) ✓\n`);
    current = addDays(current, WINDOW_DAYS);
    continue;
  }

  const { inserted, total } = await collectWindow(startDate, endDate);
  totalInserted += inserted;

  const [[{ grand_total }]] = await prisma.$queryRaw<[[{ grand_total: bigint }]]>`
    SELECT COUNT(*) AS grand_total FROM tst_ids_tmp
  `;

  process.stdout.write(`[${windowNum}] ${startDate}→${endDate}: +${inserted}/${total} | DB total: ${grand_total}\n`);

  current = addDays(current, WINDOW_DAYS);
  if (current <= toDate) await delay(WINDOW_COOLDOWN_MS);
}

console.log(`\nConcluído. ${totalInserted} novos IDs inseridos nesta execução.`);
console.log(`Total na tabela: SELECT COUNT(*) FROM tst_ids_tmp;`);

await prisma.$disconnect();

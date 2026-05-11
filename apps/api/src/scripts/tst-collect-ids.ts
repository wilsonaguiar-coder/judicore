/**
 * Garimpagem de IDs do TST → tabela tst_ids_tmp (id, data_pub).
 * Sem BullMQ, sem Elasticsearch. Só id e data.
 *
 * Uso:
 *   cd /opt/judicore/apps/api
 *   npx tsx src/scripts/tst-collect-ids.ts [--from 2020-01-01] [--to 2026-05-31]
 *
 * Limpar dados após uso no ES:
 *   TRUNCATE TABLE tst_ids_tmp;
 *   TRUNCATE TABLE tst_windows_done;
 */
import "dotenv/config";
import { prisma } from "@judicore/db";

const TST_BASE   = "https://jurisprudencia-backend2.tst.jus.br/rest/pesquisa-textual";
const PAGE_SIZE  = 100;
const PAGE_DELAY = 12000;   // entre páginas
const WIN_DAYS   = 1;       // janela de 1 dia para manter abaixo do rate limit
const WIN_PAUSE  = 120000;  // 2 min entre janelas para resetar rate limit do TST

const delay   = (ms: number) => new Promise(r => setTimeout(r, ms));
const fmt     = (d: Date)    => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

function parseArg(name: string, fallback: string) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? (process.argv[i + 1] ?? fallback) : fallback;
}

async function fetchPage(start: string, end: string, page: number) {
  const res = await fetch(`${TST_BASE}/${page}/${PAGE_SIZE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Referer": "https://jurisprudencia.tst.jus.br/" },
    body: JSON.stringify({ orgao: "TST", termoExato: "", publicacaoInicial: start, publicacaoFinal: end }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ totalRegistros: number; registros?: Array<{ registro: any }> }>;
}

async function collectWindow(start: string, end: string): Promise<{ inserted: number; total: number }> {
  let page = 1, totalPages = 1, totalRegistros = 0, inserted = 0, errors = 0;

  while (page <= totalPages) {
    try {
      const data = await fetchPage(start, end, page);
      totalRegistros = data.totalRegistros ?? 0;
      totalPages = Math.ceil(totalRegistros / PAGE_SIZE) || 1;

      const rows = (data.registros ?? [])
        .map(({ registro: r }) => r)
        .filter((r: any) => r?.id && typeof r.id === "string" && r.id.length >= 8)
        .map((r: any) => `('${r.id}', '${(r.dtaPublicacao ?? start).slice(0, 10)}'::date)`);

      if (!rows.length) {
        if (totalRegistros > 0 && errors++ < 3) { await delay(PAGE_DELAY * 4); continue; }
        break;
      }

      errors = 0;
      await prisma.$executeRawUnsafe(
        `INSERT INTO tst_ids_tmp (id, data_pub) VALUES ${rows.join(",")} ON CONFLICT (id) DO NOTHING`
      );
      inserted += rows.length;

      if (page >= totalPages) break;
      page++;
      await delay(PAGE_DELAY);
    } catch (e) {
      if (errors++ >= 3) break;
      await delay(PAGE_DELAY * 4);
    }
  }

  return { inserted, total: totalRegistros };
}

// ── main ──────────────────────────────────────────────────────────────────────

await prisma.$executeRaw`
  CREATE TABLE IF NOT EXISTS tst_ids_tmp (
    id       VARCHAR(64) PRIMARY KEY,
    data_pub DATE NOT NULL
  )
`;

// Tabela de controle: registra quais janelas já foram processadas
await prisma.$executeRaw`
  CREATE TABLE IF NOT EXISTS tst_windows_done (
    window_start DATE PRIMARY KEY,
    collected_at TIMESTAMP DEFAULT NOW(),
    inserted     INT NOT NULL DEFAULT 0,
    total        INT NOT NULL DEFAULT 0
  )
`;

const from   = parseArg("--from", "2020-01-01");
const to     = parseArg("--to",   fmt(new Date()));
let current  = new Date(from + "T00:00:00Z");
const toDate = new Date(to   + "T00:00:00Z");
let win = 0;

const [{ n: totalExist }] = await prisma.$queryRaw<[{ n: bigint }]>`SELECT COUNT(*) AS n FROM tst_ids_tmp`;
console.log(`TST coleta: ${from} → ${to} (janelas de ${WIN_DAYS} dia(s))`);
console.log(`IDs já na tabela: ${totalExist}\n`);

while (current <= toDate) {
  const endD  = addDays(current, WIN_DAYS - 1);
  const start = fmt(current);
  const end   = fmt(endD <= toDate ? endD : toDate);
  win++;

  // Pula janelas já processadas com base na tabela de controle
  const done = await prisma.$queryRaw<{ window_start: Date }[]>`
    SELECT window_start FROM tst_windows_done WHERE window_start = ${start}::date
  `;

  if (done.length > 0) {
    process.stdout.write(`[${win}] ${start}: já processado ✓\n`);
    current = addDays(current, WIN_DAYS);
    continue;
  }

  const { inserted, total } = await collectWindow(start, end);

  // Registra janela como concluída
  await prisma.$executeRaw`
    INSERT INTO tst_windows_done (window_start, inserted, total)
    VALUES (${start}::date, ${inserted}, ${total})
    ON CONFLICT (window_start) DO NOTHING
  `;

  const [{ grand }] = await prisma.$queryRaw<[{ grand: bigint }]>`SELECT COUNT(*) AS grand FROM tst_ids_tmp`;
  process.stdout.write(`[${win}] ${start}: +${inserted}/${total} | DB: ${grand}\n`);

  current = addDays(current, WIN_DAYS);
  if (current <= toDate && total > 0) await delay(WIN_PAUSE);
}

console.log("\nConcluído.");
await prisma.$disconnect();

import "dotenv/config";
import { prisma } from "@judicore/db";

const [{ total }] = await prisma.$queryRaw<[{ total: bigint }]>`SELECT COUNT(*) AS total FROM tst_ids_tmp`;
const [{ janTotal }] = await prisma.$queryRaw<[{ janTotal: bigint }]>`SELECT COUNT(*) AS "janTotal" FROM tst_ids_tmp WHERE data_pub BETWEEN '2020-01-01' AND '2020-01-31'`;
const sample = await prisma.$queryRaw<{ id: string; data_pub: Date }[]>`SELECT id, data_pub FROM tst_ids_tmp ORDER BY data_pub LIMIT 5`;
const perDay = await prisma.$queryRaw<{ dia: Date; n: bigint }[]>`SELECT data_pub AS dia, COUNT(*) AS n FROM tst_ids_tmp GROUP BY data_pub ORDER BY data_pub LIMIT 20`;

console.log(`\n=== tst_ids_tmp ===`);
console.log(`Total de IDs: ${total}`);
console.log(`Janeiro/2020:  ${janTotal}`);
console.log(`\nPrimeiros 5 registros:`);
for (const r of sample) console.log(` ${r.id}  ${r.data_pub.toISOString().slice(0,10)}`);
console.log(`\nPor dia (primeiros 20):`);
for (const r of perDay) console.log(` ${r.dia.toISOString().slice(0,10)}: ${r.n}`);

await prisma.$disconnect();

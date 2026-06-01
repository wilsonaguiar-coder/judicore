// Gerador de casos sintéticos do Quality Lab.
//
// generateSyntheticCases(count, areaFilter?)
//   Distribui o total proporcionalmente pelas 5 áreas. Dentro de cada área,
//   itera ciclicamente pelos templates definidos em case-templates.ts.
//
// Quando count=100 (default):
//   - 20 RPPS, 20 RGPS, 20 TRABALHISTA, 20 CRIMINAL, 20 CIVEL.
//
// Quando areaFilter está presente, todos os casos vêm da área especificada.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LegalArea, SyntheticCase } from "./case-types.js";
import { TEMPLATES_BY_AREA } from "./case-templates.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function generateSyntheticCases(count = 100, areaFilter?: LegalArea): SyntheticCase[] {
  const cases: SyntheticCase[] = [];
  const areas: LegalArea[] = areaFilter
    ? [areaFilter]
    : ["RPPS", "RGPS", "TRABALHISTA", "CRIMINAL", "CIVEL"];
  const perArea = Math.floor(count / areas.length);
  const remainder = count - perArea * areas.length;

  for (let a = 0; a < areas.length; a++) {
    const area = areas[a]!;
    const templates = TEMPLATES_BY_AREA[area];
    const areaCount = perArea + (a < remainder ? 1 : 0);
    for (let i = 0; i < areaCount; i++) {
      const template = templates[i % templates.length]!;
      cases.push(template(i));
    }
  }
  return cases;
}

// ── CLI: salva os casos em output/cases.json (apenas para inspeção) ──────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const countArg = args.find((a) => a.startsWith("--count="));
  const areaArg = args.find((a) => a.startsWith("--area="));
  const count = countArg ? Number.parseInt(countArg.slice("--count=".length), 10) : 100;
  const area = areaArg ? (areaArg.slice("--area=".length) as LegalArea) : undefined;
  const cases = generateSyntheticCases(count, area);

  const outDir = join(__dirname, "output");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "cases.json");
  await writeFile(outPath, JSON.stringify(cases, null, 2), "utf8");

  console.log(`[case-factory] Geração concluída`);
  console.log(`  total:  ${cases.length}`);
  console.log(`  por área:`);
  const byArea = new Map<string, number>();
  for (const c of cases) byArea.set(c.area, (byArea.get(c.area) ?? 0) + 1);
  for (const [a, n] of byArea) console.log(`    ${a}: ${n}`);
  console.log(`  arquivo: ${outPath}`);
}

const isMain = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
               import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, "/") ?? "");
if (isMain) {
  void main();
}

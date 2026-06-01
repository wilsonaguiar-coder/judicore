// Gerador de casos sintéticos do Quality Lab.
//
// Distribuição obrigatória:
//   20 temas × 4 fases (PETICAO_INICIAL, RECURSO, DECISAO, SENTENCA) = 80 casos
//   + 20 despachos (ciclando entre 5 templates de despacho)
//   = 100 casos totais.
//
// 30% dos casos (30) recebem armadilhas jurídicas (traps) distribuídas
// deterministicamente por índice. As traps são compatíveis com a área/fase
// — armadilhas inaplicáveis viram no-ops.
//
// Argumentos opcionais:
//   --count=N    limita aos N primeiros casos do plano
//   --area=X     filtra para uma área específica (afeta apenas os 80 com tema;
//                despachos não respondem à área)
//   --dry-run    grava cases.json sem chamar OpenAI

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SyntheticCase, LegalArea, TrapKind } from "./case-types.js";
import type { TipoPeca } from "../src/pipeline/types.js";
import { THEMES, PHASE_BUILDERS, buildDespacho } from "./case-templates.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PHASES = ["PETICAO_INICIAL", "RECURSO", "DECISAO", "SENTENCA"] as const;
type Phase = typeof PHASES[number];

// Distribuição determinística de traps. ~30% dos casos.
// Cada slot (theme×phase ou despacho idx) recebe uma trap se atender ao critério.
function decideTrap(slotIndex: number, area: LegalArea, phase: Phase | "DESPACHO"): TrapKind | undefined {
  // Critério: roda traps em índices específicos (cobrindo ~30%)
  const trapEvery3 = slotIndex % 3 === 0;
  if (!trapEvery3) return undefined;

  const cycleIdx = Math.floor(slotIndex / 3);
  const trapTable: TrapKind[] = [
    "JURISPRUDENCIA_CONTRARIA",
    "ARTIGO_INCOMPATIVEL",
    "RECURSO_INADEQUADO",
    "COMPETENCIA_INCORRETA",
    "TESE_EQUIVOCADA",
    "PRECEDENTE_SUPERADO",
    "FATO_INCOMPLETO",
    "LINGUAGEM_DECISORIA",
  ];

  let kind = trapTable[cycleIdx % trapTable.length]!;

  // Compatibilidade trap×fase×área (degrada para algo aplicável)
  if (kind === "RECURSO_INADEQUADO" && phase !== "RECURSO") kind = "ARTIGO_INCOMPATIVEL";
  if (kind === "COMPETENCIA_INCORRETA" && phase !== "RECURSO") kind = "JURISPRUDENCIA_CONTRARIA";
  if (kind === "LINGUAGEM_DECISORIA" && phase !== "DESPACHO") kind = "ARTIGO_INCOMPATIVEL";
  if (kind === "ARTIGO_INCOMPATIVEL" && !["RPPS", "RGPS", "CRIMINAL"].includes(area)) {
    kind = "JURISPRUDENCIA_CONTRARIA";
  }
  // RECURSO_INADEQUADO só faz sentido em TRABALHISTA / JEF (não temos JEF aqui)
  if (kind === "RECURSO_INADEQUADO" && area !== "TRABALHISTA") kind = "JURISPRUDENCIA_CONTRARIA";
  if (kind === "COMPETENCIA_INCORRETA" && area !== "TRABALHISTA") kind = "JURISPRUDENCIA_CONTRARIA";

  return kind;
}

export function generateSyntheticCases(
  count = 100,
  areaFilter?: LegalArea,
  typeFilter?: TipoPeca,
): SyntheticCase[] {
  const cases: SyntheticCase[] = [];

  // 80 casos: 20 temas × 4 fases
  const themesToUse = areaFilter
    ? THEMES.filter((t) => t.build(0).area === areaFilter)
    : THEMES;

  let slot = 0;
  for (const theme of themesToUse) {
    const narrative = theme.build(slot);
    for (const phase of PHASES) {
      const trap = decideTrap(slot, narrative.area, phase);
      const builder = PHASE_BUILDERS[phase];
      cases.push(builder(narrative, slot, trap));
      slot++;
    }
  }

  // 20 despachos (só geramos quando não há filtro de área OU quando o filtro
  // é compatível com algum template — atualmente despachos cobrem várias áreas)
  if (!areaFilter) {
    for (let i = 0; i < 20; i++) {
      const trap = i % 4 === 0 ? "LINGUAGEM_DECISORIA" : undefined;
      cases.push(buildDespacho(slot + i, trap));
    }
  }

  // Filtro por tipo de peça — aplicado após gerar todos os casos da área
  const filtered = typeFilter ? cases.filter((c) => c.documentType === typeFilter) : cases;

  return filtered.slice(0, count);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const countArg = args.find((a) => a.startsWith("--count="));
  const areaArg = args.find((a) => a.startsWith("--area="));
  const typeArg = args.find((a) => a.startsWith("--type="));
  const count = countArg ? Number.parseInt(countArg.slice("--count=".length), 10) : 100;
  const area = areaArg ? (areaArg.slice("--area=".length) as LegalArea) : undefined;
  const documentType = typeArg ? (typeArg.slice("--type=".length) as TipoPeca) : undefined;
  const cases = generateSyntheticCases(count, area, documentType);

  const outDir = join(__dirname, "output");
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "cases.json"), JSON.stringify(cases, null, 2), "utf8");

  // Sumário
  const byArea = new Map<string, number>();
  const byType = new Map<string, number>();
  const byTrap = new Map<string, number>();
  let withTrap = 0;
  for (const c of cases) {
    byArea.set(c.area, (byArea.get(c.area) ?? 0) + 1);
    byType.set(c.documentType, (byType.get(c.documentType) ?? 0) + 1);
    if (c.trap) {
      withTrap++;
      byTrap.set(c.trap, (byTrap.get(c.trap) ?? 0) + 1);
    }
  }

  console.log(`[case-factory] Geração concluída`);
  console.log(`  total:           ${cases.length}`);
  console.log(`  por área:        ${[...byArea].map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`  por documento:   ${[...byType].map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`  com traps:       ${withTrap} (${Math.round((withTrap / cases.length) * 100)}%)`);
  console.log(`  por tipo trap:   ${[...byTrap].map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`  arquivo:         ${join(outDir, "cases.json")}`);
}

const isMain = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
               import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, "/") ?? "");
if (isMain) {
  void main();
}

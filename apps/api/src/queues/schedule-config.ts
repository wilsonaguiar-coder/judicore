import type { IndexingJobData, IndexingSource } from "./types.js";
import type { LegalArea } from "@judicore/search";

// Arquitetura de fontes:
// LanceDB  → STF, STJ, TJSP (base histórica pré-carregada, busca vetorial)
// ES       → TST, TRF1-6 (sem sobreposição com LanceDB)
// Adaptadores TRF pendentes — áreas federais serão adicionadas quando implementados.

const TRFs = ["TRF1","TRF2","TRF3","TRF4","TRF5","TRF6"];

const TRIBUNAIS_BY_AREA: Partial<Record<LegalArea, string[]>> = {
  TRABALHISTA:    ["TST"],
  // TRF areas — habilitadas quando adaptadores TRF forem implementados:
  TRIBUTARIO:     TRFs,
  PREVIDENCIARIO: TRFs,
  ADMINISTRATIVO: TRFs,
  CRIMINAL:       TRFs,
  AMBIENTAL:      TRFs,
  CIVIL:          TRFs,
};

const QUERIES_BY_AREA: Record<LegalArea, string[]> = {
  TRABALHISTA:    [""],
  OUTRO:          [""],
  CRIMINAL:       [""],
  TRIBUTARIO:     ["execução fiscal imposto", "compensação tributária crédito", "contribuição previdenciária empresa"],
  PREVIDENCIARIO: ["aposentadoria invalidez benefício", "acidente trabalho INSS nexo", "segurado especial rural"],
  ADMINISTRATIVO: ["improbidade administrativa erário", "servidor público concurso licitação", "responsabilidade civil estado"],
  AMBIENTAL:      ["dano ambiental licença", "área proteção permanente desmatamento", "crime ambiental"],
  CIVIL:          [""],
};

export const SCHEDULE_CONFIG: Array<{
  area: LegalArea;
  cron: string;
  sources: IndexingSource[];
  maxPages: number;
}> = [
  // TST — único adaptador ES funcional no momento
  { area: "TRABALHISTA", cron: "0 4 * * 0", sources: ["tst"], maxPages: 50 },
  // TRF areas — descomentar quando adaptadores TRF forem implementados:
  // { area: "TRIBUTARIO",     cron: "0 2 * * 2,5",  sources: ["trf"], maxPages: 20 },
  // { area: "PREVIDENCIARIO", cron: "30 2 * * 1,4", sources: ["trf"], maxPages: 20 },
  // { area: "ADMINISTRATIVO", cron: "0 3 * * 3,6",  sources: ["trf"], maxPages: 20 },
  // { area: "CRIMINAL",       cron: "0 4 * * 5",    sources: ["trf"], maxPages: 20 },
  // { area: "AMBIENTAL",      cron: "0 3 * * 0",    sources: ["trf"], maxPages: 20 },
  // { area: "CIVIL",          cron: "0 2 * * 6",    sources: ["trf"], maxPages: 20 },
];

export function buildJobData(
  area: LegalArea,
  sources: IndexingSource[],
  maxPages: number,
  triggeredBy: "scheduler" | "manual" = "scheduler"
): IndexingJobData {
  const tribunais = TRIBUNAIS_BY_AREA[area];
  return {
    area,
    sources,
    queries: QUERIES_BY_AREA[area] ?? [""],
    ...(tribunais ? { tribunais } : {}),
    maxPages,
    triggeredBy,
  };
}

import type { IndexingJobData, IndexingSource } from "./types.js";
import type { LegalArea } from "@judicore/search";

// Cada área consulta apenas os tribunais onde suas causas naturalmente tramitam.
// Tribunais homogêneos (TRTs, TREs, STM) usam match_all (query "").
// TRFs usam 3 queries focadas; classifyArea + inferAreaFromTribunal determinam a área real.
// TJSP excluído — já coberto pelo LanceDB com inteiro teor.

const TRTs = ["TRT1","TRT2","TRT3","TRT4","TRT5","TRT6","TRT7","TRT8","TRT9","TRT10",
               "TRT11","TRT12","TRT13","TRT14","TRT15","TRT16","TRT17","TRT18","TRT19",
               "TRT20","TRT21","TRT22","TRT23","TRT24"];

const TREs = ["TRE-AC","TRE-AL","TRE-AM","TRE-AP","TRE-BA","TRE-CE","TRE-DF","TRE-ES",
               "TRE-GO","TRE-MA","TRE-MG","TRE-MS","TRE-MT","TRE-PA","TRE-PB","TRE-PE",
               "TRE-PI","TRE-PR","TRE-RJ","TRE-RN","TRE-RO","TRE-RR","TRE-RS","TRE-SC",
               "TRE-SE","TRE-SP","TRE-TO"];

const TRFs = ["TRF1","TRF2","TRF3","TRF4","TRF5","TRF6"];

// TJs estaduais exceto TJSP (já no LanceDB)
const TJs = ["TJRJ","TJMG","TJRS","TJPR","TJSC","TJBA","TJPE","TJCE","TJGO","TJDFT",
              "TJMA","TJPA","TJES","TJMT","TJMS","TJAL","TJSE","TJRN","TJPB","TJPI",
              "TJAM","TJAC","TJRO","TJRR","TJAP","TJTO"];

const TRIBUNAIS_BY_AREA: Record<LegalArea, string[]> = {
  TRABALHISTA:    ["TST", ...TRTs],
  OUTRO:          ["TSE", ...TREs],
  CRIMINAL:       ["STM", ...TRFs],
  TRIBUTARIO:     TRFs,
  PREVIDENCIARIO: TRFs,
  ADMINISTRATIVO: TRFs,
  AMBIENTAL:      TRFs,
  CIVIL:          TJs,
};

// Queries por área: "" = match_all (para tribunais homogêneos)
// TRFs: 3 queries focadas para amostragem eficiente
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

const ALL_SOURCES: IndexingSource[] = ["datajud", "stj"];

export const SCHEDULE_CONFIG: Array<{
  area: LegalArea;
  cron: string;
  sources: IndexingSource[];
  maxPages: number;
}> = [
  { area: "TRIBUTARIO",     cron: "0 2 * * 2,5", sources: ALL_SOURCES, maxPages: 5 },
  { area: "PREVIDENCIARIO", cron: "30 2 * * 1,4", sources: ALL_SOURCES, maxPages: 5 },
  { area: "ADMINISTRATIVO", cron: "0 3 * * 3,6", sources: ALL_SOURCES, maxPages: 5 },
  { area: "CRIMINAL",       cron: "0 4 * * 5",   sources: ALL_SOURCES, maxPages: 5 },
  { area: "AMBIENTAL",      cron: "0 3 * * 0",   sources: ALL_SOURCES, maxPages: 5 },
  { area: "TRABALHISTA",    cron: "0 4 * * 0",   sources: ALL_SOURCES, maxPages: 5 },
  { area: "CIVIL",          cron: "0 2 * * 6",   sources: ALL_SOURCES, maxPages: 3 },
  { area: "OUTRO",          cron: "0 5 * * 0",   sources: ["datajud"], maxPages: 3 },
];

export function buildJobData(
  area: LegalArea,
  sources: IndexingSource[],
  maxPages: number,
  triggeredBy: "scheduler" | "manual" = "scheduler"
): IndexingJobData {
  return {
    area,
    sources,
    queries: QUERIES_BY_AREA[area] ?? [""],
    tribunais: TRIBUNAIS_BY_AREA[area],
    maxPages,
    triggeredBy,
  };
}

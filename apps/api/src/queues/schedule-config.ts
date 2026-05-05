import type { IndexingJobData, IndexingSource } from "./types.js";
import type { LegalArea } from "@judicore/search";

/**
 * Termos de busca por área jurídica.
 * Adicionar mais termos aumenta a cobertura do índice.
 */
const QUERIES_BY_AREA: Record<LegalArea, string[]> = {
  TRIBUTARIO: [
    "imposto de renda pessoa jurídica",
    "contribuição previdenciária empresa",
    "ICMS base de cálculo",
    "compensação tributária",
    "decadência prescrição tributária",
    "execução fiscal redirecionamento",
  ],
  PREVIDENCIARIO: [
    "aposentadoria por invalidez",
    "benefício por incapacidade temporária",
    "tempo de contribuição especial",
    "revisão benefício previdenciário",
    "acidente trabalho nexo causal",
    "pensão por morte dependente",
  ],
  ADMINISTRATIVO: [
    "improbidade administrativa dano erário",
    "licitação contrato administrativo",
    "servidor público estabilidade",
    "desapropriação indenização justa",
    "responsabilidade civil estado",
    "mandado segurança ato administrativo",
  ],
  CRIMINAL: [
    "tráfico drogas pena substituição",
    "roubo qualificado concurso agentes",
    "habeas corpus prisão preventiva",
    "lavagem dinheiro crime antecedente",
    "corrupção ativa passiva funcionário público",
  ],
  AMBIENTAL: [
    "dano ambiental reparação integral",
    "área proteção permanente supressão",
    "crime ambiental pessoa jurídica",
    "licença ambiental exigência",
  ],
  TRABALHISTA: [
    "vínculo empregatício reconhecimento",
    "horas extras habitualidade",
    "assédio moral dano moral trabalho",
    "rescisão indireta justa causa",
  ],
  CIVIL: [
    "responsabilidade civil médico erro",
    "dano moral quantum indenizatório",
    "contrato compra venda rescisão",
    "usucapião posse animus domini",
    "alimentos revisional exoneração",
  ],
  OUTRO: [
    "recurso especial admissibilidade",
    "repercussão geral tema",
  ],
};

const ALL_SOURCES: IndexingSource[] = ["datajud", "stj", "stf"];

/**
 * Configuração de agendamento por área.
 * cron: expressão cron (UTC)
 * Estratégia: áreas mais comuns rodam mais frequentemente
 */
export const SCHEDULE_CONFIG: Array<{
  area: LegalArea;
  cron: string;
  sources: IndexingSource[];
  maxPages: number;
}> = [
  // Terça e sexta às 02:00
  { area: "TRIBUTARIO",     cron: "0 2 * * 2,5", sources: ALL_SOURCES, maxPages: 5 },
  // Segunda e quinta às 02:30
  { area: "PREVIDENCIARIO", cron: "30 2 * * 1,4", sources: ALL_SOURCES, maxPages: 5 },
  // Quarta e sábado às 03:00
  { area: "ADMINISTRATIVO", cron: "0 3 * * 3,6", sources: ALL_SOURCES, maxPages: 5 },
  // Sexta às 04:00
  { area: "CRIMINAL",       cron: "0 4 * * 5",   sources: ALL_SOURCES, maxPages: 4 },
  // Domingo às 03:00
  { area: "AMBIENTAL",      cron: "0 3 * * 0",   sources: ALL_SOURCES, maxPages: 3 },
  // Domingo às 04:00
  { area: "TRABALHISTA",    cron: "0 4 * * 0",   sources: ALL_SOURCES, maxPages: 3 },
  // Sábado às 02:00
  { area: "CIVIL",          cron: "0 2 * * 6",   sources: ALL_SOURCES, maxPages: 5 },
  // Domingo às 05:00
  { area: "OUTRO",          cron: "0 5 * * 0",   sources: ["datajud"], maxPages: 2 },
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
    queries: QUERIES_BY_AREA[area],
    maxPages,
    triggeredBy,
  };
}

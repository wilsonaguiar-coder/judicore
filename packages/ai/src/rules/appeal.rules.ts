import type { TipoJustica } from "../pipeline/types.js";

export interface AppealRule {
  recurso: string;
  sigla: string;
  prazo_dias: number;
  tribunal_destino: string;
  fundamento: string;
}

export const APPEAL_BY_JUSTICE: Record<string, AppealRule> = {
  TRABALHO: {
    recurso: "Recurso Ordinário",
    sigla: "RO",
    prazo_dias: 8,
    tribunal_destino: "TRT",
    fundamento: "art. 895 CLT",
  },
  FEDERAL: {
    recurso: "Apelação",
    sigla: "AC",
    prazo_dias: 15,
    tribunal_destino: "TRF",
    fundamento: "art. 1.009 CPC/2015",
  },
  ESTADUAL: {
    recurso: "Apelação (cível: art. 1.009 CPC) ou Apelação Criminal (criminal: art. 593 CPP)",
    sigla: "APL",
    prazo_dias: 15,
    tribunal_destino: "TJXX",
    fundamento: "art. 1.009 CPC/2015 ou art. 593 CPP",
  },
  JEF: {
    recurso: "Recurso Inominado",
    sigla: "RI",
    prazo_dias: 10,
    tribunal_destino: "Turma Recursal Federal",
    fundamento: "art. 42 Lei 9.099/95 c/c art. 1º Lei 10.259/01",
  },
  JEC: {
    recurso: "Recurso Inominado",
    sigla: "RI",
    prazo_dias: 10,
    tribunal_destino: "Turma Recursal Estadual",
    fundamento: "art. 42 Lei 9.099/95",
  },
  CRIMINAL: {
    recurso: "Apelação Criminal",
    sigla: "APL",
    prazo_dias: 5,
    tribunal_destino: "Tribunal de Justiça / TRF",
    fundamento: "art. 593 CPP",
  },
  EXECUCAO_FISCAL: {
    recurso: "Apelação",
    sigla: "AC",
    prazo_dias: 15,
    tribunal_destino: "TRF ou TJXX",
    fundamento: "art. 34 Lei 6.830/80 (valores até 50 OTN) ou art. 1.009 CPC",
  },
  INDETERMINADA: {
    recurso: "[A DETERMINAR conforme jurisdição]",
    sigla: "?",
    prazo_dias: 0,
    tribunal_destino: "[A DETERMINAR]",
    fundamento: "[A DETERMINAR]",
  },
};

// Recursos incompatíveis por jurisdição (para validação)
export const INCOMPATIBLE_APPEALS: Record<string, string[]> = {
  TRABALHO: ["apelação", "apelação cível", "stj", "recurso especial"],
  JEF: ["recurso ordinário", "recurso de revista", "apelação"],
  JEC: ["recurso ordinário", "recurso de revista", "apelação"],
  CRIMINAL: ["recurso ordinário trabalhista", "recurso de revista", "art. 895 clt"],
};

export const SUPERIOR_COURT_ROUTES: Record<string, string> = {
  TRABALHO: "TST (art. 896 CLT)",
  FEDERAL: "STJ/STF",
  ESTADUAL: "STJ/STF",
  JEF: "TNU (Turma Nacional de Uniformização)",
  JEC: "STJ (questão federal) ou TJ (questão estadual)",
  CRIMINAL: "STJ/STF",
  EXECUCAO_FISCAL: "STJ/STF",
  INDETERMINADA: "[A DETERMINAR]",
};

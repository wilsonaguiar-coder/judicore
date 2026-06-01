import type { TipoJustica, RegimeJuridico } from "../pipeline/types.js";

export interface JurisdicaoRule {
  descricao: string;
  tribunal_primeiro_grau: string;
  tribunal_segundo_grau: string;
  tribunal_superior: string;
  artigos_bloqueados: string[];
  diplomas_prioritarios: string[];
  recursos_validos: string[];
  honorarios_artigo: string;
  custas_artigo: string;
}

export interface ForbiddenCombination {
  id: string;
  descricao: string;
  condicao_justica?: TipoJustica;
  condicao_regime?: RegimeJuridico;
  erro?: string;
  descricao_erro?: string;
  fatal: boolean;
}

export const FORBIDDEN_COMBINATIONS: ForbiddenCombination[] = [
  {
    id: "fc_001",
    descricao: "RPPS incompatível com Justiça do Trabalho",
    condicao_justica: "TRABALHO",
    condicao_regime: "RPPS",
    erro: "Servidores em regime RPPS são julgados pela Justiça Federal ou Estadual, não pela Justiça do Trabalho.",
    fatal: true,
  },
  {
    id: "fc_002",
    descricao: "RGPS incompatível com Justiça do Trabalho",
    condicao_justica: "TRABALHO",
    condicao_regime: "RGPS",
    erro: "Benefícios RGPS (INSS) são processados pela Justiça Federal, não pela Justiça do Trabalho.",
    fatal: true,
  },
  {
    id: "fc_003",
    descricao: "RPPS usa art. 40 CF, não art. 201 CF",
    condicao_regime: "RPPS",
    descricao_erro: "Regime RPPS é regulado pelo art. 40 da CF/88 (servidor público). Art. 201 CF regula RGPS (INSS).",
    fatal: false,
  },
  {
    id: "fc_004",
    descricao: "CLT incompatível com servidor estatutário",
    condicao_regime: "ESTATUTARIO",
    condicao_justica: "TRABALHO",
    erro: "Servidores estatutários não se regem pela CLT. Verifique se o caso é realmente trabalhista.",
    fatal: true,
  },
  {
    id: "fc_005",
    descricao: "RGPS não usa art. 40 CF",
    condicao_regime: "RGPS",
    descricao_erro: "Regime RGPS (INSS) é regulado pelo art. 201 CF. Não use art. 40 CF para benefícios do INSS.",
    fatal: false,
  },
];

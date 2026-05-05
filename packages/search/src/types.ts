export type LegalArea =
  | "TRIBUTARIO"
  | "PREVIDENCIARIO"
  | "ADMINISTRATIVO"
  | "CRIMINAL"
  | "AMBIENTAL"
  | "TRABALHISTA"
  | "CIVIL"
  | "OUTRO";

export interface Jurisprudencia {
  id: string;
  tribunal: string;         // ex: "STJ", "STF", "TRF3"
  numero: string;           // número do processo
  ementa: string;           // texto da ementa
  relator: string;
  dataJulgamento: string;
  area: LegalArea;
  url: string;              // link para o documento original
  conteudoIntegral?: string; // texto completo do acórdão (quando disponível)
  score?: number;           // relevância ES
}

export interface SearchParams {
  query: string;
  area?: LegalArea;
  tribunais?: string[];
  size?: number;
}

export interface SearchResult {
  hits: Jurisprudencia[];
  total: number;
  took: number;
}

export type LegalArea =
  | "TRIBUTARIO" | "PREVIDENCIARIO" | "ADMINISTRATIVO"
  | "CRIMINAL" | "AMBIENTAL" | "TRABALHISTA" | "CIVIL" | "OUTRO";

export const LEGAL_AREAS: Record<LegalArea, string> = {
  TRIBUTARIO: "Tributário",
  PREVIDENCIARIO: "Previdenciário",
  ADMINISTRATIVO: "Administrativo",
  CRIMINAL: "Criminal",
  AMBIENTAL: "Ambiental",
  TRABALHISTA: "Trabalhista",
  CIVIL: "Civil",
  OUTRO: "Outro",
};

export type DocumentType = "DESPACHO" | "DECISAO" | "SENTENCA";

export const DOCUMENT_TYPES: Record<DocumentType, string> = {
  DESPACHO: "Despacho",
  DECISAO: "Decisão",
  SENTENCA: "Sentença",
};

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  defaultArea?: LegalArea;
}

export interface Case {
  id: string;
  title: string;
  description: string;
  area: LegalArea;
  processNum?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { searches: number; documents: number };
}

export interface Jurisprudencia {
  id: string;
  tribunal: string;
  numero: string;
  ementa: string;
  relator: string;
  dataJulgamento: string;
  url: string;
  score?: number;
}

export interface Document {
  id: string;
  caseId: string;
  type: DocumentType;
  content: string;
  sourcesJson: Jurisprudencia[];
  modelUsed: string;
  createdAt: string;
}

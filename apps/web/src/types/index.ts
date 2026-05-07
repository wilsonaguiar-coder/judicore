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

export type DocumentType = "DESPACHO" | "DECISAO" | "SENTENCA" | "PETICAO_INICIAL" | "RECURSO";

export const DOCUMENT_TYPES: Record<DocumentType, string> = {
  DESPACHO:        "Despacho",
  DECISAO:         "Decisão",
  SENTENCA:        "Sentença",
  PETICAO_INICIAL: "Petição Inicial",
  RECURSO:         "Recurso",
};

export type UserRole = "COMUM" | "SERVIDOR" | "ADMIN";

export const DOC_TYPES_BY_ROLE: Record<UserRole, DocumentType[]> = {
  COMUM:    ["PETICAO_INICIAL", "RECURSO"],
  SERVIDOR: ["DESPACHO", "DECISAO", "SENTENCA"],
  ADMIN:    ["PETICAO_INICIAL", "RECURSO", "DESPACHO", "DECISAO", "SENTENCA"],
};

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  defaultArea?: LegalArea;
  accessExpiresAt?: string | null;
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
  tipo?: string;
  autoridade?: string;
  fonte?: string;
  textoIntegral?: string | null;
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

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

export type DocumentType = "DESPACHO" | "DECISAO" | "SENTENCA";

export interface GenerateDocumentParams {
  type: DocumentType;
  caseDescription: string;
  jurisprudencias: Jurisprudencia[];
}

export interface AnalyzeParams {
  caseDescription: string;
  jurisprudencias: Jurisprudencia[];
}

export interface AIResult {
  content: string;
  modelUsed: string;
  sourcesUsed: Jurisprudencia[];
  inputTokens: number;
  outputTokens: number;
}

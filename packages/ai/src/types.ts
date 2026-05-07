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

export type DocumentType = "DESPACHO" | "DECISAO" | "SENTENCA" | "PETICAO_INICIAL" | "RECURSO";

export interface GenerateDocumentParams {
  type: DocumentType;
  caseDescription: string;
  jurisprudencias: Jurisprudencia[];
  instruction?: string | undefined;
}

export interface AnalyzeParams {
  caseDescription: string;
  jurisprudencias: Jurisprudencia[];
}

export interface PremiumGenerateParams {
  type: DocumentType;
  documents: string[];           // textos extraídos dos PDFs
  jurisprudencias: Jurisprudencia[];
  legislation: Record<string, string>; // lei → texto do Planalto
  caseDescription?: string;
  instruction?: string;
}

export interface AIResult {
  content: string;
  modelUsed: string;
  sourcesUsed: Jurisprudencia[];
  inputTokens: number;
  outputTokens: number;
}

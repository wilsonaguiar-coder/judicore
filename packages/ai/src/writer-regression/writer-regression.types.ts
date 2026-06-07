import type { 
  LegalClassification, 
  LegalExtraction, 
  ArgumentationMatrix, 
  JurisprudenciaInput,
  DecidedOutcome,
  TipoPeca
} from "../pipeline/types.js";

export type WriterRegressionExpectedResult = "BLOCKED" | "FATAL" | "WARNING" | "PASS";

export interface WriterRegressionScenarioInput {
  draft: string;
  classification: Partial<LegalClassification> & { tipo_peca: TipoPeca };
  extraction?: Partial<LegalExtraction>;
  matrix?: Partial<ArgumentationMatrix>;
  jurisprudencias?: JurisprudenciaInput[];
  decidedOutcome?: DecidedOutcome;
}

export interface WriterRegressionScenario {
  id: string;
  group: string;
  description: string;
  input: WriterRegressionScenarioInput;
  expectedResult: WriterRegressionExpectedResult;
}

export interface WriterRegressionScenarioResult {
  scenarioId: string;
  passed: boolean;
  actualStatus: string;
  expectedStatus: string;
  errorMessages: string[];
}

export interface WriterRegressionSummary {
  totalScenarios: number;
  passed: number;
  failed: number;
  blocked: number;
  warnings: number;
  results: WriterRegressionScenarioResult[];
}

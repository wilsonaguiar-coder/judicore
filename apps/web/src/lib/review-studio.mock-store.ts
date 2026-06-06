import { IntegratedAuditResponse } from "@judicore/ai";
import { RewriteResult } from "@judicore/ai";
import { ReAuditResult } from "@judicore/ai";

// Using any for types not strictly exported at the root yet
type DocumentClass = any;
type CorrectionPlan = any;
type AssistedRevisionSuggestion = any;
type HumanReviewDecision = any;

// ============================================================================
// IMPORTANTE: DADOS TEMPOR\u00C1RIOS IN-MEMORY (MOCK STORE)
//
// Esta store existe apenas para suportar a Fase 8.3.1 (Review Studio API Wiring)
// j\u00E1 que a persist\u00EAncia com banco de dados real e Prisma AINDA N\u00C3O PODE ser
// implementada.
//
// N\u00C3O UTILIZE EM PRODU\u00C7\u00C3O. N\u00E3o h\u00E1 reten\u00E7\u00E3o ap\u00F3s rein\u00EDcio do servidor.
// ============================================================================

export interface ReviewStudioState {
  originalDraft: string;
  classification: DocumentClass;
  audit?: IntegratedAuditResponse;
  correctionPlan?: CorrectionPlan;
  suggestions: Record<string, AssistedRevisionSuggestion>;
  rewriteResults: Record<string, RewriteResult>;
  reAuditResult?: ReAuditResult;
  decisions: Record<string, HumanReviewDecision>;
}

export const reviewStudioStore: Record<string, ReviewStudioState> = {
  // Inicializamos com um caso fake s\u00F3 para simular o DB preenchido inicialmente
  // num fluxo real a UI criaria um documento primeiro.
  "doc-123": {
    originalDraft: "Neste ato, requero indeniza\u00E7\u00E3o em dobro da cobran\u00E7a de R$ 500,00 na minha conta corrente.",
    classification: "CIVIL_PETICAO_INICIAL",
    suggestions: {},
    rewriteResults: {},
    decisions: {}
  }
};

export function getReviewStore(id: string): ReviewStudioState {
  if (!reviewStudioStore[id]) {
    reviewStudioStore[id] = {
      originalDraft: "Draft padr\u00E3o para testes caso id n\u00E3o exista.",
      classification: "CIVIL_PETICAO_INICIAL",
      suggestions: {},
      rewriteResults: {},
      decisions: {}
    };
  }
  return reviewStudioStore[id];
}

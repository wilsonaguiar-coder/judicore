import type { StrengthFindingType } from "../enums/strength-finding-type.enum.js";
import type { OpportunityLevel } from "../enums/opportunity-level.enum.js";

export interface AiLegalStrengthFinding {
  id: string;
  type: StrengthFindingType;
  opportunity: OpportunityLevel;
  /** Título positivo da oportunidade (ex: "Quadro demonstrativo dos requisitos da EC 47/2005"). */
  title: string;
  /** Por que este fortalecimento aumentaria a robustez ou persuasão da peça. */
  rationale: string;
  /** Trechos literais da peça que motivaram este finding. */
  evidenceFromText: string[];
  /** O que adicionar, reforçar ou melhor demonstrar. */
  suggestion: string;
  /** Se baseado em documento disponível: qual campo/documento. Undefined quando não aplicável. */
  availableSource?: string;
  confidence: number;
  requiresHumanReview: true;
}

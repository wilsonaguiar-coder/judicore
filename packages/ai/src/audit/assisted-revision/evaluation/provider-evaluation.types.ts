export interface ProviderEvaluationCase {
  id: string;
  taskCode: string;
  instruction: string;
  context: string;
  expectedBehavior: string;
}

export interface ProviderEvaluationMetrics {
  adherence: number;          // 0 to 5
  hallucinationRisk: number;  // 0 to 5 (0 = none, 5 = high)
  usefulness: number;         // 0 to 5
  respectsScope: boolean;     // true/false
}

export interface ProviderEvaluationResult {
  caseId: string;
  provider: string;
  model: string;
  suggestion: string;
  metrics?: ProviderEvaluationMetrics; // Optional, might be filled manually later
  approved: boolean;                   // Evaluated dynamically if metrics exist
  notes?: string;
}

export function evaluateApproval(metrics: ProviderEvaluationMetrics): boolean {
  if (!metrics) return false;
  return metrics.adherence >= 4 &&
         metrics.hallucinationRisk <= 1 &&
         metrics.usefulness >= 4 &&
         metrics.respectsScope === true;
}

// Casos oficiais padr\u00E3o
export const OFFICIAL_EVALUATION_CASES: ProviderEvaluationCase[] = [
  {
    id: "case-001",
    taskCode: "UNADDRESSED_MAIN_REQUEST",
    instruction: "Revise o dispositivo para analisar o pedido principal n\u00E3o enfrentado.",
    context: "A fundamenta\u00E7\u00E3o analisa o m\u00E9rito do pedido principal (Dano Moral), por\u00E9m o dispositivo \u00E9 completamente omisso sobre ele, concedendo apenas danos materiais.",
    expectedBehavior: "Sugerir enfrentar o pedido principal no dispositivo."
  },
  {
    id: "case-002",
    taskCode: "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION",
    instruction: "Verifique a aparente contradi\u00E7\u00E3o entre laudo m\u00E9dico e conclus\u00E3o sobre incapacidade.",
    context: "Laudo pericial \u00E0s fls. 45 atesta incapacidade laborativa total. A senten\u00E7a julga improcedente sob o \u00FAnico argumento de que 'n\u00E3o h\u00E1 incapacidade comprovada', sem afastar o laudo.",
    expectedBehavior: "Perceber conflito laudo \u00D7 conclus\u00E3o e sugerir justificar o afastamento do laudo."
  },
  {
    id: "case-003",
    taskCode: "PRESCRIPTION_PROCEDENCE_CONTRADICTION",
    instruction: "Resolva a incompatibilidade entre o reconhecimento de prescri\u00E7\u00E3o e a proced\u00EAncia do pedido.",
    context: "Na p\u00E1gina 2, o juiz reconhece que a a\u00E7\u00E3o prescreveu ap\u00F3s 5 anos. No dispositivo final, entretanto, condena o r\u00E9u ao pagamento total da d\u00EDvida.",
    expectedBehavior: "Manter o foco na prescri\u00E7\u00E3o e sugerir altera\u00E7\u00E3o do dispositivo para extin\u00E7\u00E3o com resolu\u00E7\u00E3o de m\u00E9rito."
  },
  {
    id: "case-004",
    taskCode: "MISSING_ESSENTIAL_TOPIC",
    instruction: "Complemente a fundamenta\u00E7\u00E3o incluindo an\u00E1lise de t\u00F3pico essencial faltante.",
    context: "Senten\u00E7a sobre dano ambiental em \u00C1rea de Preserva\u00E7\u00E3o Permanente. Relata o caso, mas o m\u00E9rito pula direto para condena\u00E7\u00E3o sem analisar o nexo causal e a conduta.",
    expectedBehavior: "Sugerir a cria\u00E7\u00E3o de par\u00E1grafo analisando concretamente o t\u00F3pico reclamado, sem inventar fatos novos."
  }
];

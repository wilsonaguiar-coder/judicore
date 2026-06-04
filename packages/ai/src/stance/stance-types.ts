// Tipos do Stance Check Engine — FASE 4.4.1
//
// Camada de validação lógica pré-geração: detecta contradições entre
// a tese pretendida e as autoridades jurídicas encontradas (legislação,
// jurisprudência, provas) ANTES da chamada ao modelo de linguagem.

export enum StanceResult {
  SUPPORTED     = "SUPPORTED",     // legislação + jurisprudência amparam a tese
  CONTRADICTED  = "CONTRADICTED",  // autoridade dominante contraria a tese
  MIXED         = "MIXED",         // há precedentes favoráveis E contrários
  UNKNOWN       = "UNKNOWN",       // elementos insuficientes para classificar
}

export type RequestedOutcome =
  | "PROCEDENCIA"
  | "IMPROCEDENCIA"
  | "PROVIMENTO"
  | "DESPROVIMENTO";

export interface StanceInput {
  claim: string;                    // descrição do caso / tese pretendida
  legislation: string[];            // textos de normas extraídos ou fornecidos
  jurisprudence: string[];          // teses + ementas das jurisprudências injetadas
  evidence: string[];               // outros elementos probatórios ou fáticos
  requestedOutcome: RequestedOutcome;
}

export interface StanceAnalysis {
  result: StanceResult;
  confidence: number;               // 0.0 – 1.0
  reasons: string[];                // por que a classificação foi dada
  blockingIssues: string[];         // o que especificamente impede a geração
  supportingAuthorities: string[];  // excertos de autoridades favoráveis
  contraryAuthorities: string[];    // excertos de autoridades contrárias
  blockGeneration: boolean;         // true → abortar geração antes do GPT
  distinguishingFound: boolean;     // true → distinguishing válido encontrado no input
  subsidiaryThesisFound: boolean;   // true → há pedido subsidiário juridicamente viável
}

/** Conjunto de padrões de contradição por domínio jurídico. */
export interface ContradictionPattern {
  name: string;
  description: string;
  /** Regex que deve casar no `claim` (descrição do caso). */
  claimRe: RegExp;
  /** Regex que deve casar em algum texto de jurisprudência/legislação para indicar contrariedade. */
  contraryRe: RegExp;
  reason: string;
}

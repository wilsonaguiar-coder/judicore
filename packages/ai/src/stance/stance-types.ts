// Tipos do Stance Check Engine — FASE 4.4.1 / 4.4.2

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

  // Diagnóstico — "qual premissa destrói a tese, onde foi encontrada, por que bloqueio"
  reasons: string[];                // por que a classificação foi dada
  blockingIssues: string[];         // o que especificamente impede a geração
  blockingPremise: string | null;   // nome canônico da premissa impeditiva (ex: "RPPS_PARIDADE_EC41")
  blockingEvidence: string[];       // trechos exatos das autoridades que disparam o bloqueio

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

// Tipos do Quality Lab — casos sintéticos e resultados de execução.

import type {
  JurisprudenciaInput,
  TipoPeca,
  GenerationMode,
  DocumentStatus,
} from "../src/pipeline/types.js";

export type LegalArea =
  | "RPPS"
  | "RGPS"
  | "TRABALHISTA"
  | "CRIMINAL"              // decisões incidentais: HC, liberdade provisória, preventiva, progressão
  | "CRIMINAL_MERITO"       // ação penal de mérito: ABSOLVO/CONDENO com dosimetria
  | "CIVEL"                 // casos cíveis gerais (temas originais do QA)
  | "CIVEL_GERAL"           // novos casos cíveis: obrigação de fazer, danos morais, cobrança, etc.
  | "CONSUMIDOR"            // direito do consumidor: CDC, negativação, plano de saúde, banco
  | "FAZENDA_PUBLICA"       // direito público: saúde, concursos, servidores, prescrição quinquenal
  | "EXECUCAO_CUMPRIMENTO"  // fase executiva: cumprimento de sentença, impugnação, penhora
  | "JEF_CIVEL"             // @deprecated — alias legacy; usar JEF_ESTADUAL ou JEF_FEDERAL
  | "JEF_ESTADUAL"          // Juizado Especial Estadual (Lei 9.099/95) — causas até 40 SM
  | "JEF_FEDERAL";          // Juizado Especial Federal (Lei 10.259/01) — causas até 60 SM

// Tipos de armadilhas jurídicas inseridas em ~30% dos casos
export type TrapKind =
  | "JURISPRUDENCIA_CONTRARIA"   // precedente contrário não distinguido
  | "ARTIGO_INCOMPATIVEL"        // ex: RPPS com art. 201 CF, criminal com art. 85 CPC
  | "RECURSO_INADEQUADO"         // ex: trabalhista com apelação, JEF com apelação
  | "COMPETENCIA_INCORRETA"      // ex: STJ em matéria trabalhista
  | "TESE_EQUIVOCADA"            // tese juridicamente errada
  | "PRECEDENTE_SUPERADO"        // súmula/precedente já revogado
  | "FATO_INCOMPLETO"            // descrição faltando elementos essenciais
  | "LINGUAGEM_DECISORIA"              // despacho com "defiro/julgo"
  // Traps específicas de Fazenda Pública
  | "TEMA_STF_IGNORADO"                // tema repetitivo STF/STJ vinculante não aplicado
  | "RESERVA_POSSIVEL_SEM_MIN_EXIST"   // reserva do possível sem análise do mínimo existencial
  | "PRESCRICAO_QUINQUENAL_IGNORADA"   // DL 4.597/42 não aplicado — verbas funcionais
  | "LEGITIMIDADE_PASSIVA_INCORRETA"   // ente público errado no polo passivo
  | "SEPARACAO_PODERES_INCORRETA"      // separação de poderes usado para negar mínimo existencial
  | "SOLIDARIEDADE_INCORRETA"          // responsabilidade solidária dos entes negada (Tema STF 793)
  // Traps específicas de Execução / Cumprimento de Sentença
  | "EXCESSO_EXECUCAO_IGNORADO"         // excesso de execução não arguido (art. 525 §1º III CPC)
  | "TITULO_INEXIGIVEL_IGNORADO"        // título inexigível não reconhecido (art. 525 §1º I CPC)
  | "ERRO_CALCULO_IGNORADO"             // erro nos cálculos (juros/correção) aceito sem correção
  | "PRESCRICAO_INTERCORRENTE_IGNORADA" // prescrição intercorrente não declarada (art. 921 §4º CPC)
  | "PENHORA_VERBA_ALIMENTAR"           // penhora total de salário/aposentadoria — impenhorável
  | "IMPENHORABILIDADE_IGNORADA"        // bem impenhorável (imóvel de família) penhorado
  | "RITO_FAZENDA_CONFUNDIDO"           // cumprimento contra Fazenda tratado como rito comum (RPV/precatório omitido)
  | "JUROS_INCORRETOS"                  // juros moratórios fora do padrão legal (não SELIC — art. 406 CC)
  | "CORRECAO_MONETARIA_INCORRETA"      // índice de correção monetária errado (não IPCA-E)
  | "LEGITIMIDADE_EC_INCORRETA"         // ente/pessoa ilegítima no polo passivo do cumprimento
  // Traps específicas de JEF Cível (Lei 9.099/95)
  | "JEF_PERICIA_COMPLEXA"             // perícia incompatível com rito sumaríssimo — possível incompetência
  | "JEF_VALOR_EXCEDENTE"              // valor acima de 40 SM sem renúncia ao excedente
  | "JEF_RECURSO_ERRADO"               // apelação em vez de recurso inominado (art. 41 Lei 9.099/95)
  | "JEF_LEGITIMIDADE_PASSIVA"         // parte errada no polo passivo (banco/empresa/operadora)
  | "JEF_TUTELA_SEM_PERICULUM"         // tutela deferida sem periculum in mora
  | "JEF_TUTELA_SEM_FUMUS"             // tutela deferida sem fumus boni iuris / probabilidade do direito
  | "JEF_TUTELA_DESPROPORCIONAL"       // medida cautelar desproporcional ao direito tutelado (bloqueio total vs. valor pequeno)
  | "JEF_TUTELA_ARTIFICIAL"            // urgência artificial — mora própria ou urgência fabricada (art. 300 CPC)
  // Traps específicas de Recursos nos Juizados Especiais (FASE 4.4)
  | "JEF_ENDERECAMENTO_ERRADO"         // recurso endereçado ao TJ/TRF em vez da Turma Recursal
  | "JEF_PRAZO_ERRADO"                 // prazo de 15 dias (CPC) em vez de 10 dias (art. 42 Lei 9.099/95)
  | "JEF_PREPARO_ERRADO"               // preparo calculado como apelação comum — ignora microssistema JEF
  | "JEF_PEDIDO_INCOMPATIVEL"          // pedido de remessa ao TJ/TRF ou recebimento como apelação comum
  // Traps de Contradição de Postura — Stance Check Engine (FASE 4.4.1)
  | "STANCE_CONTRADICTION_RPPS"        // peça pleiteia paridade/integralidade mas fundamentação demonstra impossibilidade (EC 41/2003)
  | "STANCE_CONTRADICTION_RGPS"        // peça pleiteia benefício mas fundamentação demonstra perda de qualidade/carência
  | "STANCE_CONTRADICTION_JEF";        // peça pleiteia procedência no JEF mas fundamentação demonstra incompetência/valor excedente

export interface SyntheticCase {
  id: string;
  area: LegalArea;
  jurisdiction?: "JEF_ESTADUAL" | "JEF_FEDERAL"; // só para casos JEF_ESTADUAL / JEF_FEDERAL
  documentType: TipoPeca;
  theme: string;                 // chave do tema (ex: "rpps_paridade")
  themeLabel: string;            // rótulo legível
  title: string;
  caseDescription: string;
  instruction?: string;
  jurisprudencias?: JurisprudenciaInput[];
  trap?: TrapKind;               // armadilha inserida (se houver)
  expectedRulesIfTrap?: string[]; // regras esperadas como crítica quando há trap
}

export type ValidatorComponent =
  | "EvidenceAnalyzer"
  | "LegalValidator"
  | "AppealValidator"
  | "StructuralValidator"
  | "FinalValidator"
  | "JurisprudenceValidator"
  | "GenericityValidator"
  | "MatrixQualityValidator"
  | "RichnessValidator"
  | "CivilValidator"
  | "ConsumerValidator"
  | "ExecutionValidator"
  | "JefCivelValidator"
  | "Other";

/** Mapeia uma rule de ValidationError para o validator que a emitiu. */
// Mapeamento de área → rótulo legível para relatório HTML
export const AREA_LABELS: Record<LegalArea, string> = {
  RPPS: "RPPS",
  RGPS: "RGPS",
  TRABALHISTA: "Trabalhista",
  CRIMINAL: "Criminal (cautelar)",
  CRIMINAL_MERITO: "Criminal (mérito)",
  CIVEL: "Cível",
  CIVEL_GERAL: "Cível Geral",
  CONSUMIDOR: "Consumidor (CDC)",
  FAZENDA_PUBLICA: "Fazenda Pública",
  EXECUCAO_CUMPRIMENTO: "Execução / Cumprimento",
  JEF_CIVEL: "JEF Cível (legacy)",
  JEF_ESTADUAL: "JEF Estadual (Lei 9.099/95)",
  JEF_FEDERAL: "JEF Federal (Lei 10.259/01)",
};

/** Limite de salários mínimos por jurisdição JEF. */
export const JEF_SM_LIMIT: Record<"JEF_ESTADUAL" | "JEF_FEDERAL", number> = {
  JEF_ESTADUAL: 40,
  JEF_FEDERAL:  60,
};

export function mapRuleToValidator(rule: string): ValidatorComponent {
  if (rule.startsWith("EVIDENCE_")) return "EvidenceAnalyzer";
  if (rule.startsWith("MATRIX_")) return "MatrixQualityValidator";
  if (rule.startsWith("RICHNESS_") || rule === "FINAL_DRAFT_GENERIC_LANGUAGE") return "RichnessValidator";
  if (
    rule === "JUR_MARKER_IN_DRAFT" ||
    rule === "GENERIC_JURISPRUDENCE" ||
    rule === "TRIBUNAL_MISMATCH"
  ) return "JurisprudenceValidator";
  if (
    rule === "INCOMPATIBLE_APPEAL" ||
    rule === "WRONG_SUPERIOR_COURT" ||
    rule === "JEF_JEC_WRONG_APPEAL" ||
    rule === "CRIMINAL_WRONG_APPEAL" ||
    rule === "CRIMINAL_MISSING_APPEAL_REF"
  ) return "AppealValidator";
  if (
    rule === "MISSING_STRUCTURE" ||
    rule === "DESPACHO_WITH_DECISION_LANGUAGE" ||
    rule === "FORBIDDEN_STRUCTURE" ||
    rule === "SENTENCA_MISSING_RELATORIO" ||
    rule === "SENTENCA_MISSING_FUNDAMENTACAO" ||
    rule === "SENTENCA_MISSING_DISPOSITIVO" ||
    rule === "SENTENCA_MISSING_DECISION_VERB" ||
    rule === "SENTENCA_MISSING_APPEAL_REF" ||
    rule === "SENTENCA_RELATORIO_TOO_SHORT" ||
    rule === "SENTENCA_FUNDAMENTACAO_TOO_SHORT" ||
    rule === "SENTENCA_DISPOSITIVO_TOO_SHORT" ||
    rule === "SENTENCA_DISPOSITIVO_VAGUE" ||
    rule === "HC_MISSING_ORDER_VERB" ||
    rule === "HC_WRONG_DISPOSITIVO"
  ) return "StructuralValidator";
  if (
    rule === "RPPS_WRONG_ARTICLE" ||
    rule === "RGPS_WRONG_ARTICLE" ||
    rule === "WRONG_HONORARIOS" ||
    rule === "WRONG_HONORARIOS_CRIMINAL" ||
    rule === "BLOCKED_ARTICLE" ||
    rule === "PROHIBITED_TERM" ||
    rule === "CRIMINAL_WRONG_TERM" ||
    rule === "REQUIRED_FIELD" ||
    rule === "LOW_CONFIDENCE" ||
    rule === "CRIMINAL_ARTICLE_85_CPC" ||
    rule === "CRIMINAL_MISSING_DISPOSITIVO" ||
    rule === "CRIMINAL_WRONG_CIVIL_VERB" ||
    rule === "CRIMINAL_MISSING_DOSIMETRIA" ||
    rule === "CRIMINAL_MISSING_REGIME" ||
    rule === "CRIMINAL_ABSOLVICAO_MISSING_ART386" ||
    rule === "CRIMINAL_PRESCRICAO_MISSING_ART" ||
    rule === "CRIMINAL_DESCLASSIFICACAO_MISSING_TIPO"
  ) return "LegalValidator";
  if (
    rule === "TUTELA_MISSING_ART300" ||
    rule === "TUTELA_MISSING_PERICULUM_MORA" ||
    rule === "SENTENCA_MISSING_HONORARIOS" ||
    rule === "SENTENCA_MISSING_CUSTAS"
  ) return "CivilValidator";
  if (
    rule === "CDC_APPLICATION_MISSING" ||
    rule === "INVERSAO_ONUS_SEM_FUNDAMENTO" ||
    rule === "DANO_MORAL_SEM_ANALISE_CONCRETA" ||
    rule === "REPETICAO_DOBRO_SEM_MAE_FE"
  ) return "ConsumerValidator";
  if (
    rule === "EXECUTION_MISSING_SECTION" ||
    rule === "EXECUTION_MISSING_CPC_BASIS" ||
    rule === "EXECUTION_MISSING_MODALITY" ||
    rule === "EXECUTION_MISSING_OBJECTION" ||
    rule === "EXECUTION_SISBAJUD_MISSING"
  ) return "ExecutionValidator";
  if (rule === "STANCE_MISMATCH_PRE_GENERATION") return "EvidenceAnalyzer";
  if (
    rule === "STANCE_CONTRADICTION_RPPS" ||
    rule === "STANCE_CONTRADICTION_RGPS" ||
    rule === "STANCE_CONTRADICTION_JEF"
  ) return "EvidenceAnalyzer";
  if (rule.startsWith("JEF_")) return "JefCivelValidator";
  return "Other";
}

export interface CaseResult {
  caseId: string;
  area: LegalArea;
  documentType: TipoPeca;
  theme: string;
  themeLabel: string;
  title: string;
  trap?: TrapKind;
  trapDetected?: boolean;        // legacy: true se DETECTED ou AVOIDED
  trapOutcome?: "DETECTED" | "AVOIDED" | "MISSED";
  status: "success" | "error";
  errorMessage?: string;
  mode?: GenerationMode;
  documentStatus?: DocumentStatus;
  score?: number;
  safeMessage?: string;
  validationErrors: { rule: string; message: string; fatal: boolean }[];
  auditErrors: string[];
  draft?: string;
  draftExcerpt?: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
}

// ── Estatísticas ─────────────────────────────────────────────────────────────

export interface AreaStats {
  total: number;
  approved: number;
  withCaveats: number;
  rejected: number;
  avgScore: number;
}

export interface ThemeStats extends AreaStats {
  themeLabel: string;
  area: LegalArea;
  trapTotal: number;
  trapDetected: number;
  trapAvoided: number;
  trapMissed: number;
  topCriticalRules: { rule: string; count: number }[];
}

export interface ValidatorStats {
  fatal: number;
  nonFatal: number;
  topRules: { rule: string; count: number }[];
}

export interface RunSummary {
  generatedAt: string;
  totalCases: number;
  succeeded: number;
  failed: number;
  approved: number;
  approvedWithCaveats: number;
  rejected: number;
  avgScore: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
  byArea: Record<LegalArea, AreaStats>;
  byDocumentType: Record<string, AreaStats>;
  byTheme: Record<string, ThemeStats>;
  byValidator: Record<ValidatorComponent, ValidatorStats>;
  trapStats: {
    totalWithTraps: number;
    detected: number;
    avoided: number;
    missed: number;
    byKind: Record<string, { total: number; detected: number; avoided: number; missed: number }>;
  };
  topCriticalRules: { rule: string; count: number }[];
  results: CaseResult[];
}

// ── Pricing aproximado do gpt-4.1 ────────────────────────────────────────────
export const GPT41_INPUT_USD_PER_1M = 2.0;
export const GPT41_OUTPUT_USD_PER_1M = 8.0;

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * GPT41_INPUT_USD_PER_1M +
    (outputTokens / 1_000_000) * GPT41_OUTPUT_USD_PER_1M
  );
}

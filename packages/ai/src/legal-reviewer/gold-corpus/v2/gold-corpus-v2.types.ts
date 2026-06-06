/**
 * FASE 9.0.8.9 — Gold Corpus Generator V2 — Tipos Base
 *
 * Regras de design:
 * - Sem lógica executável — apenas tipos e interfaces.
 * - DocumentSection substitui blocos de domínio×qualidade do V1.
 * - DegradationMode é a unidade atômica de degradação de qualidade.
 */

/** Seções estruturais de uma peça jurídica. */
export enum DocumentSection {
  CABECALHO = "CABECALHO",
  DOS_FATOS = "DOS_FATOS",
  DO_DIREITO = "DO_DIREITO",
  DAS_PROVAS = "DAS_PROVAS",
  DOS_PEDIDOS = "DOS_PEDIDOS",
  FUNDAMENTACAO = "FUNDAMENTACAO",
  DISPOSITIVO = "DISPOSITIVO",
}

/**
 * Modo de degradação aplicado a um elemento.
 * - WEAKEN: conteúdo presente mas enfraquecido (lightContent).
 * - OMIT: conteúdo de referência omitido (omittedContent).
 * - ABSENT: elemento completamente ausente (absentContent ou "").
 * - CONTRADICT: conteúdo contradiz o esperado (absentContent ?? omittedContent).
 */
export type DegradationMode = "WEAKEN" | "OMIT" | "ABSENT" | "CONTRADICT";

/**
 * Unidade atômica de conteúdo jurídico em V2.
 *
 * Cada elemento existe em quatro versões de fidelidade decrescente.
 * omissionDescription é a fonte canônica de vocabulário para expectedFindings:
 * o texto derivado usa vocabulário que aparece nos demais campos,
 * garantindo alinhamento semântico no benchmark.
 */
export interface DocumentElement {
  /** Identificador único no escopo do documento. */
  id: string;
  /** Seção estrutural onde o elemento aparece. */
  section: DocumentSection;
  /** Versão completa e correta do elemento. */
  fullContent: string;
  /** Versão enfraquecida — presente mas sem substância concreta. */
  lightContent: string;
  /** Versão com omissão explícita — referência ao dado ausente. */
  omittedContent: string;
  /**
   * Versão completamente ausente.
   * null = usar string vazia (elemento deletado sem substituto).
   */
  absentContent?: string | null;
  /**
   * Descrição da omissão que se torna o expectedFinding.
   * Deve usar vocabulário presente em omittedContent / lightContent
   * para garantir que o matching semântico no benchmark funcione.
   */
  omissionDescription: string;
  /** Palavras-chave presentes em fullContent usadas para validação de presença. */
  correctPresenceKeywords: string[];
}

/** Degradação aplicada a um elemento específico em um caso. */
export interface ElementDegradation {
  /** Deve corresponder a DocumentElement.id de algum elemento do documento. */
  elementId: string;
  mode: DegradationMode;
}

/** Mapa completo de degradações para um caso do corpus V2. */
export interface QualityDegradationMap {
  caseId: string;
  quality: string;
  degradations: ElementDegradation[];
}

/**
 * Dados sintéticos determinísticos derivados do caseId.
 * Nunca contém dados reais — gerado exclusivamente por hash do caseId.
 */
export interface CaseSeedData {
  personName: string;
  cpf: string;
  birthDate: string;
  baseDate: string;
  derDate: string;
  protocolNumber: string;
  processNumber: string;
  causeValue: string;
  salaryBase: string;
  city: string;
  courtName: string;
}

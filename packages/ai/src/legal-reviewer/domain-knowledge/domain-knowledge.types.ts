export interface DomainKnowledgePack {
  /** Identificador canônico do domínio (ex.: "RGPS", "TRABALHISTA"). */
  domain: string;

  /** Rótulo legível para exibição. */
  label: string;

  /** Descrição curta opcional. */
  description?: string;

  /** Objetivos típicos do advogado ao elaborar peças neste domínio. */
  reviewerGoals: string[];

  /** Documentos comuns esperados para sustentar a tese. */
  commonDocuments: string[];

  /** Tipos de prova relevantes para o domínio. */
  commonProofs: string[];

  /** Fragilidades comuns que enfraquecem peças neste domínio. */
  commonWeaknesses: string[];

  /** Demonstrações factuais esperadas (quadros, linhas do tempo, etc.). */
  commonDemonstrations: string[];

  /** Cálculos que tipicamente fortalecem as teses do domínio. */
  commonCalculations: string[];

  /** Argumentos contrários previsíveis que podem ser antecipados. */
  commonCounterArguments: string[];

  /** Oportunidades de fortalecimento típicas do domínio. */
  strengtheningOpportunities: string[];

  /**
   * Dicas para extração futura via OCR / Document Intelligence.
   * Não geram findings automaticamente.
   */
  extractionHints?: string[];

  /**
   * Alertas de cautela específicos do domínio — situações que PARECEM problemas
   * mas não são, ou armadilhas comuns de interpretação equivocada.
   * Orientam o revisor a NÃO gerar findings indevidos.
   */
  cautionaryNotes?: string[];

  /**
   * Orientação sobre placeholders típicos deste domínio — quais dados costumam
   * estar pendentes de OCR ou confirmação humana nesta área.
   * Nunca gera findings automaticamente.
   */
  placeholderGuidance?: string;
}

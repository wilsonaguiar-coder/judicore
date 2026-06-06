import type { IntegratedAuditResponse } from "../../audit/audit.service.js";
import type { CorrectionPlan } from "../../audit/types/correction-plan.js";
import type { DomainKnowledgePack } from "../domain-knowledge/domain-knowledge.types.js";

export interface DocumentSummary {
  type:
    | "RG"
    | "CPF"
    | "CNH"
    | "CNIS"
    | "PPP"
    | "LTCAT"
    | "LAUDO"
    | "SENTENCA"
    | "ACORDAO"
    | "PROCURACAO"
    | "CONTRATO"
    | "COMPROVANTE_RESIDENCIA"
    | "OUTRO";
  label: string;
  /** Campos relevantes já extraídos do documento via OCR. */
  keyFields?: string[];
}

export interface ExtractedEntity {
  field: string;
  value: string;
  source: string;
}

export interface AiLegalStrengthReviewRequest {
  draft: string;
  classification: string;
  domain?: string;
  pieceType?: string;
  audit: IntegratedAuditResponse;
  correctionPlan?: CorrectionPlan;
  provider?: "DEEPSEEK" | "OPENAI";
  /** Documentos anexados pelo usuário disponíveis para referência. */
  availableDocuments?: DocumentSummary[];
  /** Entidades extraídas via OCR/pipeline de extração. */
  extractedEntities?: ExtractedEntity[];
  /**
   * Pack de conhecimento do domínio jurídico.
   * Se não fornecido, o serviço buscará automaticamente no DomainKnowledgeRegistry.
   */
  domainKnowledgePack?: DomainKnowledgePack;
}

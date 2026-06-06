import type { AuditReport, AuditItem } from "../audit-report/audit-report.types.js";
import { RULE_TITLES, RULE_SUGGESTIONS } from "../audit-report/audit-report.engine.js";
import type { FeedbackReport, FeedbackItem } from "./types/feedback-report.js";

// Mapa est\u00E1tico de explica\u00E7\u00F5es detalhadas para os c\u00F3digos de regras existentes
const EXPLANATIONS: Record<string, string> = {
  // Estrutura
  MISSING_STRUCTURE: "A pe\u00E7a gerada n\u00E3o cont\u00E9m todas as se\u00E7\u00F5es estruturais m\u00EDnimas exigidas (ex: falta de relat\u00F3rio, fundamenta\u00E7\u00E3o ou dispositivo).",
  DESPACHO_WITH_DECISION_LANGUAGE: "O documento classificado como despacho cont\u00E9m termos que implicam decis\u00E3o de m\u00E9rito, o que contraria sua natureza.",
  FORBIDDEN_STRUCTURE: "A pe\u00E7a apresenta se\u00E7\u00F5es que n\u00E3o s\u00E3o adequadas para o seu tipo processual.",
  UNFILLED_TEMPLATE_PLACEHOLDERS: "O sistema identificou marca\u00E7\u00F5es de template (ex: colchetes) que n\u00E3o foram preenchidas com as informa\u00E7\u00F5es reais do caso.",
  EMPTY_OR_SKELETON_DRAFT: "O texto consiste essencialmente num esqueleto vazio de pe\u00E7a, faltando o conte\u00FAdo jur\u00EDdico material para o caso.",
  
  // R\u00DCD
  UNADDRESSED_MAIN_REQUEST: "O sistema identificou ind\u00EDcios de que um pedido principal formulado na pe\u00E7a n\u00E3o recebeu tratamento correspondente no dispositivo.",
  UNADDRESSED_SUBSIDIARY_REQUEST: "Foi identificado um pedido subsidi\u00E1rio que n\u00E3o foi analisado ou decidido no dispositivo.",
  UNADDRESSED_INJUNCTION_REQUEST: "O dispositivo n\u00E3o menciona deferimento ou indeferimento do pedido de tutela de urg\u00EAncia formulado.",
  RELIEF_NOT_REQUESTED: "A conclus\u00E3o adota provid\u00EAncia que aparentemente n\u00E3o foi solicitada nos pedidos iniciais (risco de decis\u00E3o extra petita).",
  INCOMPLETE_RELIEF: "A concess\u00E3o est\u00E1 incompleta, faltando par\u00E2metros m\u00EDnimos como valores, datas de in\u00EDcio ou prazos.",

  // Contradi\u00E7\u00F5es Jur\u00EDdicas
  PRESCRIPTION_PROCEDENCE_CONTRADICTION: "O sistema identificou poss\u00EDvel incompatibilidade entre a fundamenta\u00E7\u00E3o relacionada \u00E0 prescri\u00E7\u00E3o e a conclus\u00E3o adotada no dispositivo.",
  STANDING_CONTRADICTION: "H\u00E1 uma poss\u00EDvel contradi\u00E7\u00E3o entre reconhecer ilegitimidade de parte na fundamenta\u00E7\u00E3o e, ao mesmo tempo, emitir decis\u00E3o de m\u00E9rito no dispositivo.",
  LACK_OF_EVIDENCE_CONTRADICTION: "A fundamenta\u00E7\u00E3o aponta insufici\u00EAncia probat\u00F3ria, o que em princ\u00EDpio \u00E9 incompat\u00EDvel com a proced\u00EAncia determinada no dispositivo.",
  MORAL_DAMAGE_CONTRADICTION: "A pe\u00E7a afasta o dano moral na fundamenta\u00E7\u00E3o (ex: mero aborrecimento), mas acaba por condenar em dano moral no dispositivo.",
  EMPLOYMENT_RELATION_CONTRADICTION: "Foi identificada contradi\u00E7\u00E3o: a aus\u00EAncia de v\u00EDnculo de emprego \u00E9 justificada, mas o dispositivo parece reconhecer o v\u00EDnculo.",
  RES_JUDICATA_MERITS_CONTRADICTION: "Há menção a litispendência, coisa julgada ou perempção, que impõem a extinção sem resolução do mérito, mas o dispositivo profere sentença com resolução.",
  LACK_OF_INTEREST_PROCEDENCE_CONTRADICTION: "Apesar da declaração de falta de interesse de agir, o dispositivo aparenta conceder a procedência do pedido.",
  NO_DAMAGE_COMPENSATION_CONTRADICTION: "A fundamentação indica a ausência de prejuízo ou dano material, mas a conclusão obriga ao pagamento de indenização.",
  NO_INCAPACITY_BENEFIT_CONTRADICTION: "Mesmo afirmando ausência de incapacidade, o dispositivo aparenta deferir benefício previdenciário atrelado a esse requisito.",
  NO_QUALITY_INSURED_BENEFIT_CONTRADICTION: "Foi reconhecida a ausência da qualidade de segurado, porém, há aparente concessão de benefício da previdência social.",

  // E\u00DCC
  MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION: "O perito atestou a incapacidade de forma expressa, mas o benef\u00EDcio foi negado sem um enfrentamento do laudo favor\u00E1vel.",
  SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION: "A prova t\u00E9cnica do tempo especial (como PPP ou LTCAT) foi considerada v\u00E1lida, mas a atividade especial foi indeferida.",
  PAYMENT_PROOF_CONTRADICTION: "Comprovantes de pagamento est\u00E3o juntados aos autos, contudo o dispositivo determina sua quita\u00E7\u00E3o sem enfrentar tais recibos.",

  // Genericidade
  FINAL_DRAFT_GENERIC_LANGUAGE: "O texto apresenta um estilo excessivamente gen\u00E9rico, sem conectar a tese jur\u00EDdica com os fatos particulares do processo.",
  FINAL_DRAFT_WEAK_ARGUMENTATION: "O desenvolvimento das teses \u00E9 insuficiente ou excessivamente superficial.",
};

// Fallback logic
function getExplanation(code: string): string {
  if (EXPLANATIONS[code]) {
    return EXPLANATIONS[code];
  }
  
  if (code.includes("COVERAGE") || code.includes("OMISSION")) {
    return "A \u00E1nalise detectou a poss\u00EDvel omiss\u00E3o de um t\u00F3pico essencial que normalmente deve constar em pe\u00E7as desta natureza.";
  }
  
  if (code.includes("CONTRADICTION")) {
    return "Foi detectada uma contradi\u00E7\u00E3o na linha de argumenta\u00E7\u00E3o interna da pe\u00E7a.";
  }
  
  if (code.includes("WRONG_APPEAL") || code.includes("INCOMPATIBLE_APPEAL")) {
    return "A pe\u00E7a indica o uso de um recurso jur\u00EDdico que parece n\u00E3o ser adequado \u00E0 via processual ou inst\u00E2ncia requerida.";
  }
  
  return "O sistema identificou um alerta ou aviso autom\u00E1tico associado \u00E0 consist\u00EAncia e viabilidade jur\u00EDdica da pe\u00E7a.";
}

export class FeedbackReportService {
  /**
   * Converte o AuditReport t\u00E9cnico no formato amig\u00E1vel FeedbackReport.
   */
  public generateFeedbackReport(auditReport: AuditReport): FeedbackReport {
    // 1. Converter problemas fatais em CriticalFindings
    const criticalFindings = auditReport.problemasFatais.map((item) => this.mapFeedbackItem(item));

    // 2. Converter problemas n\u00E3o-fatais em Warnings
    const warnings = auditReport.problemasNaoFatais.map((item) => this.mapFeedbackItem(item));

    // 3. Status
    const statusMap: Record<string, string> = {
      VIAVEL: "APROVADA",
      ATENCAO: "APROVADA_COM_RESSALVAS",
      RISCO_ELEVADO: "REPROVADA",
      CRITICA: "REPROVADA",
    };
    const status = statusMap[auditReport.classificacaoFinal] ?? "REPROVADA";

    // 4. Summary determin\u00EDstico
    let summary = "A pe\u00E7a n\u00E3o apresentou inconsist\u00EAncias relevantes segundo os validadores atualmente ativos.";
    if (criticalFindings.length > 0) {
      summary = "Foram identificadas inconsist\u00EAncias relevantes que podem comprometer a seguran\u00E7a jur\u00EDdica da pe\u00E7a.";
    } else if (warnings.length > 0) {
      summary = "Foram identificados pontos que merecem revis\u00E3o, mas que n\u00E3o comprometem automaticamente a viabilidade jur\u00EDdica da pe\u00E7a.";
    }

    return {
      status,
      score: auditReport.qualidadeTecnica,
      summary,
      criticalFindings,
      warnings,
      strengths: auditReport.pontosFortes.map(s => s.titulo),
    };
  }

  private mapFeedbackItem(item: AuditItem): FeedbackItem {
    const code = item.regra ?? "GENERAL_WARNING";
    
    // Tentamos resgatar de RULE_TITLES caso o item.titulo original venha mascarado com prefixos ou n\u00E3o exista
    const title = RULE_TITLES[code] ?? item.titulo;
    
    const explanation = getExplanation(code);
    const suggestion = RULE_SUGGESTIONS[code];

    const result: FeedbackItem = {
      code,
      title,
      explanation,
    };
    if (suggestion !== undefined) {
      result.suggestion = suggestion;
    }

    return result;
  }
}

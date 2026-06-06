import type { RevisionTask } from "../revision/guided-revision.types.js";
import type { AssistedRevisionRequest, AssistedRevisionSuggestion } from "./assisted-revision.types.js";
import type { LLMRevisionAdapter } from "./llm-revision-adapter.js";

export class AssistedRevisionService {
  private adapter?: LLMRevisionAdapter | undefined;

  constructor(adapter?: LLMRevisionAdapter) {
    this.adapter = adapter;
  }
  /**
   * Prepara payload seguro para futura IA.
   * Nesta fase, N\u00C3O chamar IA real.
   */
  public buildSuggestionRequest(draft: string, task: RevisionTask, context?: string): AssistedRevisionRequest {
    return {
      draft,
      task,
      context,
    };
  }

  /**
   * Tenta usar o adapter, se dispon\u00EDvel, ou usa fallback determin\u00EDstico
   */
  public async suggestWithAdapter(request: AssistedRevisionRequest): Promise<AssistedRevisionSuggestion> {
    if (this.adapter) {
      try {
        return await this.adapter.suggestRevision(request);
      } catch (error) {
        // Fallback silencioso em caso de falha do provedor
        return this.createDeterministicSuggestion(request.task);
      }
    }
    return this.createDeterministicSuggestion(request.task);
  }

  /**
   * Gera sugest\u00E3o determin\u00EDstica baseada no code da tarefa.
   */
  public createDeterministicSuggestion(task: RevisionTask): AssistedRevisionSuggestion {
    const code = task.code;
    let suggestion = "Revise o trecho indicado, conferindo a coer\u00EAncia entre fundamenta\u00E7\u00E3o, pedidos, provas e dispositivo.";
    let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";

    // Mapeamento por Code
    if (code.includes("CONTRADICTION") || code.includes("FATAL") || code.includes("LACK_OF_EVIDENCE") || code.includes("EVIDENCE_INCAPACITY")) {
      riskLevel = "HIGH";
    } else if (code.includes("UNADDRESSED_") || code === "MISSING_ESSENTIAL_TOPIC" || code === "INCOMPLETE_RELIEF") {
      riskLevel = "MEDIUM";
    }

    switch (code) {
      case "UNADDRESSED_MAIN_REQUEST":
        suggestion = "Revise o dispositivo para verificar se todos os pedidos principais foram enfrentados de forma expressa.";
        break;
      case "UNADDRESSED_SUBSIDIARY_REQUEST":
        suggestion = "O pedido principal foi negado ou prejudicado, mas n\u00E3o houve an\u00E1lise do pedido subsidi\u00E1rio. Inclua fundamenta\u00E7\u00E3o e decis\u00E3o sobre ele.";
        break;
      case "UNADDRESSED_INJUNCTION_REQUEST":
        suggestion = "H\u00E1 pedido de tutela de urg\u00EAncia (liminar) n\u00E3o analisado. Confirme ou revogue a tutela no dispositivo.";
        break;
      case "PRESCRIPTION_PROCEDENCE_CONTRADICTION":
        suggestion = "Foi reconhecida prescri\u00E7\u00E3o total na fundamenta\u00E7\u00E3o, mas o m\u00E9rito foi julgado procedente. Retifique o dispositivo para extin\u00E7\u00E3o com resolu\u00E7\u00E3o de m\u00E9rito (art. 487, II, CPC).";
        break;
      case "LACK_OF_EVIDENCE_CONTRADICTION":
        suggestion = "Foi atestada aus\u00EAncia de provas na fundamenta\u00E7\u00E3o, mas o pedido foi julgado procedente. Se h\u00E1 confiss\u00E3o ou presun\u00E7\u00E3o, explicite; caso contr\u00E1rio, o pedido \u00E9 improcedente.";
        break;
      case "MORAL_DAMAGE_CONTRADICTION":
        suggestion = "A fundamenta\u00E7\u00E3o afasta o dano moral (mero aborrecimento), mas h\u00E1 condena\u00E7\u00E3o em pec\u00FAnia. Retifique a contradi\u00E7\u00E3o.";
        break;
      case "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION":
        suggestion = "Per\u00EDcia atesta capacidade laboral, mas benef\u00EDcio por incapacidade foi concedido. Se o juiz afastou o laudo, deve justificar expressamente por outros elementos de prova.";
        break;
      case "SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION":
        suggestion = "PPP/LTCAT afasta exposi\u00E7\u00E3o a agentes nocivos, mas o tempo especial foi reconhecido sem justificativa que sobrepuje a prova t\u00E9cnica. Harmonize a conclus\u00E3o.";
        break;
      case "PAYMENT_PROOF_CONTRADICTION":
        suggestion = "H\u00E1 prova documental de quita\u00E7\u00E3o citada, mas a senten\u00E7a condena ao pagamento. Revise a an\u00E1lise da prova ou o dispositivo.";
        break;
      case "MISSING_ESSENTIAL_TOPIC":
        suggestion = "Falta t\u00F3pico essencial pr\u00E9-requisito para julgamento deste m\u00E9rito. Insira a fundamenta\u00E7\u00E3o faltante.";
        break;
      case "INCOMPLETE_RELIEF":
        suggestion = "O dispositivo n\u00E3o esgota o objeto do lit\u00EDgio. Verifique cap\u00EDtulos pendentes de provimento jurisdicional.";
        break;
    }

    return {
      taskId: task.id,
      code: task.code,
      instruction: task.instruction,
      suggestion,
      riskLevel,
      requiresHumanReview: true,
    };
  }
}

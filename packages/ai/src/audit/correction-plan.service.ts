import type { AuditReport, AuditItem } from "../audit-report/audit-report.types.js";
import type { CorrectionPlan, CorrectionItem } from "./types/correction-plan.js";

export class CorrectionPlanService {
  public generateCorrectionPlan(auditReport: AuditReport): CorrectionPlan {
    const items: CorrectionItem[] = [];

    // Avaliar apenas problemasFatais e problemasNaoFatais
    const allErrors = [
      ...auditReport.problemasFatais,
      ...auditReport.problemasNaoFatais,
    ];

    for (const item of allErrors) {
      items.push(this.mapToCorrectionItem(item));
    }

    // Ordenar: HIGH -> MEDIUM -> LOW
    const priorityOrder = { HIGH: 1, MEDIUM: 2, LOW: 3 };
    items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const statusMap: Record<string, string> = {
      VIAVEL: "APROVADA",
      ATENCAO: "APROVADA_COM_RESSALVAS",
      RISCO_ELEVADO: "REPROVADA",
      CRITICA: "REPROVADA",
    };
    const status = statusMap[auditReport.classificacaoFinal] ?? "REPROVADA";

    return {
      status,
      items,
    };
  }

  private mapToCorrectionItem(item: AuditItem): CorrectionItem {
    const code = item.regra ?? "UNKNOWN";
    
    // Mapeamento de Priority
    let priority: "HIGH" | "MEDIUM" | "LOW" = "LOW";
    if (code.includes("CONTRADICTION") || code.includes("EVIDENCE") || code.includes("NULLITY")) {
      priority = "HIGH";
    } else if (code.includes("REQUEST") || code.includes("COVERAGE") || code.includes("OMISSION") || code.includes("MISSING") || code.includes("EMPTY") || code.includes("UNFILLED")) {
      priority = "MEDIUM";
    }

    if (item.severidade === "FATAL") {
      priority = "HIGH"; // Elevates fatal errors to HIGH
    }

    // Mapeamento de Area
    let area = "GERAL";
    if (code.includes("EVIDENCE") || code.includes("PROOF")) {
      area = "PROVAS";
    } else if (code.includes("REQUEST")) {
      area = "PEDIDOS";
    } else if (code.includes("CONTRADICTION")) {
      area = "FUNDAMENTAÇÃO/DISPOSITIVO";
    } else if (code.includes("STRUCTURE") || code.includes("EMPTY") || code.includes("UNFILLED") || code.includes("TEMPLATE")) {
      area = "ESTRUTURA";
    } else if (code.includes("REQUIREMENT") || code.includes("LEGAL") || code.includes("ARTICLE")) {
      area = "REQUISITOS_LEGAIS";
    }

    // Mapeamento de Instruction
    let instruction = "Revisar as incoerências apontadas e ajustar a peça de acordo com o caso real.";

    // Exemplos estáticos baseados no objetivo funcional
    if (code === "UNADDRESSED_MAIN_REQUEST") {
      priority = "HIGH";
      area = "DISPOSITIVO";
      instruction = "Verificar se todos os pedidos principais formulados na peça foram enfrentados expressamente no dispositivo.";
    } else if (code === "UNADDRESSED_SUBSIDIARY_REQUEST") {
      priority = "MEDIUM";
      area = "DISPOSITIVO";
      instruction = "Verificar se os pedidos subsidiários receberam manifestação específica.";
    } else if (code === "PRESCRIPTION_PROCEDENCE_CONTRADICTION") {
      priority = "HIGH";
      area = "FUNDAMENTAÇÃO/DISPOSITIVO";
      instruction = "Revisar a coerência entre a fundamentação relativa à prescrição e a conclusão adotada.";
    } else if (code === "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION") {
      priority = "HIGH";
      area = "PROVAS";
      instruction = "Conferir a compatibilidade entre o laudo médico e a conclusão adotada na peça.";
    } else if (code === "UNFILLED_TEMPLATE_PLACEHOLDERS") {
      priority = "HIGH";
      area = "ESTRUTURA";
      instruction = "Substituir todos os campos de template (ex: [NOME]) pelos dados reais correspondentes.";
    } else if (code === "EMPTY_OR_SKELETON_DRAFT") {
      priority = "HIGH";
      area = "ESTRUTURA";
      instruction = "Completar a peça adicionando todo o conteúdo material do caso e fundamentos pertinentes.";
    } else if (code.includes("FINAL_DRAFT_GENERIC_LANGUAGE")) {
      priority = "MEDIUM";
      area = "FUNDAMENTAÇÃO";
      instruction = "Substituir passagens muito abstratas por referências diretas e argumentos específicos aos fatos narrados na inicial.";
    } else if (code.includes("CONTRADICTION")) {
      instruction = "Analisar e retificar o contraste argumentativo detectado entre duas ou mais seções da peça.";
    } else if (code.includes("COVERAGE")) {
      instruction = "Assegurar que os tópicos mínimos essenciais a este tipo de causa estejam abordados.";
    }

    return {
      code,
      priority,
      area,
      instruction,
    };
  }
}

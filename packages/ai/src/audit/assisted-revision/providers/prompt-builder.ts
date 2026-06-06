import type { AssistedRevisionRequest } from "../assisted-revision.types.js";

export function buildRevisionPrompt(request: AssistedRevisionRequest): string {
  const { task, context } = request;
  return `Objetivo: Sugerir a\u00E7\u00E3o de revis\u00E3o jur\u00EDdica com base em um relat\u00F3rio de auditoria.

C\u00F3digo da Tarefa: ${task.code}
Instru\u00E7\u00E3o Original: ${task.instruction}
Contexto ou Trecho Relevante: ${context ?? "N/A"}

Voc\u00EA \u00E9 um assistente de revis\u00E3o jur\u00EDdica do JudiAudit.
Sua tarefa \u00E9 produzir uma sugest\u00E3o t\u00E9cnica, de no m\u00E1ximo 500 palavras, em texto simples, instruindo o autor do documento sobre como sanar a falha apontada.

PROIBI\u00C7\u00D5ES ABSOLUTAS:
- N\u00C3O escreva uma nova pe\u00E7a.
- N\u00C3O substitua integralmente o texto.
- N\u00C3O crie fatos novos.
- N\u00C3O invente provas.
- N\u00C3O altere os pedidos originais.
- N\u00C3O altere a conclus\u00E3o do m\u00E9rito.
- N\u00C3O cite artigos de lei, legisla\u00E7\u00E3o, s\u00FAmulas, precedentes ou jurisprud\u00EAncia que n\u00E3o tenham sido fornecidos no contexto da tarefa.

EXCE\u00C7\u00C3O NORMATIVA:
Caso seja necess\u00E1ria refer\u00EAncia normativa, limite-se exclusivamente ao material recebido.

Responda APENAS com o texto da sugest\u00E3o de revis\u00E3o, sem formata\u00E7\u00E3o markdown ou introdu\u00E7\u00F5es.`;
}

export function determineRiskLevel(code: string): "LOW" | "MEDIUM" | "HIGH" {
  if (code.includes("CONTRADICTION") || code.includes("FATAL") || code.includes("LACK_OF_EVIDENCE") || code.includes("EVIDENCE_INCAPACITY")) {
    return "HIGH";
  }
  if (code.includes("UNADDRESSED_") || code === "MISSING_ESSENTIAL_TOPIC" || code === "INCOMPLETE_RELIEF") {
    return "MEDIUM";
  }
  return "LOW";
}

import type { AssistedRevisionRequest, AssistedRevisionSuggestion } from "./assisted-revision.types.js";
import type { LLMRevisionAdapter } from "./llm-revision-adapter.js";

export class MockLLMRevisionAdapter implements LLMRevisionAdapter {
  public async suggestRevision(request: AssistedRevisionRequest): Promise<AssistedRevisionSuggestion> {
    const task = request.task;
    
    // Comportamento mock, retornando algo determin\u00EDstico sem chamar rede nem IA.
    return {
      taskId: task.id,
      code: task.code,
      instruction: task.instruction,
      suggestion: `[MOCK LLM] Sugest\u00E3o gerada offline para a tarefa ${task.code}. Draft recebido com sucesso.`,
      riskLevel: "LOW",
      requiresHumanReview: true,
    };
  }
}

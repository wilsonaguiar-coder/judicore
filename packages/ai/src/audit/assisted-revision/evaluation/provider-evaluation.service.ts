import type { LLMRevisionAdapter } from "../llm-revision-adapter.js";
import type { ProviderEvaluationCase, ProviderEvaluationResult } from "./provider-evaluation.types.js";
import type { AssistedRevisionRequest } from "../assisted-revision.types.js";
import type { RevisionTask } from "../../revision/guided-revision.types.js";

export class ProviderEvaluationService {
  constructor(private adapters: Record<string, LLMRevisionAdapter>) {}

  public async evaluate(cases: ProviderEvaluationCase[]): Promise<ProviderEvaluationResult[]> {
    const results: ProviderEvaluationResult[] = [];

    for (const testCase of cases) {
      for (const [providerName, adapter] of Object.entries(this.adapters)) {
        // Build mock task
        const task: RevisionTask = {
          id: testCase.id,
          code: testCase.taskCode,
          priority: "HIGH",
          area: "M\u00C9RITO",
          instruction: testCase.instruction,
          completed: false,
        };

        const request: AssistedRevisionRequest = {
          draft: "--- DRAFT OMITIDO (EVALUATION HARNESS) ---",
          task,
          context: testCase.context,
        };

        try {
          const start = Date.now();
          const response = await adapter.suggestRevision(request);
          const elapsed = Date.now() - start;

          results.push({
            caseId: testCase.id,
            provider: providerName,
            model: "unknown-via-adapter", // Can be enhanced if adapter exposes config
            suggestion: response.suggestion,
            approved: false, // Default pending human evaluation
            notes: `Tempo de resposta: ${elapsed}ms`,
          });
        } catch (err: any) {
          results.push({
            caseId: testCase.id,
            provider: providerName,
            model: "unknown-via-adapter",
            suggestion: `ERRO DE EXECU\u00C7\u00C3O: ${err.message}`,
            approved: false,
            notes: "Falha de rede ou de API.",
          });
        }
      }
    }

    return results;
  }
}

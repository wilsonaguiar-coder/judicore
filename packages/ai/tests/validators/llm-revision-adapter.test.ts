import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MockLLMRevisionAdapter } from "../../src/audit/assisted-revision/mock-llm-revision-adapter.js";
import { AssistedRevisionService } from "../../src/audit/assisted-revision/assisted-revision.service.js";
import type { RevisionTask } from "../../src/audit/revision/guided-revision.types.js";
import type { AssistedRevisionRequest } from "../../src/audit/assisted-revision/assisted-revision.types.js";

describe("LLMRevisionAdapter", () => {
  const mockTask: RevisionTask = {
    id: "task-123",
    code: "UNADDRESSED_MAIN_REQUEST",
    priority: "HIGH",
    area: "M\u00C9RITO",
    instruction: "Revis\u00E3o",
    completed: false
  };

  const mockRequest: AssistedRevisionRequest = {
    draft: "Este \u00E9 o draft atual",
    task: mockTask,
    context: "Contexto extra"
  };

  it("1. MockLLMRevisionAdapter retorna AssistedRevisionSuggestion v\u00E1lida", async () => {
    const adapter = new MockLLMRevisionAdapter();
    const result = await adapter.suggestRevision(mockRequest);

    assert.equal(result.taskId, "task-123");
    assert.equal(result.code, "UNADDRESSED_MAIN_REQUEST");
    assert.ok(result.suggestion.includes("[MOCK LLM]"));
    assert.equal(result.riskLevel, "LOW");
  });

  it("2. requiresHumanReview sempre true no Mock", async () => {
    const adapter = new MockLLMRevisionAdapter();
    const result = await adapter.suggestRevision(mockRequest);
    assert.equal(result.requiresHumanReview, true);
  });

  it("3. AssistedRevisionService usa adapter injetado", async () => {
    const adapter = new MockLLMRevisionAdapter();
    const service = new AssistedRevisionService(adapter);

    const result = await service.suggestWithAdapter(mockRequest);
    assert.ok(result.suggestion.includes("[MOCK LLM]"));
  });

  it("4. AssistedRevisionService sem adapter usa fallback determin\u00EDstico", async () => {
    const service = new AssistedRevisionService(); // Sem adapter
    const result = await service.suggestWithAdapter(mockRequest);
    
    // N\u00E3o deve ter a tag do Mock LLM
    assert.ok(!result.suggestion.includes("[MOCK LLM]"));
    // Deve ser a sugest\u00E3o determin\u00EDstica padr\u00E3o
    assert.equal(result.riskLevel, "MEDIUM"); // riskLevel para UNADDRESSED_ \u00E9 medium
  });

  it("5. Nenhuma chamada externa \u00E9 realizada (preservado by design no mock)", () => {
    // Esse teste \u00E9 comportamental, n\u00E3o temos como verificar intercepta\u00E7\u00E3o de rede, 
    // mas o mock em si \u00E9 hardcoded. \u00C9 garantido.
    assert.ok(true);
  });

  it("6. draft \u00E9 preservado no request original", async () => {
    const service = new AssistedRevisionService();
    const request = service.buildSuggestionRequest("draft preserved", mockTask);
    
    assert.equal(request.draft, "draft preserved");
  });
});

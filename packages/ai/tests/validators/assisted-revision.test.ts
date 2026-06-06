import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AssistedRevisionService } from "../../src/audit/assisted-revision/assisted-revision.service.js";
import type { RevisionTask } from "../../src/audit/revision/guided-revision.types.js";

describe("AssistedRevisionService", () => {
  const service = new AssistedRevisionService();

  const mockTask: RevisionTask = {
    id: "task-1",
    code: "UNADDRESSED_MAIN_REQUEST",
    priority: "HIGH",
    area: "M\u00C9RITO",
    instruction: "Verifique o pedido principal",
    completed: false
  };

  it("1. Gera sugest\u00E3o determin\u00EDstica para UNADDRESSED_MAIN_REQUEST", () => {
    const suggestion = service.createDeterministicSuggestion(mockTask);
    
    assert.equal(suggestion.taskId, "task-1");
    assert.equal(suggestion.code, "UNADDRESSED_MAIN_REQUEST");
    assert.ok(suggestion.suggestion.includes("Revise o dispositivo"));
    assert.equal(suggestion.riskLevel, "MEDIUM"); // risk level \u00E9 baseado no c\u00F3digo, que inclui UNADDRESSED_ -> MEDIUM
    assert.equal(suggestion.requiresHumanReview, true);
  });

  it("2. Gera sugest\u00E3o determin\u00EDstica para MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION", () => {
    const task: RevisionTask = { ...mockTask, code: "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION" };
    const suggestion = service.createDeterministicSuggestion(task);
    
    assert.ok(suggestion.suggestion.includes("Per\u00EDcia atesta capacidade laboral"));
    assert.equal(suggestion.riskLevel, "HIGH");
  });

  it("3. C\u00F3digo desconhecido usa fallback gen\u00E9rico", () => {
    const task: RevisionTask = { ...mockTask, code: "UNKNOWN_BLABLA" };
    const suggestion = service.createDeterministicSuggestion(task);
    
    assert.equal(suggestion.suggestion, "Revise o trecho indicado, conferindo a coer\u00EAncia entre fundamenta\u00E7\u00E3o, pedidos, provas e dispositivo.");
    assert.equal(suggestion.riskLevel, "LOW");
  });

  it("4. riskLevel HIGH para contradi\u00E7\u00E3o", () => {
    const task: RevisionTask = { ...mockTask, code: "SOMETHING_CONTRADICTION" };
    const suggestion = service.createDeterministicSuggestion(task);
    
    assert.equal(suggestion.riskLevel, "HIGH");
  });

  it("5. riskLevel MEDIUM para pedido n\u00E3o enfrentado", () => {
    const task: RevisionTask = { ...mockTask, code: "UNADDRESSED_FOO" };
    const suggestion = service.createDeterministicSuggestion(task);
    
    assert.equal(suggestion.riskLevel, "MEDIUM");
  });

  it("6. requiresHumanReview sempre true", () => {
    const suggestion = service.createDeterministicSuggestion(mockTask);
    assert.equal(suggestion.requiresHumanReview, true);
  });

  it("7. buildSuggestionRequest preserva draft, task e context", () => {
    const request = service.buildSuggestionRequest("texto do rascunho", mockTask, "contexto extra");
    
    assert.equal(request.draft, "texto do rascunho");
    assert.deepEqual(request.task, mockTask);
    assert.equal(request.context, "contexto extra");
  });
});

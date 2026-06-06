import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { OpenAIRevisionAdapter } from "../../src/audit/assisted-revision/providers/openai-revision-adapter.js";
import { ClaudeRevisionAdapter } from "../../src/audit/assisted-revision/providers/claude-revision-adapter.js";
import { DeepSeekRevisionAdapter } from "../../src/audit/assisted-revision/providers/deepseek-revision-adapter.js";
import { GeminiRevisionAdapter } from "../../src/audit/assisted-revision/providers/gemini-revision-adapter.js";
import { AssistedRevisionService } from "../../src/audit/assisted-revision/assisted-revision.service.js";
import type { RevisionTask } from "../../src/audit/revision/guided-revision.types.js";
import type { AssistedRevisionRequest } from "../../src/audit/assisted-revision/assisted-revision.types.js";

describe("AssistedRevision Providers", () => {
  const mockTask: RevisionTask = {
    id: "task-999",
    code: "UNADDRESSED_MAIN_REQUEST",
    priority: "HIGH",
    area: "M\u00C9RITO",
    instruction: "Revise o dispositivo",
    completed: false
  };

  const mockRequest: AssistedRevisionRequest = {
    draft: "Draft texto",
    task: mockTask,
    context: "Contexto"
  };

  afterEach(() => {
    mock.restoreAll();
  });

  it("1. OpenAIRevisionAdapter implementa interface e converte resposta", async () => {
    mock.method(global, "fetch", async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Sugest\u00E3o mockada OpenAI." } }]
        })
      };
    });

    const adapter = new OpenAIRevisionAdapter("fake-key");
    const result = await adapter.suggestRevision(mockRequest);

    assert.equal(result.suggestion, "Sugest\u00E3o mockada OpenAI.");
    assert.equal(result.requiresHumanReview, true);
    assert.equal(result.riskLevel, "MEDIUM"); // Risk level determin\u00EDstico do code
  });

  it("1. ClaudeRevisionAdapter implementa interface e converte resposta", async () => {
    mock.method(global, "fetch", async () => {
      return {
        ok: true,
        json: async () => ({
          content: [{ text: "Sugest\u00E3o mockada Claude." }]
        })
      };
    });

    const adapter = new ClaudeRevisionAdapter("fake-key");
    const result = await adapter.suggestRevision(mockRequest);

    assert.equal(result.suggestion, "Sugest\u00E3o mockada Claude.");
    assert.equal(result.requiresHumanReview, true);
  });

  it("1. DeepSeekRevisionAdapter implementa interface e converte resposta", async () => {
    mock.method(global, "fetch", async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Sugest\u00E3o mockada DeepSeek." } }]
        })
      };
    });

    const adapter = new DeepSeekRevisionAdapter("fake-key");
    const result = await adapter.suggestRevision(mockRequest);

    assert.equal(result.suggestion, "Sugest\u00E3o mockada DeepSeek.");
    assert.equal(result.requiresHumanReview, true);
  });

  it("1. GeminiRevisionAdapter implementa interface e converte resposta corretamente", async () => {
    mock.method(global, "fetch", async () => {
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "Sugest\u00E3o mockada Gemini." }] } }]
        })
      };
    });

    const adapter = new GeminiRevisionAdapter("fake-key");
    const result = await adapter.suggestRevision(mockRequest);

    assert.equal(result.suggestion, "Sugest\u00E3o mockada Gemini.");
    assert.equal(result.requiresHumanReview, true);
  });

  it("3. Gemini fallback funciona em timeout/erro", async () => {
    mock.method(global, "fetch", async () => {
      return {
        ok: false,
        status: 504,
        statusText: "Gateway Timeout"
      };
    });

    const adapter = new GeminiRevisionAdapter("fake-key");
    const service = new AssistedRevisionService(adapter);

    const result = await service.suggestWithAdapter(mockRequest);
    
    assert.ok(result.suggestion.includes("Revise o dispositivo para verificar se todos os pedidos"));
    assert.equal(result.requiresHumanReview, true);
  });

  it("2. Fallback funciona se o provider falhar (AssistedRevisionService)", async () => {
    mock.method(global, "fetch", async () => {
      return {
        ok: false,
        status: 500,
        statusText: "Internal Server Error"
      };
    });

    const adapter = new OpenAIRevisionAdapter("fake-key");
    const service = new AssistedRevisionService(adapter);

    const result = await service.suggestWithAdapter(mockRequest);
    
    // N\u00E3o deve lan\u00E7ar exce\u00E7\u00E3o, deve usar fallback determin\u00EDstico
    assert.ok(result.suggestion.includes("Revise o dispositivo para verificar se todos os pedidos"));
    assert.equal(result.requiresHumanReview, true);
  });

  it("5. Prompt n\u00E3o recebe documento completo, apenas instru\u00E7\u00F5es", async () => {
    let capturedBody: any;
    mock.method(global, "fetch", async (url: any, options: any) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Ok" } }]
        })
      };
    });

    const adapter = new OpenAIRevisionAdapter("fake-key");
    await adapter.suggestRevision(mockRequest);

    const promptText = capturedBody.messages[1].content;
    
    // N\u00E3o tem o draft no prompt
    assert.ok(!promptText.includes("Draft texto"));
    assert.ok(promptText.includes(mockTask.code));
    assert.ok(promptText.includes(mockTask.instruction));
    assert.ok(promptText.includes("N\u00C3O escreva uma nova pe\u00E7a"));
  });

  it("6. Prompt cont\u00E9m guardrails normativos e proibitivos", async () => {
    let capturedBody: any;
    mock.method(global, "fetch", async (url: any, options: any) => {
      capturedBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ choices: [{ message: { content: "Ok" } }] }) };
    });

    const adapter = new OpenAIRevisionAdapter("fake-key");
    await adapter.suggestRevision(mockRequest);

    const promptText = capturedBody.messages[1].content;
    
    // Regras antigas
    assert.ok(promptText.includes("N\u00C3O crie fatos novos"));
    assert.ok(promptText.includes("N\u00C3O invente provas"));
    assert.ok(promptText.includes("N\u00C3O altere os pedidos originais"));
    assert.ok(promptText.includes("N\u00C3O altere a conclus\u00E3o do m\u00E9rito"));
    
    // Novas regras normativas
    assert.ok(promptText.includes("N\u00C3O cite artigos de lei, legisla\u00E7\u00E3o, s\u00FAmulas, precedentes ou jurisprud\u00EAncia"));
    assert.ok(promptText.includes("Caso seja necess\u00E1ria refer\u00EAncia normativa, limite-se exclusivamente ao material recebido"));
  });
});

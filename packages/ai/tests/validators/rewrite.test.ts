import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { RewriteService } from "../../src/audit/rewrite/rewrite.service.js";
import type { RewriteRequest } from "../../src/audit/rewrite/rewrite.types.js";

describe("Experimental Auto Rewrite", () => {
  const mockRequest: RewriteRequest = {
    draft: "Este \u00E9 o draft original.",
    task: {
      id: "task-123",
      code: "UNADDRESSED_MAIN_REQUEST",
      priority: "HIGH",
      area: "M\u00C9RITO",
      instruction: "Instru\u00E7\u00E3o",
      completed: false
    },
    suggestion: "Adicione o trecho faltante no m\u00E9rito."
  };

  afterEach(() => {
    mock.restoreAll();
  });

  it("1, 2, 3, 4, 5. gera RewriteResult preservando estado imut\u00E1vel", async () => {
    mock.method(global, "fetch", async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Este \u00E9 o draft reescrito." } }]
      })
    }));

    const service = new RewriteService("fake-ds", "fake-oa");
    const result = await service.generateRewrittenDraft(mockRequest);

    // 1. gera RewriteResult
    assert.ok(result);
    // 2. preserva originalDraft
    assert.equal(result.originalDraft, "Este \u00E9 o draft original.");
    assert.equal(result.rewrittenDraft, "Este \u00E9 o draft reescrito.");
    // 3. requiresHumanReview true
    assert.equal(result.requiresHumanReview, true);
    // 4. n\u00E3o modifica task
    assert.equal(result.taskId, "task-123");
    // 5. n\u00E3o modifica suggestion (input continua intacto)
    assert.equal(mockRequest.suggestion, "Adicione o trecho faltante no m\u00E9rito.");
    
    assert.equal(result.provider, "DEEPSEEK");
  });

  it("6. fallback funciona (DeepSeek falha -> OpenAI assume)", async () => {
    let callCount = 0;
    mock.method(global, "fetch", async (url: any) => {
      callCount++;
      if (url.includes("deepseek")) {
        return { ok: false, status: 500 };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Draft via OpenAI fallback." } }]
        })
      };
    });

    const service = new RewriteService("fake-ds", "fake-oa");
    const result = await service.generateRewrittenDraft(mockRequest);

    assert.equal(callCount, 2);
    assert.equal(result.rewrittenDraft, "Draft via OpenAI fallback.");
    assert.equal(result.provider, "OPENAI");
  });

  it("7. sem provider -> erro controlado", async () => {
    mock.method(global, "fetch", async () => ({ ok: false, status: 500 }));

    const service = new RewriteService("fake-ds", "fake-oa");
    
    await assert.rejects(
      () => service.generateRewrittenDraft(mockRequest),
      /Erro controlado/
    );
  });

  it("8. injeta prompt corretamente com permiss\u00F5es e proibi\u00E7\u00F5es", async () => {
    let capturedBody: any;
    mock.method(global, "fetch", async (url: any, options: any) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "Ok" } }] })
      };
    });

    const service = new RewriteService("fake-ds", "fake-oa");
    await service.generateRewrittenDraft(mockRequest);

    const prompt = capturedBody.messages[1].content;
    
    // Proibido
    assert.ok(prompt.includes("Mudar fatos"));
    assert.ok(prompt.includes("Mudar resultado do julgamento"));
    // Permitido
    assert.ok(prompt.includes("Inserir trecho faltante"));
    // Cont\u00E9m o draft e task
    assert.ok(prompt.includes("Este \u00E9 o draft original."));
    assert.ok(prompt.includes("UNADDRESSED_MAIN_REQUEST"));
  });
});

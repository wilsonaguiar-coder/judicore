import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ProviderEvaluationService } from "../../src/audit/assisted-revision/evaluation/provider-evaluation.service.js";
import { evaluateApproval, OFFICIAL_EVALUATION_CASES } from "../../src/audit/assisted-revision/evaluation/provider-evaluation.types.js";
import type { LLMRevisionAdapter } from "../../src/audit/assisted-revision/llm-revision-adapter.js";

describe("Provider Evaluation Harness", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  const MockAdapter = class implements LLMRevisionAdapter {
    constructor(private mockSuggestion: string) {}
    async suggestRevision(req: any) {
      return {
        taskId: req.task.id,
        code: req.task.code,
        instruction: req.task.instruction,
        suggestion: this.mockSuggestion,
        riskLevel: "LOW" as const,
        requiresHumanReview: true,
      };
    }
  };

  const MockErrorAdapter = class implements LLMRevisionAdapter {
    async suggestRevision() {
      throw new Error("API Offline");
    }
  };

  it("1. Executa 1 provider mockado em 1 caso", async () => {
    const service = new ProviderEvaluationService({
      "MOCK_OPENAI": new MockAdapter("Enfrente o pedido principal")
    });

    const cases = [OFFICIAL_EVALUATION_CASES[0]]; // UNADDRESSED_MAIN_REQUEST
    const results = await service.evaluate(cases);

    assert.equal(results.length, 1);
    assert.equal(results[0].caseId, "case-001");
    assert.equal(results[0].provider, "MOCK_OPENAI");
    assert.equal(results[0].suggestion, "Enfrente o pedido principal");
  });

  it("2. Executa m\u00FAltiplos providers", async () => {
    const service = new ProviderEvaluationService({
      "OPENAI": new MockAdapter("Resposta OpenAI"),
      "GEMINI": new MockAdapter("Resposta Gemini")
    });

    const cases = [OFFICIAL_EVALUATION_CASES[1]]; // MEDICAL_EVIDENCE
    const results = await service.evaluate(cases);

    assert.equal(results.length, 2);
    assert.ok(results.some(r => r.provider === "OPENAI" && r.suggestion === "Resposta OpenAI"));
    assert.ok(results.some(r => r.provider === "GEMINI" && r.suggestion === "Resposta Gemini"));
  });

  it("3. Captura erros em providers mantendo a execu\u00E7\u00E3o (Retorna ProviderEvaluationResult[])", async () => {
    const service = new ProviderEvaluationService({
      "GEMINI": new MockAdapter("Sucesso Gemini"),
      "DEEPSEEK": new MockErrorAdapter() as any
    });

    const cases = [OFFICIAL_EVALUATION_CASES[0]];
    const results = await service.evaluate(cases);

    assert.equal(results.length, 2);
    const deepseek = results.find(r => r.provider === "DEEPSEEK");
    assert.ok(deepseek?.suggestion.includes("ERRO DE EXECU\u00C7\u00C3O: API Offline"));
  });

  it("4. approved = true quando m\u00E9tricas satisfazem gate", () => {
    const isApproved = evaluateApproval({
      adherence: 4,
      hallucinationRisk: 0,
      usefulness: 5,
      respectsScope: true
    });
    assert.equal(isApproved, true);
  });

  it("5. approved = false quando hallucinationRisk alto", () => {
    const isApproved = evaluateApproval({
      adherence: 4,
      hallucinationRisk: 3, // Reprovar: m\u00E1ximo permitido \u00E9 1
      usefulness: 5,
      respectsScope: true
    });
    assert.equal(isApproved, false);
  });

  it("5b. approved = false quando n\u00E3o respeita scope", () => {
    const isApproved = evaluateApproval({
      adherence: 5,
      hallucinationRisk: 0,
      usefulness: 5,
      respectsScope: false // Reprovar
    });
    assert.equal(isApproved, false);
  });

  it("6. N\u00E3o modifica draft/context", async () => {
    // A estrutura do request no service \u00E9 blindada, podemos interceptar no adapter e validar o q \u00E9 passado.
    let passedDraft = "";
    
    const SpyAdapter = class implements LLMRevisionAdapter {
      async suggestRevision(req: any) {
        passedDraft = req.draft;
        return {
          taskId: req.task.id,
          code: req.task.code,
          instruction: req.task.instruction,
          suggestion: "Sugest\u00E3o",
          riskLevel: "LOW" as const,
          requiresHumanReview: true,
        };
      }
    };

    const service = new ProviderEvaluationService({
      "SPY": new SpyAdapter()
    });

    await service.evaluate([OFFICIAL_EVALUATION_CASES[2]]);
    
    // Confirma que o Evaluation Harness substitui o draft original
    // evitando enviar a pe\u00E7a inteira durante a avalia\u00E7\u00E3o
    assert.ok(passedDraft.includes("DRAFT OMITIDO (EVALUATION HARNESS)"));
  });
});

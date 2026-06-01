// Testes de integração com OpenAI real.
//
// Só rodam se OPENAI_API_KEY estiver presente. Caso contrário, todos os
// testes são marcados como skip (sem falhar).
//
// Limites de custo:
//   JUDICORE_TEST_MAX_CASES   — número máximo de casos por execução (default 10)
//   JUDICORE_TEST_MAX_TOKENS  — total máximo de tokens por execução (default 200000)
//
// Modelo: gpt-4.1 (fixo no client.ts). Para reduzir custo, recomenda-se
// JUDICORE_TEST_MAX_CASES=3 em CI rotineira.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LegalPipeline } from "../../src/pipeline/pipeline.js";
import { setOpenAIClient } from "../../src/client.js";
import { FIXTURES } from "../fixtures/legal-cases.js";
import { CostTracker, loadCostLimits } from "../helpers/cost-tracker.js";
import type { PipelineEvent } from "../../src/pipeline/types.js";

const HAS_KEY = Boolean(process.env["OPENAI_API_KEY"]);
const SKIP_REASON = HAS_KEY ? "" : "OPENAI_API_KEY ausente — pulando integration tests";

// Limita a execução aos N primeiros fixtures se houver budget configurado
const limits = loadCostLimits();
const tracker = new CostTracker(limits);

// Reseta o client (caso algum unit test tenha injetado mock antes)
setOpenAIClient(null);

const fixturesToRun = FIXTURES.slice(0, limits.maxCases);

describe("Integration tests com OpenAI real (gated)", () => {
  for (const fx of fixturesToRun) {
    it(`[${fx.id}] ${fx.name}`, { skip: !HAS_KEY ? SKIP_REASON : false }, async () => {
      const pipeline = new LegalPipeline();
      const events: PipelineEvent[] = [];
      let inputTokens = 0;
      let outputTokens = 0;
      let mode: string | undefined;
      let status: string | undefined;

      try {
        for await (const evt of pipeline.run(
          {
            userId: "integration_test",
            caseDescription: fx.caseDescription,
            documentType: fx.documentType,
            jurisprudencias: fx.jurisprudencias,
            instruction: fx.instruction,
          },
          `test_${fx.id}`,
          async (_stage, data) => {
            // Acumula tokens reportados por cada estágio
            const d = data as { usage?: { inputTokens?: number; outputTokens?: number } };
            if (d?.usage) {
              inputTokens += d.usage.inputTokens ?? 0;
              outputTokens += d.usage.outputTokens ?? 0;
            }
          },
        )) {
          events.push(evt);
          if (evt.event === "mode") mode = evt.data.mode;
          if (evt.event === "done") status = evt.data.status;
        }
      } finally {
        tracker.trackCase(fx.id, inputTokens, outputTokens);
      }

      // Asserções flexíveis — integration testa que o pipeline corre, não que
      // a OpenAI dá resposta exata. Validações específicas vão nos unit tests.
      assert.ok(events.length > 0, "Pipeline deve emitir eventos");
      if (fx.expected.mode) {
        assert.equal(mode, fx.expected.mode, `Modo esperado ${fx.expected.mode}, obtido ${mode}`);
      }
      if (fx.expected.status) {
        assert.equal(status, fx.expected.status, `Status esperado ${fx.expected.status}, obtido ${status}`);
      }
    });
  }
});

// Sumário no final
if (HAS_KEY) {
  process.on("exit", () => {
    const s = tracker.summary();
    console.log("\n[integration] Resumo:");
    console.log(`  casos:  ${s.totalCases}/${s.limits.maxCases}`);
    console.log(`  tokens: ${s.totalTokens}/${s.limits.maxTotalTokens}`);
  });
}

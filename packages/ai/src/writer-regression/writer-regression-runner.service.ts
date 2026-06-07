import { FinalValidator } from "../validators/final.validator.js";
import { LegalAudit } from "../pipeline/types.js";
import type { 
  WriterRegressionScenario, 
  WriterRegressionSummary, 
  WriterRegressionExpectedResult,
  WriterRegressionScenarioResult
} from "./writer-regression.types.js";

export class WriterRegressionRunnerService {
  private finalValidator = new FinalValidator();

  public runScenarios(scenarios: WriterRegressionScenario[]): WriterRegressionSummary {
    const summary: WriterRegressionSummary = {
      totalScenarios: scenarios.length,
      passed: 0,
      failed: 0,
      blocked: 0,
      warnings: 0,
      results: []
    };

    for (const scenario of scenarios) {
      // Cria defaults seguros
      const defaultAudit: LegalAudit = {
        aprovada: true,
        score: 100, // Score perfeito para isolar testes de regras determinísticas
        erros: [],
        resumo: "Audit simulado",
      };

      const defaultExtraction = { fatos: [], pedidos: [], questoes_juridicas: [], artigos_citados: [], jurisprudencias_relevantes: [], qualidade_extracao: "SUFICIENTE" as const };
      const defaultMatrix = { teses: [] };

      const classification = {
        tipo_justica: "INDETERMINADA",
        regime_juridico: "INDETERMINADO",
        grau: "PRIMEIRO",
        tribunal_competente: "TESTE",
        rito: null,
        assunto_principal: "TESTE",
        partes: { autor: "A", reu: "B" },
        confianca: 1,
        ...scenario.input.classification,
      } as any;

      const extraction = { ...defaultExtraction, ...scenario.input.extraction };
      const matrix = { ...defaultMatrix, ...scenario.input.matrix };
      const jurisprudencias = scenario.input.jurisprudencias || [];
      const mode = "FINAL_DRAFT"; // Regressão roda no modo final e estrito

      // Executa o validador
      const result = this.finalValidator.validate(
        scenario.input.draft,
        classification,
        extraction,
        matrix,
        defaultAudit,
        jurisprudencias,
        mode,
        [], // evidenceAnalyses
        scenario.input.decidedOutcome
      );

      let actualStatus: WriterRegressionExpectedResult = "PASS";
      
      if (result.hasFatalErrors) {
        // Erros fatais causam bloqueio (BLOCKED ou FATAL representam a mesma camada física: reprovação dura)
        actualStatus = scenario.expectedResult === "FATAL" ? "FATAL" : "BLOCKED";
      } else if (result.blocked) {
        // Bloqueado por score (neste caso o score é sempre 100, mas pode haver outras lógicas de fallback)
        actualStatus = "BLOCKED";
      } else if (result.errors.length > 0) {
        // Erros não fatais (warnings)
        actualStatus = "WARNING";
      }

      // Se o esperado for PASS, e houver algum erro fatal/bloqueio ou warning não previsto
      // No entanto, se houver warnings num cenário PASS, o runner pode considerar FAIL se exigirmos limpeza total
      // Pelo prompt: "D3: Precedente corretamente aplicado. Resultado: PASS".
      // Se houver warning, expected: PASS e actual: WARNING -> Failed!
      const passed = actualStatus === scenario.expectedResult;

      if (passed) {
        summary.passed++;
      } else {
        summary.failed++;
      }

      if (actualStatus === "BLOCKED" || actualStatus === "FATAL") summary.blocked++;
      if (actualStatus === "WARNING") summary.warnings++;

      summary.results.push({
        scenarioId: scenario.id,
        passed,
        actualStatus,
        expectedStatus: scenario.expectedResult,
        errorMessages: result.errors.map(e => `[${e.rule}] ${e.message}`)
      });
    }

    return summary;
  }
}

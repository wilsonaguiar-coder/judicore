/**
 * FASE 9.0.0-A — Testes de telemetria e anonimização
 *
 * Cobre:
 * 1. anonymizeSnippet — CPF, NB, processo, truncamento
 * 2. mightContainPii — detecção
 * 3. StrengthReviewTelemetryService — recordExecution, recordFeedback, getAnalytics
 * 4. Analytics — topFindingTypes, feedbackStats, opportunityDistribution
 * 5. Fallback em memória quando sistema de arquivos não disponível
 *
 * Executa com: pnpm dlx tsx packages/ai/src/legal-reviewer/tests/telemetry.spec.ts
 */

import { anonymizeSnippet, anonymizeSuggestion, mightContainPii } from "../telemetry/anonymizer.js";
import { StrengthReviewTelemetryService } from "../telemetry/strength-review-telemetry.service.js";
import { StrengthFindingType } from "../enums/strength-finding-type.enum.js";
import { OpportunityLevel } from "../enums/opportunity-level.enum.js";
import type { AiLegalStrengthFinding } from "../dto/ai-legal-strength-finding.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync, existsSync } from "node:fs";

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function test(name: string, fn: () => void): void {
  console.log(`\n[TEST] ${name}`);
  try {
    fn();
  } catch (err) {
    console.error(`  ✗ EXCEÇÃO NÃO ESPERADA: ${(err as Error).message}`);
    failed++;
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeFinding(overrides: Partial<AiLegalStrengthFinding> = {}): AiLegalStrengthFinding {
  return {
    id: "test-id-" + Math.random().toString(36).slice(2),
    type: StrengthFindingType.MISSING_DEMONSTRATION,
    opportunity: OpportunityLevel.IMPACTFUL,
    title: "Quadro demonstrativo ausente",
    rationale: "Os requisitos são afirmados sem demonstração fática.",
    evidenceFromText: ["o instituidor preenchia os requisitos da EC 47/2005"],
    suggestion: "Incluir quadro com tempo de contribuição, idade e cargo.",
    confidence: 0.88,
    requiresHumanReview: true,
    ...overrides,
  };
}

function makeTmpLogPath(): string {
  return join(tmpdir(), `telemetry-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
}

function makeIsolatedSvc(): { svc: StrengthReviewTelemetryService; cleanup: () => void } {
  const path = makeTmpLogPath();
  return {
    svc: new StrengthReviewTelemetryService(path),
    cleanup: () => { if (existsSync(path)) rmSync(path); },
  };
}

// ── Cenário 1 — anonymizeSnippet ──────────────────────────────────────────────

test("anonymizeSnippet — remove CPF formatado", () => {
  const result = anonymizeSnippet("O autor CPF 123.456.789-09 pleiteia benefício.");
  assert(!result.includes("123.456.789-09"), "CPF formatado removido");
  assert(result.includes("[CPF]"), "substituído por [CPF]");
});

test("anonymizeSnippet — remove CPF sem formatação", () => {
  const result = anonymizeSnippet("CPF 12345678909 do requerente");
  assert(!result.includes("12345678909"), "CPF sem formatação removido");
  assert(result.includes("[CPF]"), "substituído por [CPF]");
});

test("anonymizeSnippet — remove número de processo CNJ", () => {
  const result = anonymizeSnippet("Processo 0001234-56.2024.4.01.3400 em andamento.");
  assert(!result.includes("0001234-56.2024.4.01.3400"), "processo CNJ removido");
  assert(result.includes("[PROCESSO]"), "substituído por [PROCESSO]");
});

test("anonymizeSnippet — trunca em 120 caracteres", () => {
  const long = "A".repeat(200);
  const result = anonymizeSnippet(long);
  assert(result.length <= 120, `truncado para <= 120 chars (foi ${result.length})`);
});

test("anonymizeSnippet — texto limpo permanece inalterado (exceto truncamento)", () => {
  const text = "o instituidor preenchia os requisitos da EC 47/2005";
  const result = anonymizeSnippet(text);
  assert(result === text, "texto sem PII não é alterado");
});

test("mightContainPii — detecta CPF", () => {
  assert(mightContainPii("CPF 123.456.789-09"), "CPF detectado");
  assert(!mightContainPii("texto sem pii"), "texto limpo não detectado");
});

test("anonymizeSuggestion — aplica mesma política do anonymizeSnippet", () => {
  const result = anonymizeSuggestion("Incluir CPF 111.222.333-44 no preâmbulo.");
  assert(!result.includes("111.222.333-44"), "CPF removido de sugestão");
});

// ── Cenário 2 — StrengthReviewTelemetryService — em memória ─────────────────

test("StrengthReviewTelemetryService — analytics vazio quando sem dados", () => {
  const { svc, cleanup } = makeIsolatedSvc();
  try {
    const analytics = svc.getAnalytics();
    assert(analytics.totalExecutions === 0, "totalExecutions = 0");
    assert(analytics.totalFindings === 0, "totalFindings = 0");
    assert(analytics.avgFindingsPerExecution === 0, "avgFindingsPerExecution = 0");
    assert(analytics.topFindingTypes.length === 0, "topFindingTypes vazio");
    assert(analytics.feedbackStats.totalFeedback === 0, "totalFeedback = 0");
    assert(analytics.feedbackStats.usefulRate === 0, "usefulRate = 0");
  } finally { cleanup(); }
});

test("StrengthReviewTelemetryService — recordExecution em memória + analytics", () => {
  const { svc, cleanup } = makeIsolatedSvc();
  try {
    svc.recordExecution({
      domain: "PREVIDENCIARIO",
      pieceType: "PETICAO_INICIAL",
      provider: "DEEPSEEK",
      model: "deepseek-chat",
      findings: [
        makeFinding({ type: StrengthFindingType.MISSING_DEMONSTRATION, opportunity: OpportunityLevel.IMPACTFUL }),
        makeFinding({ type: StrengthFindingType.MISSING_CALCULATION, opportunity: OpportunityLevel.COMPLEMENTARY }),
      ],
      responseTimeMs: 1200,
    });

    svc.recordExecution({
      domain: "PREVIDENCIARIO",
      provider: "DEEPSEEK",
      model: "deepseek-chat",
      findings: [
        makeFinding({ type: StrengthFindingType.MISSING_DEMONSTRATION, opportunity: OpportunityLevel.IMPACTFUL }),
      ],
      responseTimeMs: 980,
    });

    const analytics = svc.getAnalytics();

    assert(analytics.totalExecutions === 2, "totalExecutions = 2");
    assert(analytics.totalFindings === 3, "totalFindings = 3");
    assert(analytics.avgFindingsPerExecution === 1.5, "avgFindingsPerExecution = 1.5");

    const top = analytics.topFindingTypes[0];
    assert(top?.type === StrengthFindingType.MISSING_DEMONSTRATION, "MISSING_DEMONSTRATION é o mais frequente");
    assert(top?.count === 2, "count = 2");

    const opp = analytics.opportunityLevelDistribution;
    assert(opp["IMPACTFUL"] === 2, "2 findings IMPACTFUL");
    assert(opp["COMPLEMENTARY"] === 1, "1 finding COMPLEMENTARY");

    const provider = analytics.providerStats["DEEPSEEK"];
    assert(provider !== undefined, "stats do DEEPSEEK registradas");
    assert(provider!.executions === 2, "2 execuções DeepSeek");

    const byDomain = analytics.topFindingsByDomain["PREVIDENCIARIO"];
    assert(byDomain !== undefined, "domínio PREVIDENCIARIO presente");
    assert(byDomain![0]?.type === StrengthFindingType.MISSING_DEMONSTRATION, "top finding do domínio correto");
  } finally { cleanup(); }
});

test("StrengthReviewTelemetryService — recordFeedback em memória + stats", () => {
  const { svc, cleanup } = makeIsolatedSvc();
  try {
    svc.recordFeedback({ findingId: "a", findingType: "MISSING_DEMONSTRATION", opportunityLevel: "IMPACTFUL", feedback: "USEFUL" });
    svc.recordFeedback({ findingId: "b", findingType: "MISSING_DEMONSTRATION", opportunityLevel: "IMPACTFUL", feedback: "USEFUL" });
    svc.recordFeedback({ findingId: "c", findingType: "MISSING_CALCULATION",   opportunityLevel: "COMPLEMENTARY", feedback: "NOT_USEFUL" });

    const analytics = svc.getAnalytics();
    const fb = analytics.feedbackStats;

    assert(fb.totalFeedback === 3, "3 feedbacks registrados");
    assert(fb.usefulCount === 2, "2 úteis");
    assert(fb.notUsefulCount === 1, "1 não útil");
    assert(fb.usefulRate === Number(((2/3)*100).toFixed(1)), "usefulRate correto");

    const demoStats = fb.byFindingType["MISSING_DEMONSTRATION"];
    assert(demoStats !== undefined, "stats por tipo MISSING_DEMONSTRATION presentes");
    assert(demoStats!.useful === 2, "2 úteis para MISSING_DEMONSTRATION");
    assert(demoStats!.usefulRate === 100, "usefulRate 100% para MISSING_DEMONSTRATION");

    const calcStats = fb.byFindingType["MISSING_CALCULATION"];
    assert(calcStats !== undefined, "stats por tipo MISSING_CALCULATION presentes");
    assert(calcStats!.notUseful === 1, "1 não útil para MISSING_CALCULATION");
    assert(calcStats!.usefulRate === 0, "usefulRate 0% para MISSING_CALCULATION");
  } finally { cleanup(); }
});

// ── Cenário 3 — persistência em arquivo temporário ────────────────────────────

test("StrengthReviewTelemetryService — persiste e lê de arquivo JSONL", () => {
  const logPath = makeTmpLogPath();

  try {
    const svc = new StrengthReviewTelemetryService(logPath);

    svc.recordExecution({
      domain: "CIVIL",
      provider: "OPENAI",
      model: "gpt-4o",
      findings: [
        makeFinding({ type: StrengthFindingType.STRENGTHEN_ARGUMENT, opportunity: OpportunityLevel.OPTIONAL }),
      ],
      responseTimeMs: 750,
    });

    svc.recordFeedback({
      findingId: "x1",
      findingType: "STRENGTHEN_ARGUMENT",
      opportunityLevel: "OPTIONAL",
      domain: "CIVIL",
      feedback: "USEFUL",
    });

    assert(existsSync(logPath), "arquivo JSONL criado");

    // Nova instância lê do mesmo arquivo
    const svc2 = new StrengthReviewTelemetryService(logPath);
    const analytics = svc2.getAnalytics();

    assert(analytics.totalExecutions === 1, "1 execução lida do arquivo");
    assert(analytics.totalFindings === 1, "1 finding lido do arquivo");
    assert(analytics.feedbackStats.totalFeedback === 1, "1 feedback lido do arquivo");
    assert(analytics.feedbackStats.usefulCount === 1, "feedback USEFUL lido corretamente");

    const provider = analytics.providerStats["OPENAI"];
    assert(provider !== undefined, "provider OPENAI presente");
    assert(provider!.executions === 1, "1 execução OpenAI");
    assert(provider!.avgResponseTimeMs === 750, "responseTime correto");
  } finally {
    if (existsSync(logPath)) rmSync(logPath);
  }
});

// ── Cenário 4 — exemplos anonimizados ────────────────────────────────────────

test("getAnalytics — exemplos anonimizados não contêm CPF ou processo", () => {
  const { svc, cleanup } = makeIsolatedSvc();

  svc.recordExecution({
    domain: "PREVIDENCIARIO",
    provider: "DEEPSEEK",
    model: "deepseek-chat",
    findings: [
      makeFinding({
        evidenceFromText: ["autor CPF 111.222.333-44 pede benefício do processo 0001234-56.2024.4.01.3400"],
      }),
    ],
    responseTimeMs: 500,
  });

  const analytics = svc.getAnalytics();
  assert(analytics.anonymizedExamples.length > 0, "exemplos presentes");

  const snippet = analytics.anonymizedExamples[0]?.evidenceSnippet ?? "";
  assert(!snippet.includes("111.222.333-44"), "CPF não aparece no snippet");
  assert(!snippet.includes("0001234-56.2024.4.01.3400"), "processo não aparece no snippet");
  cleanup();
});

// ── Cenário 5 — telemetria não quebra o serviço principal ─────────────────────

test("Telemetria com path inválido não lança exceção", () => {
  // Path completamente inválido
  const svc = new StrengthReviewTelemetryService("/dev/null/impossivel/path.jsonl");

  let threw = false;
  try {
    svc.recordExecution({
      provider: "DEEPSEEK", model: "deepseek-chat",
      findings: [], responseTimeMs: 100,
    });
    svc.recordFeedback({
      findingId: "x", findingType: "MISSING_CALCULATION",
      opportunityLevel: "OPTIONAL", feedback: "USEFUL",
    });
    svc.getAnalytics();
  } catch {
    threw = true;
  }

  assert(!threw, "telemetria com path inválido não lança exceção");
});

// ── Resultado final ───────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(60)}`);
console.log(`Resultado: ${passed} passaram, ${failed} falharam`);
console.log("=".repeat(60));

if (failed > 0) process.exit(1);

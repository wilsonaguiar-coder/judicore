/**
 * FASE 9.0.1 — Testes de calibração do Strength Reviewer
 *
 * Cobre:
 * 1. findingQualityScore — fórmula composta
 * 2. topPerformers / lowPerformers
 * 3. Detecção de findings genéricos (>80% das execuções)
 * 4. Análise por domínio jurídico
 * 5. Comparação entre providers
 * 6. Correlação confidence × usefulnessRate (confidence bands)
 * 7. Corpus de melhores exemplos
 * 8. CalibrationReport com dataQuality e recommendations
 *
 * Executa com: pnpm dlx tsx packages/ai/src/legal-reviewer/tests/calibration.spec.ts
 */

import { StrengthReviewTelemetryService } from "../telemetry/strength-review-telemetry.service.js";
import { StrengthReviewerCalibrationService } from "../calibration/strength-reviewer-calibration.service.js";
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

let _idCounter = 0;

function makeFinding(overrides: Partial<AiLegalStrengthFinding> = {}): AiLegalStrengthFinding {
  return {
    id: `id-${++_idCounter}`,
    type: StrengthFindingType.MISSING_DEMONSTRATION,
    opportunity: OpportunityLevel.IMPACTFUL,
    title: "Demonstração ausente",
    rationale: "Os requisitos não foram demonstrados faticamente.",
    evidenceFromText: ["o requerente preenchia os requisitos"],
    suggestion: "Incluir quadro demonstrativo.",
    confidence: 0.85,
    requiresHumanReview: true,
    ...overrides,
  };
}

/** Cada teste usa um arquivo JSONL temporário único, garantindo isolamento completo. */
function makeIsolated(): { svc: StrengthReviewTelemetryService; calib: StrengthReviewerCalibrationService; cleanup: () => void } {
  const path = join(tmpdir(), `calib-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  const svc = new StrengthReviewTelemetryService(path);
  const calib = new StrengthReviewerCalibrationService(svc);
  return {
    svc,
    calib,
    cleanup: () => { if (existsSync(path)) rmSync(path); },
  };
}

// ── Cenário 1 — findingQualityScore fórmula composta ─────────────────────────

test("findingQualityScore — fórmula: usefulnessRate×0.60 + avgConfidence×0.30 + (1−penalty)×0.10", () => {
  const { svc, calib, cleanup } = makeIsolated();
  try {
    // 3 execuções com MISSING_DEMONSTRATION confidence=0.90
    for (let i = 0; i < 3; i++) {
      svc.recordExecution({
        provider: "DEEPSEEK", model: "deepseek-chat",
        findings: [makeFinding({ type: StrengthFindingType.MISSING_DEMONSTRATION, confidence: 0.90 })],
        responseTimeMs: 1000,
      });
    }
    // 2 feedbacks USEFUL → usefulnessRate = 100%
    svc.recordFeedback({ findingId: "a", findingType: "MISSING_DEMONSTRATION", opportunityLevel: "IMPACTFUL", feedback: "USEFUL" });
    svc.recordFeedback({ findingId: "b", findingType: "MISSING_DEMONSTRATION", opportunityLevel: "IMPACTFUL", feedback: "USEFUL" });

    const report = calib.calibrate();
    const entry = report.findingQuality.find(e => e.findingType === "MISSING_DEMONSTRATION");
    assert(entry !== undefined, "entry MISSING_DEMONSTRATION presente");

    // genericityRatio = 3/3 = 1.0 → penalty = (1.0 - 0.8)/(1 - 0.8) = 1.0
    // qualityScore = 1.0×0.60 + 0.90×0.30 + (1-1.0)×0.10 = 0.60 + 0.27 + 0.00 = 0.87
    assert(entry!.usefulnessRate === 100, `usefulnessRate=100 (foi ${entry!.usefulnessRate})`);
    assert(Math.abs(entry!.avgConfidence - 0.90) < 0.001, `avgConfidence≈0.90 (foi ${entry!.avgConfidence})`);
    assert(entry!.genericityRatio === 1, `genericityRatio=1.0 (foi ${entry!.genericityRatio})`);
    assert(Math.abs(entry!.qualityScore - 0.87) < 0.01, `qualityScore≈0.87 (foi ${entry!.qualityScore})`);
  } finally {
    cleanup();
  }
});

// ── Cenário 2 — topPerformers / lowPerformers ─────────────────────────────────

test("topPerformers e lowPerformers — baseados em qualityScore", () => {
  const { svc, calib, cleanup } = makeIsolated();
  try {
    // STRENGTHEN_ARGUMENT: alta confiança, muito feedback útil, aparece em poucas execuções
    for (let i = 0; i < 5; i++) {
      svc.recordExecution({
        provider: "OPENAI", model: "gpt-4o",
        findings: [makeFinding({ type: StrengthFindingType.STRENGTHEN_ARGUMENT, confidence: 0.92 })],
        responseTimeMs: 900,
      });
    }
    svc.recordFeedback({ findingId: "x1", findingType: "STRENGTHEN_ARGUMENT", opportunityLevel: "IMPACTFUL", feedback: "USEFUL" });
    svc.recordFeedback({ findingId: "x2", findingType: "STRENGTHEN_ARGUMENT", opportunityLevel: "IMPACTFUL", feedback: "USEFUL" });
    svc.recordFeedback({ findingId: "x3", findingType: "STRENGTHEN_ARGUMENT", opportunityLevel: "IMPACTFUL", feedback: "USEFUL" });

    // MISSING_CALCULATION: baixíssimo feedback útil
    for (let i = 0; i < 5; i++) {
      svc.recordExecution({
        provider: "OPENAI", model: "gpt-4o",
        findings: [makeFinding({ type: StrengthFindingType.MISSING_CALCULATION, confidence: 0.76 })],
        responseTimeMs: 900,
      });
    }
    svc.recordFeedback({ findingId: "y1", findingType: "MISSING_CALCULATION", opportunityLevel: "IMPACTFUL", feedback: "NOT_USEFUL" });
    svc.recordFeedback({ findingId: "y2", findingType: "MISSING_CALCULATION", opportunityLevel: "IMPACTFUL", feedback: "NOT_USEFUL" });
    svc.recordFeedback({ findingId: "y3", findingType: "MISSING_CALCULATION", opportunityLevel: "IMPACTFUL", feedback: "NOT_USEFUL" });

    const report = calib.calibrate();

    const topTypes = report.topPerformers.map(e => e.findingType);
    const lowTypes = report.lowPerformers.map(e => e.findingType);

    assert(topTypes.includes("STRENGTHEN_ARGUMENT"), `STRENGTHEN_ARGUMENT em topPerformers (${topTypes.join(",")})`);
    assert(lowTypes.includes("MISSING_CALCULATION"), `MISSING_CALCULATION em lowPerformers (${lowTypes.join(",")})`);
  } finally {
    cleanup();
  }
});

// ── Cenário 3 — detecção de findings genéricos (>80%) ────────────────────────

test("genericityAlerts — finding que aparece em >80% das execuções", () => {
  const { svc, calib, cleanup } = makeIsolated();
  try {
    // WEAK_FACTUAL_FOUNDATION em 5 de 6 execuções → 83.3% → deve alertar
    for (let i = 0; i < 5; i++) {
      svc.recordExecution({
        provider: "DEEPSEEK", model: "deepseek-chat",
        findings: [makeFinding({ type: StrengthFindingType.WEAK_FACTUAL_FOUNDATION, confidence: 0.80 })],
        responseTimeMs: 800,
      });
    }

    // MISSING_DATE_ANCHOR apenas em 1 de 6 → 16.7% — não deve alertar
    svc.recordExecution({
      provider: "DEEPSEEK", model: "deepseek-chat",
      findings: [makeFinding({ type: StrengthFindingType.MISSING_DATE_ANCHOR, confidence: 0.82 })],
      responseTimeMs: 800,
    });

    const report = calib.calibrate();
    const alertedTypes = report.genericityAlerts.map(a => a.findingType);

    assert(alertedTypes.includes("WEAK_FACTUAL_FOUNDATION"), "WEAK_FACTUAL_FOUNDATION alertado como genérico");
    assert(!alertedTypes.includes("MISSING_DATE_ANCHOR"), "MISSING_DATE_ANCHOR não alertado (16.7%)");

    const alert = report.genericityAlerts.find(a => a.findingType === "WEAK_FACTUAL_FOUNDATION");
    assert(alert !== undefined && alert.affectedExecutionsPct >= 80, `affectedExecutionsPct >= 80 (foi ${alert?.affectedExecutionsPct})`);
    assert(typeof alert!.recommendation === "string" && alert!.recommendation.length > 10, "recomendação presente");
  } finally {
    cleanup();
  }
});

// ── Cenário 4 — análise por domínio ──────────────────────────────────────────

test("domainCalibration — separa execuções por domínio", () => {
  const { svc, calib, cleanup } = makeIsolated();
  try {
    for (let i = 0; i < 3; i++) {
      svc.recordExecution({
        domain: "PREVIDENCIARIO", provider: "DEEPSEEK", model: "deepseek-chat",
        findings: [
          makeFinding({ type: StrengthFindingType.MISSING_DEMONSTRATION, confidence: 0.88 }),
          makeFinding({ type: StrengthFindingType.MISSING_CALCULATION, confidence: 0.82 }),
        ],
        responseTimeMs: 1100,
      });
    }
    for (let i = 0; i < 2; i++) {
      svc.recordExecution({
        domain: "CIVIL", provider: "OPENAI", model: "gpt-4o",
        findings: [makeFinding({ type: StrengthFindingType.STRENGTHEN_ARGUMENT, confidence: 0.91 })],
        responseTimeMs: 900,
      });
    }
    svc.recordFeedback({ findingId: "f1", findingType: "MISSING_DEMONSTRATION", opportunityLevel: "IMPACTFUL", domain: "PREVIDENCIARIO", feedback: "USEFUL" });

    const report = calib.calibrate();
    const domains = report.domainCalibration.map(d => d.domain);

    assert(domains.includes("PREVIDENCIARIO"), "domínio PREVIDENCIARIO presente");
    assert(domains.includes("CIVIL"), "domínio CIVIL presente");

    const prev = report.domainCalibration.find(d => d.domain === "PREVIDENCIARIO");
    assert(prev !== undefined, "calibração PREVIDENCIARIO encontrada");
    assert(prev!.totalExecutions === 3, `3 execuções previdenciárias (foi ${prev!.totalExecutions})`);
    assert(prev!.avgFindingsPerExecution === 2, `média 2 findings (foi ${prev!.avgFindingsPerExecution})`);
    assert(prev!.topFindingTypes.length >= 1, "topFindingTypes não vazio");
  } finally {
    cleanup();
  }
});

// ── Cenário 5 — comparação entre providers ────────────────────────────────────

test("providerComparison — separa e compara providers", () => {
  const { svc, calib, cleanup } = makeIsolated();
  try {
    // 4 execuções DeepSeek
    for (let i = 0; i < 4; i++) {
      svc.recordExecution({
        provider: "DEEPSEEK", model: "deepseek-chat",
        findings: [makeFinding({ type: StrengthFindingType.MISSING_DEMONSTRATION, confidence: 0.85 })],
        responseTimeMs: 1200,
      });
    }
    // 2 execuções OpenAI — mais rápidas, mesmo tipo
    for (let i = 0; i < 2; i++) {
      svc.recordExecution({
        provider: "OPENAI", model: "gpt-4o",
        findings: [makeFinding({ type: StrengthFindingType.MISSING_DEMONSTRATION, confidence: 0.90 })],
        responseTimeMs: 700,
      });
    }
    svc.recordFeedback({ findingId: "z1", findingType: "MISSING_DEMONSTRATION", opportunityLevel: "IMPACTFUL", feedback: "USEFUL" });
    svc.recordFeedback({ findingId: "z2", findingType: "MISSING_DEMONSTRATION", opportunityLevel: "IMPACTFUL", feedback: "USEFUL" });

    const report = calib.calibrate();
    const providers = report.providerComparison.map(p => p.provider);

    assert(providers.includes("DEEPSEEK"), "DEEPSEEK presente");
    assert(providers.includes("OPENAI"), "OPENAI presente");

    const ds = report.providerComparison.find(p => p.provider === "DEEPSEEK");
    const oa = report.providerComparison.find(p => p.provider === "OPENAI");

    assert(ds!.executions === 4, `DeepSeek: 4 execuções (foi ${ds!.executions})`);
    assert(oa!.executions === 2, `OpenAI: 2 execuções (foi ${oa!.executions})`);
    assert(ds!.avgResponseTimeMs === 1200, `DeepSeek avgRt=1200 (foi ${ds!.avgResponseTimeMs})`);
    assert(oa!.avgResponseTimeMs === 700, `OpenAI avgRt=700 (foi ${oa!.avgResponseTimeMs})`);
  } finally {
    cleanup();
  }
});

// ── Cenário 6 — correlação confidence × usefulnessRate ───────────────────────

test("confidenceBands — correlação confiança × utilidade", () => {
  const { svc, calib, cleanup } = makeIsolated();
  try {
    // Findings com confidence alta: tipo A → feedback USEFUL
    svc.recordExecution({
      provider: "DEEPSEEK", model: "deepseek-chat",
      findings: [makeFinding({ type: StrengthFindingType.STRENGTHEN_ARGUMENT, confidence: 0.95 })],
      responseTimeMs: 900,
    });
    svc.recordFeedback({ findingId: "hc1", findingType: "STRENGTHEN_ARGUMENT", opportunityLevel: "IMPACTFUL", feedback: "USEFUL" });

    // Findings com confidence baixa: tipo B → feedback NOT_USEFUL
    svc.recordExecution({
      provider: "DEEPSEEK", model: "deepseek-chat",
      findings: [makeFinding({ type: StrengthFindingType.MISSING_DATE_ANCHOR, confidence: 0.77 })],
      responseTimeMs: 900,
    });
    svc.recordFeedback({ findingId: "lc1", findingType: "MISSING_DATE_ANCHOR", opportunityLevel: "COMPLEMENTARY", feedback: "NOT_USEFUL" });

    const report = calib.calibrate();
    const bands = report.confidenceBands;

    assert(bands.length === 3, `3 faixas de confiança (foi ${bands.length})`);

    const highBand = bands.find(b => b.label === "0.90–1.00");
    const lowBand = bands.find(b => b.label === "0.75–0.79");

    assert(highBand !== undefined, "faixa 0.90–1.00 presente");
    assert(lowBand !== undefined, "faixa 0.75–0.79 presente");

    assert(highBand!.sampleSize >= 1, `faixa alta tem amostras (foi ${highBand!.sampleSize})`);
    assert(lowBand!.sampleSize >= 1, `faixa baixa tem amostras (foi ${lowBand!.sampleSize})`);

    assert(
      highBand!.usefulnessRate >= lowBand!.usefulnessRate,
      `usefulnessRate faixa alta (${highBand!.usefulnessRate}) >= faixa baixa (${lowBand!.usefulnessRate})`,
    );
  } finally {
    cleanup();
  }
});

// ── Cenário 7 — corpus de melhores exemplos ───────────────────────────────────

test("bestExamples — prioriza tipos com mais feedbacks USEFUL", () => {
  const { svc, calib, cleanup } = makeIsolated();
  try {
    for (let i = 0; i < 3; i++) {
      svc.recordExecution({
        provider: "DEEPSEEK", model: "deepseek-chat", domain: "PREVIDENCIARIO",
        findings: [
          makeFinding({
            type: StrengthFindingType.MISSING_DEMONSTRATION,
            evidenceFromText: ["o instituidor preenchia os requisitos da EC 47/2005"],
            confidence: 0.88,
          }),
        ],
        responseTimeMs: 1000,
      });
    }
    // 3 feedbacks USEFUL para MISSING_DEMONSTRATION
    for (let i = 0; i < 3; i++) {
      svc.recordFeedback({ findingId: `d${i}`, findingType: "MISSING_DEMONSTRATION", opportunityLevel: "IMPACTFUL", feedback: "USEFUL" });
    }

    svc.recordExecution({
      provider: "DEEPSEEK", model: "deepseek-chat", domain: "CIVIL",
      findings: [
        makeFinding({
          type: StrengthFindingType.WEAK_FACTUAL_FOUNDATION,
          evidenceFromText: ["o contrato não estabelece prazo determinado"],
          confidence: 0.80,
        }),
      ],
      responseTimeMs: 900,
    });
    // 0 feedbacks para WEAK_FACTUAL_FOUNDATION

    const report = calib.calibrate();
    assert(report.bestExamples.length > 0, "bestExamples não vazio");

    const firstType = report.bestExamples[0]?.findingType;
    assert(firstType === "MISSING_DEMONSTRATION", `primeiro exemplo é MISSING_DEMONSTRATION (foi ${firstType})`);

    const demoExamples = report.bestExamples.filter(e => e.findingType === "MISSING_DEMONSTRATION");
    assert(demoExamples.every(e => e.usefulFeedbackCount === 3), "usefulFeedbackCount=3 em todos os exemplos de MISSING_DEMONSTRATION");
  } finally {
    cleanup();
  }
});

// ── Cenário 8 — CalibrationReport: dataQuality e recommendations ─────────────

test("CalibrationReport — dataQuality.sufficientData e recommendations", () => {
  // Teste A: dados insuficientes
  const { svc, calib, cleanup } = makeIsolated();
  try {
    for (let i = 0; i < 2; i++) {
      svc.recordExecution({
        provider: "DEEPSEEK", model: "deepseek-chat",
        findings: [makeFinding({ confidence: 0.85 })],
        responseTimeMs: 800,
      });
    }

    const report = calib.calibrate();

    assert(!report.dataQuality.sufficientData, "sufficientData=false com dados insuficientes");
    assert(typeof report.dataQuality.warning === "string", "warning presente");
    assert(report.dataQuality.totalExecutions === 2, `totalExecutions=2 (foi ${report.dataQuality.totalExecutions})`);
    assert(report.dataQuality.totalFeedbacks === 0, `totalFeedbacks=0 (foi ${report.dataQuality.totalFeedbacks})`);
    assert(report.recommendations.length > 0, "recomendação de dados insuficientes presente");
    assert(report.recommendations.some(r => r.severity === "LOW"), "recomendação de dados insuficientes é LOW");
  } finally {
    cleanup();
  }

  // Teste B: finding com baixa utilidade → recomendação HIGH
  const { svc: svc2, calib: calib2, cleanup: cleanup2 } = makeIsolated();
  try {
    for (let i = 0; i < 6; i++) {
      svc2.recordExecution({
        provider: "DEEPSEEK", model: "deepseek-chat",
        findings: [makeFinding({ type: StrengthFindingType.MISSING_CALCULATION, confidence: 0.80 })],
        responseTimeMs: 800,
      });
    }
    for (let i = 0; i < 6; i++) {
      svc2.recordFeedback({ findingId: `n${i}`, findingType: "MISSING_CALCULATION", opportunityLevel: "IMPACTFUL", feedback: "NOT_USEFUL" });
    }

    const report2 = calib2.calibrate();
    const highRec = report2.recommendations.find(r => r.severity === "HIGH" && r.findingType === "MISSING_CALCULATION");
    assert(highRec !== undefined, "recomendação HIGH para MISSING_CALCULATION com usefulnessRate 0%");
  } finally {
    cleanup2();
  }
});

// ── Relatório de calibração é observacional — sem modificações automáticas ────

test("calibrate() — nunca modifica prompts, thresholds ou findings automaticamente", () => {
  const { svc, calib, cleanup } = makeIsolated();
  try {
    svc.recordExecution({
      provider: "DEEPSEEK", model: "deepseek-chat",
      findings: [makeFinding({ type: StrengthFindingType.MISSING_LEGAL_ANCHOR, confidence: 0.75 })],
      responseTimeMs: 900,
    });
    svc.recordFeedback({ findingId: "q1", findingType: "MISSING_LEGAL_ANCHOR", opportunityLevel: "OPTIONAL", feedback: "NOT_USEFUL" });

    const report = calib.calibrate();

    assert(report.generatedAt !== "", "generatedAt presente");
    assert(Array.isArray(report.recommendations), "recommendations é array");
    assert(!("promptChanges" in report), "sem promptChanges");
    assert(!("disabledFindings" in report), "sem disabledFindings");
    assert(!("thresholdChanges" in report), "sem thresholdChanges");
  } finally {
    cleanup();
  }
});

// ── Resultado final ───────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(60)}`);
console.log(`Resultado: ${passed} passaram, ${failed} falharam`);
console.log("=".repeat(60));

if (failed > 0) process.exit(1);

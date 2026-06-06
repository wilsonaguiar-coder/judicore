/**
 * FASE 9.0.6 — Gold Corpus Regression Runner
 *
 * Executa os 100 documentos sintéticos do Gold Corpus V1 contra o reviewer e
 * compara os resultados obtidos com os gabaritos esperados.
 *
 * Regras de design:
 * - Não altera prompt, scoring nem reviewer.
 * - Não chama provider real (aceita ReviewerLike — real ou mock).
 * - Derivação de score a partir dos findings (ausência de score nativo no reviewer).
 * - Correspondência de findings por normalização textual (sem exigir literal exato).
 * - generatedAt e documentos do corpus permanecem inalterados.
 */

import { OpportunityLevel } from "../enums/opportunity-level.enum.js";
import type { AiLegalStrengthFinding } from "../dto/ai-legal-strength-finding.js";
import type { AiLegalStrengthReviewRequest } from "../dto/ai-legal-strength-review-request.js";
import type { IntegratedAuditResponse } from "../../audit/audit.service.js";
import { goldCorpusV1 } from "./gold-corpus-v1.spec.js";
import { goldCorpusGeneratedDocuments } from "./gold-corpus-generated-documents.js";
import type { GeneratedGoldCorpusDocument } from "./gold-corpus-document-generator.service.js";
import type { GoldCorpusCase } from "./gold-corpus.types.js";
import type {
  GoldCorpusRegressionResult,
  GoldCorpusRegressionSummary,
  ReviewerLike,
} from "./gold-corpus-regression.types.js";

// ─── Score derivado dos findings ──────────────────────────────────────────────
// Base 95: peça sem findings tem score próximo ao máximo GOOD (88–96).
// IMPACTFUL (-20): falha relevante que derruba score para faixa MODERATE/SEVERE.
// COMPLEMENTARY (-15): oportunidade importante, reduz para faixa LIGHT.
// OPTIONAL (-5): refinamento menor, mantém faixa alta.

const SCORE_BASE = 95;
const SCORE_WEIGHTS: Record<OpportunityLevel, number> = {
  [OpportunityLevel.IMPACTFUL]: 20,
  [OpportunityLevel.COMPLEMENTARY]: 15,
  [OpportunityLevel.OPTIONAL]: 5,
};

function deriveScore(findings: AiLegalStrengthFinding[]): number {
  const deduction = findings.reduce(
    (sum, f) => sum + (SCORE_WEIGHTS[f.opportunity] ?? 0),
    0,
  );
  return Math.max(0, Math.min(100, SCORE_BASE - deduction));
}

// ─── Normalização textual para matching semântico aproximado ─────────────────

function normalizeWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  return new Set(words);
}

/**
 * Verifica se um expected finding string tem correspondência semântica com um
 * actual finding text. Exige interseção de pelo menos 30% das palavras
 * relevantes do expected (mínimo 1 palavra).
 */
function findingMatches(expected: string, actual: string): boolean {
  const expectedWords = normalizeWords(expected);
  const actualWords = normalizeWords(actual);
  if (expectedWords.size === 0) return false;
  let intersectionCount = 0;
  for (const word of expectedWords) {
    if (actualWords.has(word)) intersectionCount++;
  }
  const threshold = Math.max(1, Math.floor(expectedWords.size * 0.3));
  return intersectionCount >= threshold;
}

// ─── Texto consolidado de um finding (título + rationale + suggestion) ────────

function findingText(f: AiLegalStrengthFinding): string {
  return `${f.title} ${f.rationale} ${f.suggestion}`;
}

// ─── FindingPass por qualidade ────────────────────────────────────────────────

function computeFindingPass(
  quality: string,
  expectedFindings: string[],
  matchedExpectedFindings: string[],
  actualFindingObjects: AiLegalStrengthFinding[],
): boolean {
  if (quality === "GOOD") {
    // Casos GOOD não devem ter findings de alta oportunidade
    return !actualFindingObjects.some((f) => f.opportunity === OpportunityLevel.IMPACTFUL);
  }
  if (expectedFindings.length === 0) return true;
  return matchedExpectedFindings.length >= 1;
}

// ─── Audit mínimo para o request do reviewer ──────────────────────────────────

function buildMinimalAudit(doc: GeneratedGoldCorpusDocument): IntegratedAuditResponse {
  return {
    pieceId: doc.caseId,
    audit: {
      status: "APROVADA",
      score: 100,
      classification: doc.documentType,
      fatalErrors: [],
      nonFatalErrors: [],
      strengths: [],
    },
  };
}

// ─── Sumário agregado ─────────────────────────────────────────────────────────

function buildRegressionSummary(results: GoldCorpusRegressionResult[]): GoldCorpusRegressionSummary {
  const passedCases = results.filter((r) => r.pass).length;
  const failedCases = results.length - passedCases;
  const scorePassCount = results.filter((r) => r.scorePass).length;
  const findingPassCount = results.filter(
    (r) => r.expectedFindings.length === 0 || r.matchedExpectedFindings.length >= 1,
  ).length;

  const byDomain: GoldCorpusRegressionSummary["byDomain"] = {};
  const byQuality: GoldCorpusRegressionSummary["byQuality"] = {};

  for (const r of results) {
    // byDomain
    if (!byDomain[r.domain]) {
      byDomain[r.domain] = { total: 0, passed: 0, failed: 0, passRate: 0 };
    }
    byDomain[r.domain].total++;
    if (r.pass) byDomain[r.domain].passed++;
    else byDomain[r.domain].failed++;
    byDomain[r.domain].passRate = byDomain[r.domain].passed / byDomain[r.domain].total;

    // byQuality
    if (!byQuality[r.quality]) {
      byQuality[r.quality] = { total: 0, passed: 0, failed: 0, passRate: 0 };
    }
    byQuality[r.quality].total++;
    if (r.pass) byQuality[r.quality].passed++;
    else byQuality[r.quality].failed++;
    byQuality[r.quality].passRate = byQuality[r.quality].passed / byQuality[r.quality].total;
  }

  return {
    totalCases: results.length,
    passedCases,
    failedCases,
    passRate: results.length > 0 ? passedCases / results.length : 0,
    scorePassRate: results.length > 0 ? scorePassCount / results.length : 0,
    findingPassRate: results.length > 0 ? findingPassCount / results.length : 0,
    results,
    byDomain,
    byQuality,
  };
}

// ─── Serviço público ──────────────────────────────────────────────────────────

export class GoldCorpusRegressionRunnerService {
  private readonly caseMap: Map<string, GoldCorpusCase>;

  constructor(private readonly reviewer: ReviewerLike) {
    this.caseMap = new Map(goldCorpusV1.map((c) => [c.id, c]));
  }

  async runAll(): Promise<GoldCorpusRegressionSummary> {
    const results = await Promise.all(
      goldCorpusGeneratedDocuments.map((doc) => this.runCase(doc)),
    );
    return buildRegressionSummary(results);
  }

  async runCase(document: GeneratedGoldCorpusDocument): Promise<GoldCorpusRegressionResult> {
    const caseSpec = this.caseMap.get(document.caseId);
    const unexpectedFindings: string[] = caseSpec?.unexpectedFindings ?? [];

    const request: AiLegalStrengthReviewRequest = {
      draft: document.text,
      classification: document.documentType,
      domain: document.domain,
      pieceType: document.documentType,
      audit: buildMinimalAudit(document),
    };

    const reviewResult = await this.reviewer.review(request);
    const actualFindingObjects = reviewResult.findings;
    const actualFindingTexts = actualFindingObjects.map(findingText);

    const actualScore = deriveScore(actualFindingObjects);

    const matchedExpectedFindings = document.expectedFindings.filter((expected) =>
      actualFindingTexts.some((actual) => findingMatches(expected, actual)),
    );

    const missingExpectedFindings = document.expectedFindings.filter(
      (e) => !matchedExpectedFindings.includes(e),
    );

    const unexpectedForbiddenFindings = actualFindingTexts.filter((actual) =>
      unexpectedFindings.some((forbidden) => findingMatches(forbidden, actual)),
    );

    const scorePass =
      actualScore >= document.expectedScoreRange.min &&
      actualScore <= document.expectedScoreRange.max;

    const findingPass = computeFindingPass(
      document.metadata.quality,
      document.expectedFindings,
      matchedExpectedFindings,
      actualFindingObjects,
    );

    const pass = scorePass && findingPass && unexpectedForbiddenFindings.length === 0;

    return {
      caseId: document.caseId,
      domain: document.domain,
      documentType: document.documentType,
      quality: document.metadata.quality,
      difficulty: document.metadata.difficulty,
      expectedScoreRange: {
        min: document.expectedScoreRange.min,
        max: document.expectedScoreRange.max,
      },
      actualScore,
      scorePass,
      expectedFindings: document.expectedFindings,
      actualFindings: actualFindingTexts,
      matchedExpectedFindings,
      missingExpectedFindings,
      unexpectedFindings,
      unexpectedForbiddenFindings,
      pass,
    };
  }
}

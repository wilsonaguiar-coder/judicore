/**
 * FASE 9.0.8.3 — Serviço de Revisão Humana
 *
 * Responsabilidades:
 * - Calcular HumanReviewSummary (aggregate + por provider + por domínio).
 * - Calcular HumanValidatedQualityScore.
 * - Amostrar casos para revisão humana respeitando distribuição de qualidade.
 *
 * Regras de design:
 * - Sem I/O, sem chamadas de rede, sem side effects.
 * - Nunca retorna NaN ou Infinity.
 * - Amostrador é determinístico (ordenação por caseId).
 * - Domínio inferido do prefixo do caseId (ex.: "RGPS-002" → "RGPS").
 */

import type {
  HumanReviewCaseEvaluation,
  HumanReviewFindingEvaluation,
  HumanReviewMetricSlice,
  HumanReviewSampleEntry,
  HumanReviewSamplerOptions,
  HumanReviewSummary,
  SampleableResult,
} from "./human-review.types.js";

// ─── Mapeamento de prefixo → domínio ─────────────────────────────────────────

const PREFIX_TO_DOMAIN: Record<string, string> = {
  RGPS: "RGPS",
  RPPS: "RPPS",
  TRAB: "TRABALHISTA",
  TRIB: "TRIBUTARIO",
  FAM: "FAMILIA",
  CONS: "CONSUMIDOR",
  CRIM: "CRIMINAL",
  FAZ: "FAZENDA_PUBLICA",
  AMB: "AMBIENTAL",
  CIV: "CIVEL",
  JEC: "JUIZADO_ESPECIAL",
};

function domainFromCaseId(caseId: string): string {
  const prefix = caseId.split("-").at(0) ?? "";
  return PREFIX_TO_DOMAIN[prefix] ?? "DESCONHECIDO";
}

// ─── Human Validated Quality Score ───────────────────────────────────────────

/**
 * Fórmula:
 *   correctnessRate * 0.40
 * + relevanceRate   * 0.30
 * + actionabilityRate * 0.20
 * + normalizedScore * 0.10
 *
 * normalizedScore = (averageScore - 1) / 4  →  escala 0–1
 */
function computeHVQS(
  legallyCorrectRate: number,
  relevanceRate: number,
  actionabilityRate: number,
  averageScore: number,
): number {
  const normalizedScore = averageScore === 0 ? 0 : (averageScore - 1) / 4;
  const hvqs =
    legallyCorrectRate * 0.40 +
    relevanceRate       * 0.30 +
    actionabilityRate   * 0.20 +
    normalizedScore     * 0.10;
  if (!isFinite(hvqs) || isNaN(hvqs)) return 0;
  return hvqs;
}

// ─── Cálculo de fatia de métricas ─────────────────────────────────────────────

function buildSlice(cases: HumanReviewCaseEvaluation[]): HumanReviewMetricSlice {
  if (cases.length === 0) {
    return {
      totalFindingsReviewed: 0,
      totalCasesReviewed: 0,
      legallyCorrectRate: 0,
      relevanceRate: 0,
      actionabilityRate: 0,
      averageScore: 0,
      humanValidatedQualityScore: 0,
    };
  }

  const allFindings: HumanReviewFindingEvaluation[] = cases.flatMap((c) => c.evaluations);
  const total = allFindings.length;

  if (total === 0) {
    return {
      totalFindingsReviewed: 0,
      totalCasesReviewed: cases.length,
      legallyCorrectRate: 0,
      relevanceRate: 0,
      actionabilityRate: 0,
      averageScore: 0,
      humanValidatedQualityScore: 0,
    };
  }

  let correctCount = 0;
  let relevantCount = 0;
  let actionableCount = 0;
  let scoreSum = 0;

  for (const f of allFindings) {
    if (f.isLegallyCorrect) correctCount++;
    if (f.isRelevant) relevantCount++;
    if (f.isActionable) actionableCount++;
    scoreSum += f.score;
  }

  const legallyCorrectRate = correctCount / total;
  const relevanceRate = relevantCount / total;
  const actionabilityRate = actionableCount / total;
  const averageScore = scoreSum / total;

  return {
    totalFindingsReviewed: total,
    totalCasesReviewed: cases.length,
    legallyCorrectRate,
    relevanceRate,
    actionabilityRate,
    averageScore,
    humanValidatedQualityScore: computeHVQS(legallyCorrectRate, relevanceRate, actionabilityRate, averageScore),
  };
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class HumanReviewService {

  // ─── Sumário ──────────────────────────────────────────────────────────────

  calculateSummary(evaluations: HumanReviewCaseEvaluation[]): HumanReviewSummary {
    const aggregate = buildSlice(evaluations);

    // Agrupar por provider
    const providerMap = new Map<string, HumanReviewCaseEvaluation[]>();
    for (const e of evaluations) {
      const list = providerMap.get(e.providerId) ?? [];
      list.push(e);
      providerMap.set(e.providerId, list);
    }
    const byProvider: Record<string, HumanReviewMetricSlice> = {};
    for (const [pid, cases] of providerMap) {
      byProvider[pid] = buildSlice(cases);
    }

    // Agrupar por domínio (inferido do caseId)
    const domainMap = new Map<string, HumanReviewCaseEvaluation[]>();
    for (const e of evaluations) {
      const domain = domainFromCaseId(e.caseId);
      const list = domainMap.get(domain) ?? [];
      list.push(e);
      domainMap.set(domain, list);
    }
    const byDomain: Record<string, HumanReviewMetricSlice> = {};
    for (const [domain, cases] of domainMap) {
      byDomain[domain] = buildSlice(cases);
    }

    return { ...aggregate, byProvider, byDomain };
  }

  // ─── Amostrador ───────────────────────────────────────────────────────────

  /**
   * Seleciona casos para revisão humana respeitando:
   * 1. Quantidade por provider (casesPerProvider).
   * 2. Ao menos 1 caso GOOD por provider (requireAtLeastOneGood).
   * 3. Ao menos 1 caso problemático por provider (requireAtLeastOneProblematic).
   * 4. Determinismo: seleção por ordem alfabética de caseId.
   */
  sampleForReview(
    results: SampleableResult[],
    options: HumanReviewSamplerOptions,
  ): HumanReviewSampleEntry[] {
    const { casesPerProvider, requireAtLeastOneGood, requireAtLeastOneProblematic } = options;

    // Agrupar por provider
    const byProvider = new Map<string, SampleableResult[]>();
    for (const r of results) {
      const list = byProvider.get(r.providerId) ?? [];
      list.push(r);
      byProvider.set(r.providerId, list);
    }

    const selected: HumanReviewSampleEntry[] = [];

    for (const [providerId, cases] of byProvider) {
      // Ordem determinística
      const sorted = [...cases].sort((a, b) => a.caseId.localeCompare(b.caseId));

      const good = sorted.filter((r) => r.quality === "GOOD");
      const problematic = sorted.filter(
        (r) => r.quality !== undefined && r.quality !== "GOOD",
      );

      const usedCaseIds = new Set<string>();
      const providerSelected: HumanReviewSampleEntry[] = [];

      function tryPick(
        pool: SampleableResult[],
        reason: HumanReviewSampleEntry["selectionReason"],
      ): void {
        if (providerSelected.length >= casesPerProvider) return;
        const candidate = pool.find((r) => !usedCaseIds.has(r.caseId));
        if (!candidate) return;
        usedCaseIds.add(candidate.caseId);
        providerSelected.push({
          caseId: candidate.caseId,
          providerId,
          quality: candidate.quality ?? null,
          selectionReason: reason,
        });
      }

      // Prioridade 1: caso GOOD
      if (requireAtLeastOneGood) tryPick(good, "good_representative");
      // Prioridade 2: caso problemático
      if (requireAtLeastOneProblematic) tryPick(problematic, "problematic_representative");
      // Preenchimento: casos restantes em ordem alfabética
      tryPick(sorted, "random");

      // Preencher até casesPerProvider com qualquer caso restante
      for (const r of sorted) {
        if (providerSelected.length >= casesPerProvider) break;
        if (usedCaseIds.has(r.caseId)) continue;
        usedCaseIds.add(r.caseId);
        providerSelected.push({
          caseId: r.caseId,
          providerId,
          quality: r.quality ?? null,
          selectionReason: "random",
        });
      }

      selected.push(...providerSelected);
    }

    return selected;
  }
}

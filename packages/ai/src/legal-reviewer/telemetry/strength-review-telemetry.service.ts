import { appendFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { anonymizeSnippet, anonymizeSuggestion } from "./anonymizer.js";
import type {
  TelemetryRecord,
  StrengthReviewExecutionRecord,
  StrengthReviewFeedbackRecord,
  StrengthReviewAnalytics,
  AnonymizedExample,
  FindingFrequency,
  FeedbackStats,
  FindingTelemetry,
} from "./telemetry.types.js";
import type { AiLegalStrengthFinding } from "../dto/ai-legal-strength-finding.js";

const DEFAULT_LOG_PATH = "./logs/strength-review.jsonl";
const MAX_EXAMPLES = 50;

export class StrengthReviewTelemetryService {
  private readonly logPath: string;
  /** Fallback em memória quando o sistema de arquivos não está disponível. */
  private memoryFallback: TelemetryRecord[] = [];
  private fileAvailable: boolean | null = null;

  constructor(logPath: string = process.env["STRENGTH_REVIEW_LOG_PATH"] ?? DEFAULT_LOG_PATH) {
    this.logPath = logPath;
  }

  // ── Gravação ────────────────────────────────────────────────────────────────

  recordExecution(params: {
    domain?: string;
    pieceType?: string;
    provider: string;
    model: string;
    findings: AiLegalStrengthFinding[];
    responseTimeMs: number;
  }): void {
    const findingTelemetry: FindingTelemetry[] = params.findings.map(f => ({
      findingType: f.type,
      opportunityLevel: f.opportunity,
      confidence: f.confidence,
      evidenceSnippet: f.evidenceFromText[0] ? anonymizeSnippet(f.evidenceFromText[0]) : undefined,
    }));

    const record: StrengthReviewExecutionRecord = {
      recordType: "EXECUTION",
      timestamp: new Date().toISOString(),
      domain: params.domain,
      pieceType: params.pieceType,
      provider: params.provider,
      model: params.model,
      findingCount: params.findings.length,
      responseTimeMs: params.responseTimeMs,
      findings: findingTelemetry,
    };

    this.append(record);
  }

  recordFeedback(params: {
    findingId: string;
    findingType: string;
    opportunityLevel: string;
    domain?: string;
    feedback: "USEFUL" | "NOT_USEFUL";
  }): void {
    const record: StrengthReviewFeedbackRecord = {
      recordType: "FEEDBACK",
      timestamp: new Date().toISOString(),
      findingId: params.findingId,
      findingType: params.findingType,
      opportunityLevel: params.opportunityLevel,
      domain: params.domain,
      feedback: params.feedback,
    };

    this.append(record);
  }

  // ── Analytics ───────────────────────────────────────────────────────────────

  getAnalytics(): StrengthReviewAnalytics {
    const records = this.readAll();
    const executions = records.filter((r): r is StrengthReviewExecutionRecord => r.recordType === "EXECUTION");
    const feedbackRecords = records.filter((r): r is StrengthReviewFeedbackRecord => r.recordType === "FEEDBACK");

    const allFindings = executions.flatMap(e => e.findings);
    const totalFindings = allFindings.length;

    return {
      totalExecutions: executions.length,
      totalFindings,
      avgFindingsPerExecution: executions.length
        ? Number((totalFindings / executions.length).toFixed(2))
        : 0,
      topFindingTypes: computeTopFindingTypes(allFindings, totalFindings),
      topFindingsByDomain: computeTopByDomain(executions),
      opportunityLevelDistribution: computeOpportunityDistribution(allFindings),
      providerStats: computeProviderStats(executions),
      feedbackStats: computeFeedbackStats(feedbackRecords),
      anonymizedExamples: collectExamples(executions),
    };
  }

  /** Retorna todos os registros brutos — para uso pelo CalibrationService. */
  getRawRecords(): TelemetryRecord[] {
    return this.readAll();
  }

  // ── I/O interno ─────────────────────────────────────────────────────────────

  private append(record: TelemetryRecord): void {
    const line = JSON.stringify(record) + "\n";

    if (this.fileAvailable !== false) {
      try {
        const dir = dirname(this.logPath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        appendFileSync(this.logPath, line, "utf8");
        this.fileAvailable = true;
        return;
      } catch {
        this.fileAvailable = false;
        // Silently fall through to memory fallback — telemetria nunca quebra o fluxo principal
      }
    }

    this.memoryFallback.push(record);
  }

  private readAll(): TelemetryRecord[] {
    if (this.fileAvailable !== false) {
      try {
        if (!existsSync(this.logPath)) return [...this.memoryFallback];
        const raw = readFileSync(this.logPath, "utf8");
        const fromFile = raw
          .split("\n")
          .filter(line => line.trim().length > 0)
          .map(line => {
            try { return JSON.parse(line) as TelemetryRecord; }
            catch { return null; }
          })
          .filter((r): r is TelemetryRecord => r !== null);
        return [...fromFile, ...this.memoryFallback];
      } catch {
        // se leitura falhar, usa apenas memória
      }
    }

    return [...this.memoryFallback];
  }
}

// ── Helpers de agregação ──────────────────────────────────────────────────────

function computeTopFindingTypes(findings: FindingTelemetry[], total: number): FindingFrequency[] {
  const counts: Record<string, number> = {};
  for (const f of findings) {
    counts[f.findingType] = (counts[f.findingType] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([type, count]) => ({
      type,
      count,
      percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function computeTopByDomain(
  executions: StrengthReviewExecutionRecord[],
): Record<string, FindingFrequency[]> {
  const byDomain: Record<string, FindingTelemetry[]> = {};
  for (const exec of executions) {
    const domain = exec.domain ?? "desconhecido";
    if (!byDomain[domain]) byDomain[domain] = [];
    byDomain[domain]!.push(...exec.findings);
  }
  const result: Record<string, FindingFrequency[]> = {};
  for (const [domain, findings] of Object.entries(byDomain)) {
    result[domain] = computeTopFindingTypes(findings, findings.length).slice(0, 5);
  }
  return result;
}

function computeOpportunityDistribution(findings: FindingTelemetry[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const f of findings) {
    dist[f.opportunityLevel] = (dist[f.opportunityLevel] ?? 0) + 1;
  }
  return dist;
}

function computeProviderStats(
  executions: StrengthReviewExecutionRecord[],
): Record<string, { executions: number; avgFindings: number; avgResponseTimeMs: number }> {
  const grouped: Record<string, StrengthReviewExecutionRecord[]> = {};
  for (const exec of executions) {
    if (!grouped[exec.provider]) grouped[exec.provider] = [];
    grouped[exec.provider]!.push(exec);
  }
  const result: Record<string, { executions: number; avgFindings: number; avgResponseTimeMs: number }> = {};
  for (const [provider, execs] of Object.entries(grouped)) {
    const avgFindings = execs.reduce((s, e) => s + e.findingCount, 0) / execs.length;
    const avgRt = execs.reduce((s, e) => s + e.responseTimeMs, 0) / execs.length;
    result[provider] = {
      executions: execs.length,
      avgFindings: Number(avgFindings.toFixed(2)),
      avgResponseTimeMs: Math.round(avgRt),
    };
  }
  return result;
}

function computeFeedbackStats(records: StrengthReviewFeedbackRecord[]): FeedbackStats {
  const usefulCount = records.filter(r => r.feedback === "USEFUL").length;
  const notUsefulCount = records.filter(r => r.feedback === "NOT_USEFUL").length;
  const total = records.length;

  const byType: Record<string, { useful: number; notUseful: number; usefulRate: number }> = {};
  for (const rec of records) {
    if (!byType[rec.findingType]) byType[rec.findingType] = { useful: 0, notUseful: 0, usefulRate: 0 };
    if (rec.feedback === "USEFUL") byType[rec.findingType]!.useful++;
    else byType[rec.findingType]!.notUseful++;
  }
  for (const key of Object.keys(byType)) {
    const entry = byType[key]!;
    const entryTotal = entry.useful + entry.notUseful;
    entry.usefulRate = entryTotal > 0 ? Number(((entry.useful / entryTotal) * 100).toFixed(1)) : 0;
  }

  return {
    totalFeedback: total,
    usefulCount,
    notUsefulCount,
    usefulRate: total > 0 ? Number(((usefulCount / total) * 100).toFixed(1)) : 0,
    byFindingType: byType,
  };
}

function collectExamples(executions: StrengthReviewExecutionRecord[]): AnonymizedExample[] {
  const examples: AnonymizedExample[] = [];
  for (const exec of executions) {
    for (const f of exec.findings) {
      if (examples.length >= MAX_EXAMPLES) break;
      if (!f.evidenceSnippet) continue;
      examples.push({
        findingType: f.findingType,
        opportunityLevel: f.opportunityLevel,
        evidenceSnippet: f.evidenceSnippet,
        suggestion: anonymizeSuggestion(f.evidenceSnippet), // snippet já anonimizado
        domain: exec.domain,
      });
    }
    if (examples.length >= MAX_EXAMPLES) break;
  }
  return examples;
}

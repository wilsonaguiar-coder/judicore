import { randomUUID } from "node:crypto";
import { AiLegalReviewerProvider } from "../providers/ai-legal-reviewer.provider.js";
import type { AiLegalReviewRequest } from "../dto/ai-legal-review-request.js";
import type { AiLegalReviewFinding } from "../dto/ai-legal-review-finding.js";
import type { AiLegalReviewResult } from "../dto/ai-legal-review-result.js";

const MIN_CONFIDENCE = 0.75;

export class AiLegalReviewerService {
  constructor(
    private readonly deepseekKey: string = process.env["DEEPSEEK_API_KEY"] ?? "",
    private readonly openaiKey: string = process.env["OPENAI_API_KEY"] ?? "",
  ) {}

  public async review(request: AiLegalReviewRequest): Promise<AiLegalReviewResult> {
    const provider = new AiLegalReviewerProvider(this.deepseekKey, this.openaiKey);

    let rawFindings = await provider.callWithFallback(request);

    // Confidence gate: discard findings below threshold
    rawFindings = rawFindings.filter(f =>
      typeof f.confidence === "number" && f.confidence >= MIN_CONFIDENCE
    );

    const findings: AiLegalReviewFinding[] = rawFindings.map(f => ({
      id: crypto.randomUUID(),
      type: f.type,
      severity: f.severity,
      title: f.title,
      explanation: f.explanation,
      evidenceFromText: Array.isArray(f.evidenceFromText) ? f.evidenceFromText : [],
      suggestedReview: f.suggestedReview,
      confidence: f.confidence,
      requiresHumanReview: true,
    }));

    return {
      findings,
      summary: buildSummary(findings),
      provider: provider.usedProvider,
      model: provider.usedModel,
      generatedAt: new Date(),
      requiresHumanReview: true,
    };
  }
}

function buildSummary(findings: AiLegalReviewFinding[]): string {
  if (findings.length === 0) {
    return "Nenhuma fragilidade qualitativa identificada pela IA.";
  }
  const high = findings.filter(f => f.severity === "HIGH").length;
  const medium = findings.filter(f => f.severity === "MEDIUM").length;
  const low = findings.filter(f => f.severity === "LOW").length;
  const parts: string[] = [];
  if (high > 0) parts.push(`${high} alta(s) severidade`);
  if (medium > 0) parts.push(`${medium} média(s)`);
  if (low > 0) parts.push(`${low} baixa(s)`);
  return `${findings.length} observação(ões) qualitativa(s): ${parts.join(", ")}. Revisão humana obrigatória.`;
}

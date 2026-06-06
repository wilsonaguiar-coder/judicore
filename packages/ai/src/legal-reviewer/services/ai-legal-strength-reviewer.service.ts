import { AiLegalStrengthReviewerProvider } from "../providers/ai-legal-strength-reviewer.provider.js";
import { StrengthReviewTelemetryService } from "../telemetry/strength-review-telemetry.service.js";
import { DomainKnowledgeRegistry } from "../domain-knowledge/domain-knowledge.registry.js";
import type { AiLegalStrengthReviewRequest } from "../dto/ai-legal-strength-review-request.js";
import type { AiLegalStrengthFinding } from "../dto/ai-legal-strength-finding.js";
import type { AiLegalStrengthReviewResult } from "../dto/ai-legal-strength-review-result.js";

const MIN_CONFIDENCE = 0.75;

export class AiLegalStrengthReviewerService {
  private readonly telemetry: StrengthReviewTelemetryService;

  constructor(
    private readonly deepseekKey: string = process.env["DEEPSEEK_API_KEY"] ?? "",
    private readonly openaiKey: string = process.env["OPENAI_API_KEY"] ?? "",
    telemetry?: StrengthReviewTelemetryService,
  ) {
    this.telemetry = telemetry ?? new StrengthReviewTelemetryService();
  }

  public async review(request: AiLegalStrengthReviewRequest): Promise<AiLegalStrengthReviewResult> {
    const provider = new AiLegalStrengthReviewerProvider(this.deepseekKey, this.openaiKey);
    return this._reviewWithProvider(request, provider);
  }

  /** Separado para facilitar injeção de provider mock nos testes. */
  public async _reviewWithProvider(
    request: AiLegalStrengthReviewRequest,
    provider: AiLegalStrengthReviewerProvider,
  ): Promise<AiLegalStrengthReviewResult> {
    const startTime = Date.now();

    // Resolve domain knowledge pack — respects explicit override on request
    const resolvedRequest: AiLegalStrengthReviewRequest = {
      ...request,
      domainKnowledgePack: request.domainKnowledgePack ?? DomainKnowledgeRegistry.get(request.domain),
    };

    let rawFindings = await provider.callWithFallback(resolvedRequest);

    rawFindings = rawFindings.filter(
      f => typeof f.confidence === "number" && f.confidence >= MIN_CONFIDENCE,
    );

    const findings: AiLegalStrengthFinding[] = rawFindings.map(f => ({
      id: crypto.randomUUID(),
      type: f.type,
      opportunity: f.opportunity,
      title: f.title,
      rationale: f.rationale,
      evidenceFromText: Array.isArray(f.evidenceFromText) ? f.evidenceFromText : [],
      suggestion: f.suggestion,
      availableSource: f.availableSource,
      confidence: f.confidence,
      requiresHumanReview: true,
    }));

    const result: AiLegalStrengthReviewResult = {
      findings,
      summary: buildSummary(findings),
      provider: provider.usedProvider,
      model: provider.usedModel,
      generatedAt: new Date(),
      requiresHumanReview: true,
    };

    // Telemetria — não bloqueia o retorno e nunca propaga exceção
    try {
      this.telemetry.recordExecution({
        domain: resolvedRequest.domain,
        pieceType: resolvedRequest.pieceType,
        provider: provider.usedProvider,
        model: provider.usedModel,
        findings,
        responseTimeMs: Date.now() - startTime,
      });
    } catch {
      // silencioso — telemetria nunca quebra o fluxo principal
    }

    return result;
  }
}

function buildSummary(findings: AiLegalStrengthFinding[]): string {
  if (findings.length === 0) {
    return "Peça sólida — nenhuma oportunidade de fortalecimento identificada.";
  }
  const impactful     = findings.filter(f => f.opportunity === "IMPACTFUL").length;
  const complementary = findings.filter(f => f.opportunity === "COMPLEMENTARY").length;
  const optional      = findings.filter(f => f.opportunity === "OPTIONAL").length;
  const parts: string[] = [];
  if (impactful > 0)     parts.push(`${impactful} impactante${impactful > 1 ? "s" : ""}`);
  if (complementary > 0) parts.push(`${complementary} complementar${complementary > 1 ? "es" : ""}`);
  if (optional > 0)      parts.push(`${optional} opcional${optional > 1 ? "is" : ""}`);
  return `${findings.length} oportunidade${findings.length > 1 ? "s" : ""} de fortalecimento identificada${findings.length > 1 ? "s" : ""}: ${parts.join(", ")}.`;
}

/**
 * FASE 9.0.8.1 — Adaptador Gemini para o Live Benchmark
 *
 * Cria um ReviewerLike que chama a Gemini REST API diretamente via fetch.
 * A chave NÃO é logada em nenhum erro ou log.
 */

import { buildStrengthReviewerPrompt } from "../prompts/strength-reviewer.prompt.js";
import { safeJsonParse } from "../providers/ai-legal-strength-reviewer.provider.js";
import { DomainKnowledgeRegistry } from "../domain-knowledge/domain-knowledge.registry.js";
import type { AiLegalStrengthReviewRequest } from "../dto/ai-legal-strength-review-request.js";
import type { AiLegalStrengthFinding } from "../dto/ai-legal-strength-finding.js";
import type { AiLegalStrengthReviewResult } from "../dto/ai-legal-strength-review-result.js";
import type { ReviewerLike } from "../gold-corpus/gold-corpus-regression.types.js";

const MIN_CONFIDENCE = 0.75;
const GEMINI_SYSTEM =
  "Você é um advogado sênior especializado em fortalecimento de peças jurídicas. " +
  "Retorne exclusivamente JSON válido.";

class GeminiReviewerService implements ReviewerLike {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async review(request: AiLegalStrengthReviewRequest): Promise<AiLegalStrengthReviewResult> {
    const resolvedRequest: AiLegalStrengthReviewRequest = {
      ...request,
      domainKnowledgePack: request.domainKnowledgePack ?? DomainKnowledgeRegistry.get(request.domain),
    };

    const prompt = buildStrengthReviewerPrompt(resolvedRequest);
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent` +
      `?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: GEMINI_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      }),
    });

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const rawFindings = (safeJsonParse(text) ?? []).filter(
      (f) => typeof f.confidence === "number" && f.confidence >= MIN_CONFIDENCE,
    );

    const findings: AiLegalStrengthFinding[] = rawFindings.map((f) => ({
      id: crypto.randomUUID(),
      type: f.type,
      opportunity: f.opportunity,
      title: f.title,
      rationale: f.rationale,
      evidenceFromText: Array.isArray(f.evidenceFromText) ? f.evidenceFromText : [],
      suggestion: f.suggestion,
      ...(f.availableSource !== undefined ? { availableSource: f.availableSource } : {}),
      confidence: f.confidence,
      requiresHumanReview: true,
    }));

    return {
      findings,
      summary:
        findings.length === 0
          ? "Peça sólida — nenhuma oportunidade de fortalecimento identificada."
          : `${findings.length} oportunidade${findings.length > 1 ? "s" : ""} de fortalecimento identificada${findings.length > 1 ? "s" : ""}.`,
      provider: "GEMINI",
      model: this.model,
      generatedAt: new Date(),
      requiresHumanReview: true,
    };
  }
}

/**
 * Cria um ReviewerLike para Gemini.
 * @param apiKey — chave da API. Usa GEMINI_API_KEY se não fornecida.
 * @param model  — modelo a usar (padrão: gemini-2.5-pro).
 * @throws Se a chave estiver ausente.
 */
export function createGeminiReviewer(apiKey?: string, model = "gemini-2.5-pro"): ReviewerLike {
  const key = apiKey ?? process.env["GEMINI_API_KEY"] ?? "";
  if (!key) {
    throw new Error(
      "Chave de API não configurada para provider: gemini. " +
      "Defina a variável de ambiente GEMINI_API_KEY.",
    );
  }
  return new GeminiReviewerService(key, model);
}

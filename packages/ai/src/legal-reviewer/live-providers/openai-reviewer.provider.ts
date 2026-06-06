/**
 * FASE 9.0.8.1 — Adaptador OpenAI para o Live Benchmark
 *
 * Cria um ReviewerLike usando o AiLegalStrengthReviewerService com chave OpenAI.
 * A chave NÃO é logada em nenhum erro ou log.
 */

import { AiLegalStrengthReviewerService } from "../services/ai-legal-strength-reviewer.service.js";
import type { ReviewerLike } from "../gold-corpus/gold-corpus-regression.types.js";

/**
 * Cria um ReviewerLike para OpenAI.
 * @param apiKey — chave da API. Usa OPENAI_API_KEY se não fornecida.
 * @throws Se a chave estiver ausente.
 */
export function createOpenAIReviewer(apiKey?: string): ReviewerLike {
  const key = apiKey ?? process.env["OPENAI_API_KEY"] ?? "";
  if (!key) {
    throw new Error(
      "Chave de API não configurada para provider: openai. " +
      "Defina a variável de ambiente OPENAI_API_KEY.",
    );
  }
  return new AiLegalStrengthReviewerService("", key);
}

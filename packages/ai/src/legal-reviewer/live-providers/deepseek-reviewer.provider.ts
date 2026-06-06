/**
 * FASE 9.0.8.1 — Adaptador DeepSeek para o Live Benchmark
 *
 * Cria um ReviewerLike usando o AiLegalStrengthReviewerService com chave DeepSeek.
 * A chave NÃO é logada em nenhum erro ou log.
 */

import { AiLegalStrengthReviewerService } from "../services/ai-legal-strength-reviewer.service.js";
import type { ReviewerLike } from "../gold-corpus/gold-corpus-regression.types.js";

/**
 * Cria um ReviewerLike para DeepSeek.
 * @param apiKey — chave da API. Usa DEEPSEEK_API_KEY se não fornecida.
 * @throws Se a chave estiver ausente.
 */
export function createDeepSeekReviewer(apiKey?: string): ReviewerLike {
  const key = apiKey ?? process.env["DEEPSEEK_API_KEY"] ?? "";
  if (!key) {
    throw new Error(
      "Chave de API não configurada para provider: deepseek. " +
      "Defina a variável de ambiente DEEPSEEK_API_KEY.",
    );
  }
  return new AiLegalStrengthReviewerService(key, "");
}

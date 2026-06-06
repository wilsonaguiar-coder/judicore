/** Máximo de caracteres preservados de um trecho de evidência. */
const MAX_SNIPPET_LENGTH = 120;

/**
 * Anonimiza um trecho textual para armazenamento em telemetria.
 *
 * Remove padrões de PII conhecidos (CPF, NB, número de processo)
 * e trunca para MAX_SNIPPET_LENGTH caracteres.
 *
 * Limitação intencional: nomes próprios requerem NER — não são removidos
 * automaticamente aqui. Por isso, trechos de evidência devem ser curtos
 * e nunca conter o draft completo.
 */
export function anonymizeSnippet(text: string): string {
  return text
    // CPF: 000.000.000-00 ou 00000000000
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]")
    // NB (benefício INSS): 000.000.000-0 ou similares (10 dígitos com pontuação)
    .replace(/\b\d{3}[\. ]?\d{3}[\. ]?\d{3}[-. ]?\d{1}\b/g, "[NB]")
    // Número de processo CNJ: 0000000-00.0000.0.00.0000
    .replace(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g, "[PROCESSO]")
    // Formato antigo de processo: 0000.00.000000-0
    .replace(/\b\d{4}\.\d{2}\.\d{6}-\d\b/g, "[PROCESSO]")
    // RG simplificado (7-9 dígitos com pontuação, pode variar por estado)
    .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dXx]\b/g, "[RG]")
    // Truncar
    .slice(0, MAX_SNIPPET_LENGTH)
    .trim();
}

/**
 * Anonimiza uma sugestão gerada pela IA antes do armazenamento.
 * Sugestões são texto gerado pela IA, raramente contém PII,
 * mas aplicamos o mesmo saneamento por precaução.
 */
export function anonymizeSuggestion(text: string): string {
  return anonymizeSnippet(text);
}

/**
 * Verifica se um texto parece conter PII após anonimização.
 * Útil para decidir se um trecho deve ser descartado da amostra.
 */
export function mightContainPii(text: string): boolean {
  const anonymized = anonymizeSnippet(text);
  return anonymized !== text; // se mudou, havia PII
}

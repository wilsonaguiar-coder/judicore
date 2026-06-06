import type { AiLegalReviewRequest } from "../dto/ai-legal-review-request.js";

export function buildLegalReviewerPrompt(request: AiLegalReviewRequest): string {
  const { draft, classification, domain, pieceType, audit, correctionPlan } = request;

  const fatalSummary = (audit.audit.fatalErrors ?? [])
    .map(e => `- [FATAL] ${e.titulo}: ${e.descricao}`)
    .join("\n");

  const warningSummary = (audit.audit.nonFatalErrors ?? [])
    .map(e => `- [ALERTA] ${e.titulo}: ${e.descricao}`)
    .join("\n");

  const planSummary = correctionPlan?.items?.length
    ? correctionPlan.items.map(i => `- [${i.priority}] ${i.area}: ${i.instruction}`).join("\n")
    : "Nenhum item de correção.";

  return `Você é um revisor jurídico especializado em análise crítica de peças processuais.

Você NÃO é julgador.
Você NÃO deve decidir a causa.
Você NÃO deve sugerir procedência ou improcedência.
Você NÃO deve inventar fatos, provas, documentos, leis ou jurisprudência.

CONTEXTO DA PEÇA:
- Classificação: ${classification}
${domain ? `- Domínio: ${domain}` : ""}
${pieceType ? `- Tipo: ${pieceType}` : ""}
- Score de qualidade técnica: ${audit.audit.score}
- Status: ${audit.audit.status}

ERROS DETECTADOS (análise determinística):
${fatalSummary || "Nenhum erro fatal."}
${warningSummary || "Nenhum alerta."}

PLANO DE CORREÇÃO:
${planSummary}

MINUTA PARA REVISÃO:
---
${draft}
---

Sua tarefa é identificar APENAS:
1. Requisitos legais apenas afirmados sem demonstração fática.
2. Afirmações jurídicas sem suporte probatório suficiente.
3. Ausência de documentos relevantes mencionados ou necessários.
4. Ausência de datas relevantes.
5. Ausência de cálculos necessários para quantificar o pedido.
6. Saltos lógicos entre premissas e conclusões.
7. Vulnerabilidades argumentativas exploráveis pela parte contrária.
8. Riscos processuais evidentes.
9. Pontos provavelmente questionáveis pelo magistrado.

REGRAS OBRIGATÓRIAS:
- Somente gere findings quando existir evidência textual clara extraída da própria minuta.
- Cada finding DEVE conter trechos literais do texto como evidência.
- Se houver dúvida sobre a relevância, NÃO gere o finding.
- NÃO repita achados já cobertos pelos erros da análise determinística acima.
- NÃO invente fatos, documentos, leis, artigos ou jurisprudência.
- NÃO faça recomendações de conteúdo jurídico — apenas aponte a fragilidade.

TIPOS DE FINDING DISPONÍVEIS:
INSUFFICIENT_FACTUAL_SUPPORT, CONCLUSORY_ASSERTION, LOGICAL_GAP,
MISSING_DOCUMENT_SUPPORT, MISSING_DATE_SUPPORT, MISSING_CALCULATION,
UNADDRESSED_VULNERABILITY, COUNTER_ARGUMENT_RISK, WEAK_ARGUMENTATION, LITIGATION_RISK

SEVERIDADES: HIGH, MEDIUM, LOW

Retorne EXCLUSIVAMENTE um array JSON válido, sem markdown, sem explicações fora do JSON:

[
  {
    "type": "TIPO_DO_FINDING",
    "severity": "HIGH|MEDIUM|LOW",
    "title": "Título conciso do problema",
    "explanation": "Explicação objetiva da fragilidade identificada.",
    "evidenceFromText": ["trecho literal do texto que evidencia o problema"],
    "suggestedReview": "Orientação genérica de revisão, sem inventar conteúdo.",
    "confidence": 0.0
  }
]

Se não houver findings com evidência textual clara, retorne: []`;
}

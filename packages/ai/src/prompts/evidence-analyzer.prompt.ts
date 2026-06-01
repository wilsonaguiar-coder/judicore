import type { LegalClassification, LegalExtraction, JurisprudenciaInput } from "../pipeline/types.js";

export function buildEvidenceAnalyzerPrompt(
  caseDescription: string,
  classification: LegalClassification,
  extraction: LegalExtraction,
  jurisprudencias: JurisprudenciaInput[],
): string {
  const teseResumida = [
    ...extraction.pedidos.map((p) => `• ${p}`),
    ...extraction.questoes_juridicas.slice(0, 3).map((q) => `• ${q}`),
  ].join("\n");

  const jursBlock = jurisprudencias
    .map(
      (j) =>
        `ID: "${j.id}"\nTribunal: ${j.tribunal}\nNúmero: ${j.numero}\nTema: ${j.tema}\nTese do precedente: ${j.tese}\nEmenta (resumo): ${j.ementa.slice(0, 400)}`,
    )
    .join("\n\n---\n\n");

  return `Você é um analista jurídico responsável por verificar se cada jurisprudência ou documento favorece ou prejudica a tese do usuário.

DESCRIÇÃO DO CASO:
${caseDescription.slice(0, 800)}

TESE DO USUÁRIO (pedidos e questões jurídicas identificados):
${teseResumida}

PARTES: Autor: ${classification.partes.autor} × Réu: ${classification.partes.reu}
REGIME: ${classification.regime_juridico ?? "geral"}
TIPO DE JUSTIÇA: ${classification.tipo_justica}
ASSUNTO: ${classification.assunto_principal}

JURISPRUDÊNCIAS/DOCUMENTOS A ANALISAR:
---
${jursBlock}
---

Para cada documento, classifique:

1. FAVORAVEL — a tese apoia diretamente o pedido do usuário.
2. CONTRARIO — a tese rejeita, limita ou enfraquece o pedido do usuário.
3. NEUTRO — trata de tema relacionado (prescrição, competência, prova), mas não decide a questão central.
4. INCONCLUSIVO — impossível saber a posição com o texto fornecido.

Mapeamento de use_mode:
- FAVORAVEL → FOUNDATION (pode fundamentar diretamente)
- CONTRARIO com distinguishing viável → COUNTER_ARGUMENT (apenas refutação)
- CONTRARIO sem distinguishing viável → DISCARD
- NEUTRO → CONTEXT_ONLY
- INCONCLUSIVO → DISCARD

Retorne SOMENTE JSON válido:
{
  "analyses": [
    {
      "id": "id_exato_da_jurisprudencia",
      "stance": "FAVORAVEL | CONTRARIO | NEUTRO | INCONCLUSIVO",
      "use_mode": "FOUNDATION | COUNTER_ARGUMENT | DISCARD | CONTEXT_ONLY",
      "confidence": 0.0,
      "tese_extraida": "tese central do precedente em 1-2 frases",
      "fundamento_da_classificacao": "por que este precedente favorece/prejudica a tese do usuário",
      "pode_citar_na_peca": true,
      "regra_de_uso": "instrução específica de como usar (ou não usar) este precedente na peça"
    }
  ]
}

CRITÉRIOS ESPECÍFICOS:
- decisão nega o direito pleiteado → CONTRARIO
- decisão reconhece/afirma o direito pleiteado → FAVORAVEL
- decisão só trata de competência, prova, prescrição → NEUTRO
- texto insuficiente para determinar a posição → INCONCLUSIVO → DISCARD
- confidence >= 0.85 apenas quando a tese for inequívoca no texto
- pode_citar_na_peca = true apenas para FOUNDATION e COUNTER_ARGUMENT

Retorne SOMENTE o JSON, sem texto adicional.`;
}

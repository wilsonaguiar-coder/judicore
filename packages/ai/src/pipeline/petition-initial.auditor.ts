import { getOpenAIClient } from "../client.js";
import type { InitialPetitionAuditReport, LegalClassification, ArgumentationMatrix, ServiceUsage } from "./types.js";
import { LegalCitationValidator } from "../validators/legal-citation.validator.js";
import { ThesisCoherenceValidator } from "../validators/thesis-coherence.validator.js";
import { RequestConsistencyValidator } from "../validators/request-consistency.validator.js";
import { DomainMismatchValidator } from "../validators/domain-mismatch.validator.js";
import { PieceBrief } from "../generation-pipeline/piece-brief.service.js";

const AUDIT_MODEL = "gpt-5.5";

export class PetitionInitialAuditor {
  async audit(
    draft: string,
    classification: LegalClassification,
    matrix: ArgumentationMatrix,
    brief: PieceBrief,
    rankingReport?: unknown
  ): Promise<{ audit: InitialPetitionAuditReport; usage: ServiceUsage }> {
    const client = getOpenAIClient();

    // Montar as regras de validação baseadas no domínio e contexto
    const legalCitationRules = LegalCitationValidator.buildPromptRules(matrix);
    const thesisCoherenceRules = ThesisCoherenceValidator.buildPromptRules(brief);
    const requestConsistencyRules = RequestConsistencyValidator.buildPromptRules();
    const domainMismatchRules = DomainMismatchValidator.buildPromptRules(classification);

    const systemPrompt = `# JUDICORE — AUDITOR DE PETIÇÃO INICIAL (SÓCIO REVISOR DE COERÊNCIA LEGAL)

Você é o Sócio Revisor Jurídico. O foco da sua auditoria é estritamente a COERÊNCIA JURÍDICA E ESTRATÉGICA da Petição Inicial. 
Sua prioridade absoluta é detectar: jurisprudência inexistente ou mal aplicada, leis inexistentes, confusão de regimes jurídicos, teses incompatíveis com os pedidos, e pedidos não amparados nos fatos.

A ausência de documentos comprobatórios no corpo da peça NÃO deve rebaixar a avaliação e NÃO é erro (os documentos são anexados pelo advogado no momento do protocolo). Aponte documentos apenas como um checklist auxiliar.

## 1. AUDITORIA DE TEXTO
Avalie: clareza, organização, coerência interna, repetição excessiva, linguagem artificial, trechos confusos, saltos de numeração e pedidos mal redigidos. Indique alterações necessárias no texto.

## 2. AUDITORIA DE LEIS E JURISPRUDÊNCIAS (CRÍTICO)
Verifique se a peça cita leis/artigos inexistentes, súmulas/temas inexistentes, ou precedentes mal aplicados/inventados.
CRITÉRIO FUNDAMENTAL: Se a peça citar jurisprudência ou dispositivo que NÃO conste na LegalMatrix fornecida, marque a gravidade como "ALERTA CRÍTICO — CITAÇÃO FORA DA MATRIZ".

\${legalCitationRules}

## 3. AUDITORIA DE TESES DEFENDIDAS
Avalie se a tese decorre dos fatos, se pertence ao domínio correto e se não mistura regimes incompatíveis. Reprove teses juridicamente incompatíveis ou que ignoram precedentes contrários vinculantes.

\${thesisCoherenceRules}

## 4. PEDIDOS E DOMÍNIO
Avalie se o pedido decorre logicamente da tese. Verifique se as normas aplicadas pertencem ao regime correto.

\${requestConsistencyRules}
\${domainMismatchRules}

## FORMATO DE RESPOSTA OBRIGATÓRIO (JSON)

Você deve retornar EXATAMENTE e APENAS o JSON no formato abaixo:
\`\`\`json
{
  "verdict": "APROVADA | APROVADA COM AJUSTES | REVISÃO NECESSÁRIA | REPROVADA",
  "score": 0 a 100,
  "strengths": ["ponto forte 1", "ponto forte 2"],
  "textIssues": [
    { "trecho": "texto exato", "tipo": "clareza|repetição|etc", "gravidade": "ALTA|MEDIA|BAIXA", "sugestao": "correção" }
  ],
  "legalCitationIssues": [
    { "trecho": "texto exato", "tipo": "artigo inexistente|citação fora da matriz", "gravidade": "ALERTA CRÍTICO — CITAÇÃO FORA DA MATRIZ|ALTA|MEDIA", "sugestao": "correção" }
  ],
  "thesisIssues": [
    { "tese": "descrição da tese", "problema": "motivo do erro", "impacto": "impacto processual", "correcao": "sugestão" }
  ],
  "requestIssues": [
    { "trecho": "pedido exato", "problema": "motivo", "correcao": "sugestão" }
  ],
  "documentChecklist": ["documento 1", "documento 2"],
  "mandatoryChanges": ["alteração obrigatória 1"],
  "recommendedChanges": ["alteração recomendada 1"]
}
\`\`\`

## CRITÉRIOS DE REPROVAÇÃO / VEREDICTO
- REPROVADA: apenas se houver jurisprudência inexistente (alucinação) usada como fundamento central, artigo inexistente, precedente contrário ignorado, tese juridicamente impossível, pedido incompatível com a causa de pedir, confusão grave de regime jurídico.
- APROVADA: se os problemas forem puramente estilísticos ou documentais menores.
- NUNCA reprove por falta de documentos ou cálculos exatos no texto da peça.
`;

    const userContent = [
      `DADOS EXTRAÍDOS (PieceBrief):`,
      JSON.stringify(brief, null, 2),
      `---`,
      `LEGAL MATRIX AUTORIZADA (apenas estas citações são 100% seguras):`,
      JSON.stringify(matrix, null, 2),
      `---`,
      `RANKING REPORT:`,
      rankingReport ? JSON.stringify(rankingReport, null, 2) : "Nenhum ranking report fornecido.",
      `---`,
      `TIPO DE PEÇA: ${classification.tipo_peca}`,
      `DOMÍNIO DETECTADO: ${classification.regime_juridico} / ${classification.tipo_justica}`,
      `---`,
      `PEÇA GERADA A SER AUDITADA:`,
      draft
    ].join("\\n");

    const response = await client.chat.completions.create({
      model: AUDIT_MODEL,
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const rawContent = response.choices[0]?.message?.content ?? "{}";
    // Extrai o JSON mesmo que o modelo envolva em bloco markdown ```json ... ```
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = jsonMatch ? jsonMatch[1].trim() : rawContent.trim();
    let parsed: InitialPetitionAuditReport;
    try {
      parsed = JSON.parse(raw) as InitialPetitionAuditReport;
    } catch {
      throw new Error(`Auditor retornou JSON inválido: ${raw.slice(0, 200)}`);
    }

    return {
      audit: parsed,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model: AUDIT_MODEL,
      },
    };
  }
}

import { getOpenAIClient } from "../client.js";
import type { InitialPetitionAuditReport, LegalClassification, ArgumentationMatrix, ServiceUsage } from "./types.js";
import { LegalCitationValidator } from "../validators/legal-citation.validator.js";
import { ThesisCoherenceValidator } from "../validators/thesis-coherence.validator.js";
import { RequestConsistencyValidator } from "../validators/request-consistency.validator.js";
import { DomainMismatchValidator } from "../validators/domain-mismatch.validator.js";
import { PieceBrief } from "../generation-pipeline/piece-brief.service.js";

const AUDIT_MODEL = "gpt-5.5";

/** Garante que campos que devem ser arrays sejam arrays, mesmo quando vêm do banco como string. */
function normalizeBrief(brief: any): PieceBrief {
  const toArr = (v: any): string[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim()) return [v];
    return [];
  };
  return {
    ...brief,
    fatosRelevantes: toArr(brief?.fatosRelevantes),
    palavrasChave: toArr(brief?.palavrasChave),
    tesesIdentificadas: toArr(brief?.tesesIdentificadas),
    pedidosIdentificados: toArr(brief?.pedidosIdentificados),
    pontosControvertidos: toArr(brief?.pontosControvertidos),
    pontosIncontroversos: toArr(brief?.pontosIncontroversos),
    riscosIdentificados: toArr(brief?.riscosIdentificados),
    lacunasIdentificadas: toArr(brief?.lacunasIdentificadas),
    documentosRelevantes: toArr(brief?.documentosRelevantes),
  };
}

export class PetitionInitialAuditor {
  async audit(
    draft: string,
    classification: LegalClassification,
    matrix: ArgumentationMatrix,
    brief: PieceBrief,
    rankingReport?: unknown
  ): Promise<{ audit: InitialPetitionAuditReport; usage: ServiceUsage }> {
    const client = getOpenAIClient();
    const normalizedBrief = normalizeBrief(brief);

    // Montar as regras de validação baseadas no domínio e contexto
    const legalCitationRules = LegalCitationValidator.buildPromptRules(matrix);
    const thesisCoherenceRules = ThesisCoherenceValidator.buildPromptRules(normalizedBrief);
    const requestConsistencyRules = RequestConsistencyValidator.buildPromptRules();
    const domainMismatchRules = DomainMismatchValidator.buildPromptRules(classification);

    const systemPrompt = `# JUDICORE — AUDITOR DE PETIÇÃO INICIAL (SÓCIO REVISOR)

Você atua como um Sócio Revisor Jurídico experiente. Sua missão NÃO é agir como um juiz analisando o mérito ("essa ação vai ganhar?"), mas sim garantir a segurança e técnica processual antes do protocolo.
Sua pergunta central de avaliação é: **"Eu deixaria meu associado protocolar esta peça amanhã?"**

## ORDEM DE PRIORIDADE DA AUDITORIA
- PRIORIDADE 1 (50%) — COERÊNCIA JURÍDICA MATERIAL: Jurisprudência/leis inexistentes, Tema/Súmula inexistente, precedente mal aplicado ou fora da ratio decidendi, lei incompatível, mistura grave de regimes jurídicos. (Gera: REVISÃO NECESSÁRIA ou REPROVADA).
- PRIORIDADE 2 (30%) — FATOS INVENTADOS: Fatos centrais categóricos sem suporte no PieceBrief.
- PRIORIDADE 3 (15%) — TÉCNICA PROCESSUAL: Revelia contra Fazenda, honorários, valor da causa, audiência. (Gera: AJUSTES RECOMENDADOS).
- PRIORIDADE 4 (5%) — ESTILO: Repetições, numeração, clareza, juridiquês. (Gera: Sugestões).

\${legalCitationRules}
\${thesisCoherenceRules}
\${requestConsistencyRules}
\${domainMismatchRules}

## FORMATO DE RESPOSTA OBRIGATÓRIO (JSON)
Você deve retornar EXATAMENTE e APENAS o JSON no formato abaixo:
\`\`\`json
{
  "verdict": "APROVADA | APROVADA COM AJUSTES | REVISÃO NECESSÁRIA | REPROVADA",
  "score": 0, // 0 a 100
  "strengths": ["Ponto forte 1", "Ponto forte 2"],
  "mandatoryChanges": [
    { "category": "MATERIAL|TÉCNICA", "severity": "CRÍTICA|ALTA", "excerpt": "trecho exato da peça", "issue": "descrição do erro", "suggestion": "como corrigir" }
  ],
  "recommendedChanges": [
    { "category": "ESTILO|PROCESSUAL", "severity": "MÉDIA|BAIXA", "excerpt": "trecho opcional", "issue": "descrição", "suggestion": "como melhorar" }
  ],
  "materialRisks": [
    { "category": "FATO INVENTADO|TESE ARRISCADA", "severity": "ALTA|CRÍTICA", "excerpt": "trecho do fato", "issue": "afirmação não suportada", "suggestion": "reavaliar afirmação" }
  ],
  "documentChecklist": ["documento 1", "documento 2"]
}
\`\`\`

## CRITÉRIOS E CALIBRAGEM DE VEREDICTO E NOTA
A sua decisão final deve seguir EXATAMENTE a seguinte escala de nota e regras:

- **APROVADA (85 a 100):** Peça perfeita ou com erros de estilo irrelevantes.
- **APROVADA COM AJUSTES (70 a 84):** Peça sólida na tese central, mas que exige correções pontuais e redacionais.
- **REVISÃO NECESSÁRIA (50 a 69):** Reservado APENAS se a tese central estiver juridicamente mal construída, precedente central errado/mal aplicado, confusão grave de regime jurídico, fato central inventado sem estratégia de correção, ou pedidos incompatíveis com a causa de pedir.
- **REPROVADA (0 a 49):** Reservado SOMENTE para: jurisprudência inexistente como fundamento central, lei/artigo inexistente central, tese juridicamente impossível ou fato central inventado que sustenta toda a tese e não tem conserto.

**REGRA DE OURO DO SÓCIO REVISOR:**
"Eu deixaria meu associado protocolar esta peça amanhã **APÓS** corrigir os ajustes pontuais apontados?"
- Se SIM -> O veredicto DEVE ser **APROVADA COM AJUSTES**.
- Se a peça merecer APROVADA COM AJUSTES devido à natureza pontual dos erros, mas você tiver calculado internamente uma nota 68, você DEVE elevar a nota para a faixa 70–74 e garantir que o veredicto seja APROVADA COM AJUSTES.
- O \`documentChecklist\` é puramente auxiliar e NÃO PODE reduzir a nota ou rebaixar o veredicto.`;

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
    ].join("\n");

    const response = await client.chat.completions.create({
      model: AUDIT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const rawContent = response.choices[0]?.message?.content ?? "";
    console.log(`[PetitionInitialAuditor] Raw response length: ${rawContent.length}, finishReason: ${response.choices[0]?.finish_reason}`);

    // Estratégia de extração de JSON com múltiplos fallbacks
    let raw = rawContent.trim();

    // Fallback 1: Extrair de bloco markdown ```json ... ```
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      raw = jsonMatch[1].trim();
    }

    // Fallback 2: Se ainda não começa com {, encontrar o primeiro { e último }
    if (!raw.startsWith("{")) {
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        raw = raw.substring(firstBrace, lastBrace + 1);
      }
    }

    let parsed: InitialPetitionAuditReport;
    try {
      if (!raw) throw new Error("Raw content is empty");
      parsed = JSON.parse(raw) as InitialPetitionAuditReport;
    } catch {
      console.error(`[PetitionInitialAuditor] JSON parse failed. Raw: ${rawContent.slice(0, 500)}`);
      throw new Error(`Auditor retornou JSON inválido. Finish Reason: ${response.choices?.[0]?.finish_reason}. Content length: ${rawContent.length}. Response Dump: ${JSON.stringify(response).slice(0, 300)}`);
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

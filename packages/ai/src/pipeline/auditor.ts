import { getOpenAIClient } from "../client.js";
import type { LegalClassification, ArgumentationMatrix, LegalAudit, ServiceUsage } from "./types.js";
import { buildAuditPrompt } from "../prompts/auditor.prompt.js";

const AUDIT_MODEL = "gpt-4.1";

export class LegalAuditService {
  async audit(
    draft: string,
    classification: LegalClassification,
    matrix: ArgumentationMatrix,
  ): Promise<{ audit: LegalAudit; usage: ServiceUsage }> {
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: AUDIT_MODEL,
      temperature: 0,
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Você é um auditor jurídico sênior. Sua função é identificar erros técnicos em peças jurídicas. Retorne SOMENTE JSON válido.",
        },
        {
          role: "user",
          content: buildAuditPrompt(draft, classification, matrix),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`Auditor retornou JSON inválido: ${raw.slice(0, 200)}`);
    }

    const audit: LegalAudit = {
      aprovada: (parsed["aprovada"] as boolean | undefined) ?? false,
      score: (parsed["score"] as number | undefined) ?? 0,
      erros: (parsed["erros"] as LegalAudit["erros"] | undefined) ?? [],
      resumo: (parsed["resumo"] as string | undefined) ?? "",
    };

    return {
      audit,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model: AUDIT_MODEL,
      },
    };
  }
}

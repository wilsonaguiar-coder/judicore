import { getOpenAIClient } from "../client.js";
import type { LegalClassification, ArgumentationMatrix, LegalAudit, ServiceUsage, DocumentStatus, AuditError } from "./types.js";
import { buildAuditPrompt } from "../prompts/auditor.prompt.js";

const AUDIT_MODEL = "gpt-5.5";

function mapSeveridade(sev: string): AuditError["severidade"] {
  switch (sev.toUpperCase()) {
    case "CRITICO": return "CRITICO";
    case "ALTO": return "IMPORTANTE";
    case "MEDIO": return "IMPORTANTE";
    case "BAIXO": return "SUGESTAO";
    default: return "SUGESTAO";
  }
}

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

    // Extrai campos comuns
    const aprovada = (parsed["aprovada"] as boolean | undefined) ?? false;
    const score = (parsed["score"] as number | undefined) ?? 0;
    const resumo = (parsed["resumo"] as string | undefined) ?? "";

    // Campos do novo formato JUDICORE (petição inicial)
    const aprovacaoGeral = (parsed["aprovacao_geral"] as string | undefined)
      ?? (aprovada ? "APROVADA" : "REPROVADA");
    const statusMinuta: DocumentStatus =
      aprovacaoGeral === "APROVADA" ? "MINUTA APROVADA"
      : aprovacaoGeral === "REPROVADA" ? "REPROVADA"
      : "APROVADA COM RESSALVAS";

    const fortalezas = (parsed["fortalezas"] as string[] | undefined) ?? (parsed["pontos_fortes"] as string[] | undefined) ?? [];
    const sugestoesReforco = (parsed["sugestoes_reforco"] as string[] | undefined) ?? (parsed["pontos_fracos"] as string[] | undefined) ?? [];
    const riscoProcessual = (parsed["risco_processual"] as string | undefined) ?? "";
    const riscoJustificativa = (parsed["risco_justificativa"] as string | undefined) ?? "";

    // Compatibilidade dupla: novo formato "alertas" ou antigo "erros"
    let alertasRaw: unknown[] | undefined;
    if (Array.isArray(parsed["alertas"]) && parsed["alertas"].length > 0) {
      alertasRaw = parsed["alertas"] as unknown[];
    }
    const errosRaw: unknown[] = Array.isArray(parsed["erros"]) ? (parsed["erros"] as unknown[]) : [];

    // Se veio do novo formato, converte alertas para erros (compatibilidade com frontend)
    const errosConvertidos: AuditError[] = [];
    if (alertasRaw && alertasRaw.length > 0) {
      for (const a of alertasRaw) {
        const alerta = a as Record<string, unknown>;
        errosConvertidos.push({
          tipo: (alerta["tipo"] as string) ?? "OUTRO",
          trecho: (alerta["trecho"] as string) ?? "",
          correcao: (alerta["sugestao"] as string) ?? (alerta["descricao"] as string) ?? "",
          severidade: mapSeveridade((alerta["severidade"] as string) ?? "MEDIO"),
        });
      }
    }

    // Se não veio do novo formato, usa os erros antigos diretamente
    const errosFinais: AuditError[] =
      errosConvertidos.length > 0
        ? errosConvertidos
        : (errosRaw as AuditError[]);

    // Monta o resumo enriquecido se houver campos novos
    let resumoFinal = resumo;
    if (riscoProcessual) {
      resumoFinal += ` | Risco processual: ${riscoProcessual}`;
      if (riscoJustificativa) resumoFinal += ` — ${riscoJustificativa}`;
    }

    const audit: LegalAudit = {
      aprovada,
      score,
      erros: errosFinais,
      resumo: resumoFinal,
      status_minuta: statusMinuta,
      ressalvas: [
        ...fortalezas,
        ...sugestoesReforco,
      ],
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
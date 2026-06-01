import { getOpenAIClient } from "../client.js";
import type {
  LegalClassification,
  LegalExtraction,
  JurisprudenciaInput,
  EvidenceAnalysis,
  EvidenceStance,
  EvidenceUseMode,
  ServiceUsage,
} from "./types.js";
import { buildEvidenceAnalyzerPrompt } from "../prompts/evidence-analyzer.prompt.js";

const EVIDENCE_MODEL = "gpt-4.1";

const VALID_STANCES = new Set<EvidenceStance>(["FAVORAVEL", "CONTRARIO", "NEUTRO", "INCONCLUSIVO"]);
const VALID_USE_MODES = new Set<EvidenceUseMode>(["FOUNDATION", "COUNTER_ARGUMENT", "DISCARD", "CONTEXT_ONLY"]);

export class EvidenceAnalyzerService {
  async analyze(
    caseDescription: string,
    classification: LegalClassification,
    extraction: LegalExtraction,
    jurisprudencias: JurisprudenciaInput[],
  ): Promise<{ analyses: EvidenceAnalysis[]; usage: ServiceUsage }> {
    if (jurisprudencias.length === 0) {
      return { analyses: [], usage: { inputTokens: 0, outputTokens: 0, model: EVIDENCE_MODEL } };
    }

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: EVIDENCE_MODEL,
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Você é um analista jurídico especialista em classificação de precedentes. Retorne SOMENTE JSON válido.",
        },
        {
          role: "user",
          content: buildEvidenceAnalyzerPrompt(caseDescription, classification, extraction, jurisprudencias),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`EvidenceAnalyzer retornou JSON inválido: ${raw.slice(0, 200)}`);
    }

    const rawAnalyses = (parsed["analyses"] as unknown[] | undefined) ?? [];
    const validIds = new Set(jurisprudencias.map((j) => j.id));

    const analyses: EvidenceAnalysis[] = rawAnalyses
      .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null)
      .filter((a) => typeof a["id"] === "string" && validIds.has(a["id"] as string))
      .map((a): EvidenceAnalysis => {
        const stanceRaw = a["stance"] as string | undefined;
        const useModeRaw = a["use_mode"] as string | undefined;
        const stance: EvidenceStance =
          stanceRaw !== undefined && VALID_STANCES.has(stanceRaw as EvidenceStance)
            ? (stanceRaw as EvidenceStance)
            : "INCONCLUSIVO";
        const use_mode: EvidenceUseMode =
          useModeRaw !== undefined && VALID_USE_MODES.has(useModeRaw as EvidenceUseMode)
            ? (useModeRaw as EvidenceUseMode)
            : "DISCARD";
        return {
          id: a["id"] as string,
          stance,
          use_mode,
          confidence:
            typeof a["confidence"] === "number"
              ? Math.min(1, Math.max(0, a["confidence"]))
              : 0.5,
          tese_extraida: typeof a["tese_extraida"] === "string" ? a["tese_extraida"] : "",
          fundamento_da_classificacao:
            typeof a["fundamento_da_classificacao"] === "string"
              ? a["fundamento_da_classificacao"]
              : "",
          pode_citar_na_peca:
            typeof a["pode_citar_na_peca"] === "boolean"
              ? a["pode_citar_na_peca"]
              : use_mode === "FOUNDATION" || use_mode === "COUNTER_ARGUMENT",
          regra_de_uso: typeof a["regra_de_uso"] === "string" ? a["regra_de_uso"] : "",
        };
      });

    // Qualquer jurisprudência não analisada → DISCARD como fallback seguro
    for (const jur of jurisprudencias) {
      if (!analyses.some((a) => a.id === jur.id)) {
        analyses.push({
          id: jur.id,
          stance: "INCONCLUSIVO",
          use_mode: "DISCARD",
          confidence: 0,
          tese_extraida: "",
          fundamento_da_classificacao: "Não analisado — descartado por precaução",
          pode_citar_na_peca: false,
          regra_de_uso: "Não usar na peça — análise de posicionamento indisponível",
        });
      }
    }

    return {
      analyses,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model: EVIDENCE_MODEL,
      },
    };
  }
}

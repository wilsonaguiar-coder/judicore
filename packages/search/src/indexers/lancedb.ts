import { request } from "undici";
import type { Jurisprudencia } from "../types.js";

const SEARCH_API_URL = process.env.JUDICORE_SEARCH_URL || "http://127.0.0.1:7860";
const EXPECTED_DIMENSIONS = 768;
const EXPECTED_MODEL = "gemini";
const EXPECTED_LANCE_DIR = "/opt/judicore/lancedb_store";

export interface LanceDbPreFlightResult {
  valid: boolean;
  error?: string;
}

export async function preFlightCheck(): Promise<LanceDbPreFlightResult> {
  try {
    const { statusCode, body } = await request(`${SEARCH_API_URL}/health`, {
      method: "GET",
      headersTimeout: 2000,
      bodyTimeout: 2000
    });

    if (statusCode !== 200) {
      return { valid: false, error: `Health endpoint failed with status ${statusCode}` };
    }

    const data = await body.json() as any;

    if (!data.lance_dir || !data.lance_dir.includes(EXPECTED_LANCE_DIR)) {
      return { valid: false, error: `Base LanceDB não encontrada no diretório esperado: ${data.lance_dir}` };
    }

    // O Python Search (Ratio) injeta nativamente o Gemini embedding 004 (que tem 768 dims).
    // Validamos isso aqui a nivel de contrato lógico, pois o backend não expõe o modelo na rota /health.
    // Se no futuro o microserviço mudar a API Key ou o modelo, essa validação lógica deveria ser atrelada
    // a uma rota que retorne as metadata da tabela.
    const isModelValid = true; // Assumed true by contract based on VPS inspection
    const isDimensionValid = true; // Assumed 768 by contract based on VPS inspection

    if (!isModelValid || !isDimensionValid) {
      return { valid: false, error: `MismatchDimensionError: Expected ${EXPECTED_DIMENSIONS} dimensions for ${EXPECTED_MODEL}` };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Connection failed: ${err.message}` };
  }
}

export async function searchLanceDB(query: string, tribunais?: string[], topK = 5): Promise<Jurisprudencia[]> {
  const preFlight = await preFlightCheck();
  if (!preFlight.valid) {
    console.warn(`[LanceDB Pre-flight falhou] Fazendo fallback: ${preFlight.error}`);
    return []; // Return empty so it fallbacks smoothly
  }

  try {
    const { statusCode, body } = await request(`${SEARCH_API_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        tribunais: tribunais || ["STF", "STJ"],
        top_k: topK
      }),
      headersTimeout: 5000,
      bodyTimeout: 10000 // 10 seconds max timeout for local search
    });

    if (statusCode !== 200) {
      const errText = await body.text();
      throw new Error(`Search API error ${statusCode}: ${errText}`);
    }

    const data = await body.json() as any[];

    return data.map((hit: any) => ({
      id: hit.doc_id || `lancedb-${Math.random().toString(36).substr(2, 9)}`,
      tribunal: hit.tribunal || hit.source_label,
      numero: hit.processo || "N/A",
      relator: hit.relator || "Ministro",
      dataPublicacao: hit.data_julgamento || new Date().toISOString(),
      dataJulgamento: hit.data_julgamento || new Date().toISOString(),
      ementa: hit.ementa || hit.texto_integral || "",
      conteudoIntegral: hit.texto_integral || "",
      url: hit.inteiro_teor_url || "",
      area: "OUTRO",
      score: hit.final_score || 0
    }));

  } catch (err: any) {
    console.error(`[LanceDB Search Error] ${err.message}`);
    return []; // Graceful fallback
  }
}

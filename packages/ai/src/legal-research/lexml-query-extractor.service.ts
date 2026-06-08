import { env } from "process";

export interface LexmlQuerySet {
  juri: string[];
  legis: string[];
}

export class LexmlQueryExtractorService {
  static async extractQueriesForAll(
    teses: string[],
    tipoPeca: string,
    palavrasChave: string[]
  ): Promise<LexmlQuerySet[]> {
    const apiKey = env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente");

    const teseListing = teses
      .map((t, i) => `Tese ${i}: "${t}"`)
      .join("\n");

    const prompt = `Você é um pesquisador jurídico especializado em busca em bases de dados brasileiras (LexML, STF, STJ).

TIPO DE PEÇA: ${tipoPeca}
TERMOS-CHAVE DO CASO (gerados pelo analista): ${palavrasChave.slice(0, 8).join(" | ")}

TESES IDENTIFICADAS NO CASO:
${teseListing}

Para CADA tese, gere:
- 2 a 3 queries de busca para jurisprudência ("juri"): termos técnicos jurídicos separados por espaço, ideais para buscar decisões do STF/STJ no LexML
- 0 a 2 queries de busca para legislação ("legis"): nome do diploma + artigo relevante quando houver base normativa específica

REGRAS PARA AS QUERIES:
- Use terminologia técnica jurídica (ex: "paridade pensão morte EC 41 servidor público")
- Inclua referências normativas quando presentes na tese (EC 41, EC 47, Tema 139, RE 1234567)
- PROIBIDO: palavras genéricas como "aplicação", "entendimento", "regra", "exceção", "firmada", "defesa", "pedido", "direito"
- Queries de 2 a 6 termos cada, sem operadores booleanos

Retorne APENAS JSON com exatamente ${teses.length} entradas:
{
  "teses": [
    { "juri": ["query1", "query2"], "legis": ["queryLegis1"] },
    ...
  ]
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!res.ok) throw new Error(`Gemini Flash-Lite HTTP ${res.status}: ${await res.text().catch(() => "")}`);

      const data = await res.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const parsed = JSON.parse(text);

      const result: LexmlQuerySet[] = [];
      const rawTeses: any[] = Array.isArray(parsed.teses) ? parsed.teses : [];

      for (let i = 0; i < teses.length; i++) {
        const entry = rawTeses[i] ?? {};
        result.push({
          juri: sanitizeQueries(entry.juri),
          legis: sanitizeQueries(entry.legis),
        });
      }
      return result;

    } catch (err: any) {
      console.warn("[LexmlQueryExtractor] fallback to palavrasChave:", err.message);
      return teses.map(() => buildFallbackQuerySet(palavrasChave));
    }
  }
}

function sanitizeQueries(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    .map(q => q.trim())
    .slice(0, 3);
}

function buildFallbackQuerySet(palavrasChave: string[]): LexmlQuerySet {
  const kw = palavrasChave.filter(k => k.length > 3).slice(0, 4);
  return {
    juri: kw.length >= 2
      ? [kw.slice(0, 2).join(" "), kw.slice(2, 4).join(" ")].filter(q => q.trim().length > 0)
      : kw,
    legis: [],
  };
}

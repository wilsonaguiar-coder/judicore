import { env } from "process";

export interface PieceBrief {
  tipoPeca: string;
  resumoDocumentos: string;
  partesIdentificadas: string[];
  cronologia: string[];
  fatosRelevantes: string[];
  pontosIncontroversos: string[];
  pontosControvertidos: string[];
  pedidosIdentificados: string[];
  tesesIdentificadas: string[];
  palavrasChave: string[];
  estrategiaSugerida: string;
  riscosIdentificados: string[];
  lacunasIdentificadas: string[];
  documentosRelevantes: string[];
}

export class PieceBriefService {
  static async generateBrief(
    processedText: string,
    pieceType: string,
    userOrientation: string
  ): Promise<PieceBrief & { _metadata: { inputTokens: number; outputTokens: number; timeMs: number } }> {
    const prompt = `Você é um Analista Jurídico de Elite.
Sua missão é extrair e estruturar informações cruciais a partir dos documentos enviados pelo cliente.
NÃO redija a peça final. Apenas analise os fatos e documentos e produza o PieceBrief estruturado.

TIPO DA PEÇA SOLICITADA: ${pieceType}
DETERMINAÇÃO ESTRATÉGICA DO ADVOGADO: ${userOrientation}

DOCUMENTOS PROCESSADOS:
${processedText}

Retorne EXCLUSIVAMENTE um JSON válido com a interface pedida. Responda em português.
A chave "palavrasChave" deve conter termos fortes para pesquisa no STF/STJ/LexML (ex: ["dano moral atraso voo", "decadência previdenciária"]).`;

    const apiKey = env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente nas variáveis de ambiente");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    const start = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { 
          parts: [{ text: "Você é um Analista Jurídico. Responda apenas com um JSON válido contendo as chaves: tipoPeca, resumoDocumentos, partesIdentificadas, cronologia, fatosRelevantes, pontosIncontroversos, pontosControvertidos, pedidosIdentificados, tesesIdentificadas, palavrasChave, estrategiaSugerida, riscosIdentificados, lacunasIdentificadas, documentosRelevantes." }] 
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
      })
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Gemini API Error: ${res.statusText} - ${errBody}`);
    }

    const data = await res.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    
    const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

    let parsed: PieceBrief;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Gemini retornou um JSON inválido para o PieceBrief");
    }

    return {
      ...parsed,
      _metadata: {
        inputTokens,
        outputTokens,
        timeMs: Date.now() - start
      }
    };
  }
}

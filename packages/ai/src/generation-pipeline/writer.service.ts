import { getOpenAIClient } from "../client.js";
import type { PieceBrief } from "./piece-brief.service.js";
import type { LegalResearchPack } from "../legal-research/legal-research.service.js";

export interface WriterResponse {
  draft: string;
  inputTokens: number;
  outputTokens: number;
}

export class WriterService {
  static async generatePiece(
    pieceType: string,
    userOrientation: string,
    brief: PieceBrief,
    research: LegalResearchPack
  ): Promise<WriterResponse> {
    const client = getOpenAIClient();

    const systemPrompt = `Você é o Writer Jurídico Oficial de Elite (GPT-5.5).
Sua missão é redigir a peça jurídica final com qualidade irretocável.

REGRAS OBRIGATÓRIAS (PENA DE FALHA GRAVE):
1. NUNCA invente jurisprudência, precedentes, súmulas ou artigos de lei (alucinação zero).
2. Utilize APENAS as jurisprudências e legislações fornecidas no pacote abaixo.
3. Se o pacote não contiver fundamentação suficiente, informe a limitação sem inventar.
4. Estruture a peça adequadamente conforme as normas processuais.
5. A Determinação do Usuário possui prioridade absoluta na estratégia e redação.

TIPO DA PEÇA: ${pieceType}
DETERMINAÇÃO DO USUÁRIO: ${userOrientation}

--- PACOTE JURÍDICO ---

1. PIECE BRIEF (Fatos e Estratégia):
${JSON.stringify(brief, null, 2)}

2. JURISPRUDÊNCIA LOCAL (STF/STJ/TST):
${JSON.stringify(research.jurisprudenciaLocal, null, 2)}

3. JURISPRUDÊNCIA LEXML:
${JSON.stringify(research.jurisprudenciaLexML, null, 2)}

4. LEGISLAÇÃO LEXML:
${JSON.stringify(research.legislacaoLexML, null, 2)}
`;

    const response = await client.chat.completions.create({
      model: "gpt-4-turbo", // Simulação do GPT-5.5 no MVP
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Redija a peça final agora." }
      ],
      temperature: 0.2,
      max_tokens: 4096,
    });

    const draft = response.choices[0]?.message.content ?? "";
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    if (!draft) {
      throw new Error("GPT não retornou nenhum rascunho de peça.");
    }

    return { draft, inputTokens, outputTokens };
  }
}

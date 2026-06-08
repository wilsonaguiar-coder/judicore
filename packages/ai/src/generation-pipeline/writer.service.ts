import { getOpenAIClient } from "../client.js";
import type { PieceBrief } from "./piece-brief.service.js";
import type { LegalResearchPack } from "../legal-research/legal-research.service.js";
import { LegalMatrixBuilderService, LegalMatrix } from "./legal-matrix-builder.service.js";

export interface WriterResponse {
  draft: string;
  inputTokens: number;
  outputTokens: number;
  promptSnapshot: string;
}

export class WriterService {
  static async generatePiece(
    pieceType: string,
    userOrientation: string,
    brief: PieceBrief,
    research: LegalResearchPack,
    qualificationData: any,
    legalMatrix: LegalMatrix
  ): Promise<WriterResponse> {
    const client = getOpenAIClient();

    const filteredResearch = LegalMatrixBuilderService.buildFilteredResearch(research);

    const systemPrompt = `Você é o Writer Jurídico Oficial de Elite (GPT-5.5).
Sua missão é redigir a peça jurídica final com qualidade irretocável e argumentação robusta.

REGRAS OBRIGATÓRIAS (PENA DE FALHA GRAVE):
1. NUNCA invente jurisprudência, precedentes, súmulas ou artigos de lei (alucinação zero).
2. Utilize APENAS as jurisprudências e legislações fornecidas no pacote abaixo.
3. Se o pacote não contiver fundamentação suficiente, informe a limitação sem inventar.
4. A Determinação do Usuário possui prioridade absoluta na estratégia e redação.
5. UTILIZE as informações extraídas dos documentos (nome, CPF, RG, endereço) quando disponíveis na Qualificação.
6. JAMAIS crie fatos ausentes dos documentos (não invente datas, órgãos públicos, situações funcionais).
7. Se uma informação essencial não estiver disponível, deixe um placeholder em branco (ex: [CPF]).
8. A redação DEVE apresentar argumentação jurídica robusta e persuasiva, evitando textos genéricos.
9. ESTRUTURA ARGUMENTATIVA OBRIGATÓRIA para cada tópico de mérito:
    a) Tese central (o que se defende).
    b) Fundamentos normativos (explicando a lei aplicável).
    c) Jurisprudência aplicável (explicando a pertinência do precedente).
    d) Aplicação ao caso concreto (como a lei e a jurisprudência se aplicam aos fatos).
    e) Conclusão/Pedido do tópico.

TIPO DA PEÇA: ${pieceType}
DETERMINAÇÃO DO USUÁRIO: ${userOrientation}

--- CONTEXTO ESTRUTURADO ---

1. QUALIFICAÇÃO EXTRAÍDA:
${JSON.stringify(qualificationData, null, 2)}

2. PIECE BRIEF (Fatos e Estratégia):
${JSON.stringify(brief, null, 2)}

3. LEGAL MATRIX (Estrutura Argumentativa):
${JSON.stringify(legalMatrix, null, 2)}

4. LEGISLAÇÃO SELECIONADA:
${JSON.stringify(filteredResearch.legislacaoSelecionada, null, 2)}

5. JURISPRUDÊNCIA SELECIONADA:
${JSON.stringify(filteredResearch.jurisprudenciaSelecionada, null, 2)}
`;

    const response = await client.chat.completions.create({
      model: "gpt-4-turbo", // Simulação do GPT-5.5 no MVP
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Redija a peça final completa agora, seguindo estritamente a Legal Matrix e a Estrutura Argumentativa Obrigatória." }
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

    // Criar um snapshot resumo do prompt (evita salvar +50k tokens se houver)
    const promptSnapshot = systemPrompt.substring(0, 1500) + "\\n...[TRUNCADO PARA SNAPSHOT]";

    return { draft, inputTokens, outputTokens, promptSnapshot };
  }
}

import { getOpenAIClient, MODEL } from "./client.js";
import { buildSystemPrompt, buildDocumentPrompt, buildAnalysisPrompt, buildPremiumDocumentPrompt, buildRagContext } from "./prompts.js";
import type { GenerateDocumentParams, AnalyzeParams, AIResult, PremiumGenerateParams, Jurisprudencia } from "./types.js";
import type OpenAI from "openai";

function isFederalCase(text: string): boolean {
  return /\b(uni[aã]o\s+federal|servidor.*federal|inss|rpps\b|cef\b|receita\s+federal|ec\s*n?[oº°]?\s*41|ec\s*n?[oº°]?\s*47|emenda.*41|emenda.*47|minist[eé]rio|autarquia\s+federal|pens[aã]o.*servidor|servidor.*p[uú]blico\s+federal|regime\s+pr[eé]videnci[aá]rio.*federal)\b/i.test(text);
}

// Gera PETICAO_INICIAL em 3 chamadas separadas para superar o limite de ~800 palavras do GPT-4.1
async function* generatePeticaoBySection(
  caseDescription: string,
  jurisprudencias: Jurisprudencia[],
  instruction?: string,
  onUsage?: (input: number, output: number) => void,
): AsyncGenerator<string> {
  const client = getOpenAIClient();
  let totalInput = 0;
  let totalOutput = 0;

  function trackUsage(inp: number, out: number) {
    totalInput += inp;
    totalOutput += out;
    onUsage?.(totalInput, totalOutput);
  }

  const sys = buildSystemPrompt();
  const ragCtx = buildRagContext(jurisprudencias);
  const instrBlock = instruction?.trim() ? `\nINSTRUÇÃO ADICIONAL DO USUÁRIO: ${instruction.trim()}\n` : "";
  const federal = isFederalCase(caseDescription) || jurisprudencias.some(j => /TRF|STJ|STF/i.test(j.tribunal ?? ""));
  const enderecamento = federal
    ? "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) FEDERAL DA ___ VARA FEDERAL DA SUBSEÇÃO JUDICIÁRIA DE [CIDADE]"
    : "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA [ESPECIALIDADE] DA COMARCA DE [CIDADE]";

  async function* streamSection(
    userPrompt: string,
    maxTokens: number,
  ): AsyncGenerator<string> {
    const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: sys },
      { role: "user", content: userPrompt },
    ];
    const s = await client.chat.completions.create({
      model: MODEL, max_tokens: maxTokens, temperature: 0.9,
      messages: msgs, stream: true, stream_options: { include_usage: true },
    });
    for await (const chunk of s) {
      if (chunk.usage) trackUsage(chunk.usage.prompt_tokens ?? 0, chunk.usage.completion_tokens ?? 0);
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) yield text;
    }
  }

  // ── SEÇÃO 1: Endereçamento + Qualificação + Fatos ──────────────────────────
  const prompt1 = `CASO: ${caseDescription}
${instrBlock}
Você está redigindo uma PETIÇÃO INICIAL. Escreva SOMENTE as seguintes partes — nada além:

1. O endereçamento: "${enderecamento}"

2. A seção "I — DA QUALIFICAÇÃO DAS PARTES"
   — Qualifique o AUTOR com dados fictícios verossímeis e completos: nome completo, nacionalidade, estado civil, profissão, CPF mascarado (ex: ***.456.789-**), RG, endereço com rua, número, bairro, CEP e cidade.
   — Qualifique o RÉU (pessoa jurídica ou física conforme o caso) com dados completos.
   — NUNCA use marcadores como [Nome do Autor] ou [endereço] — crie os dados.

3. A seção "II — DOS FATOS"
   — Narre os fatos cronologicamente em MÍNIMO 6 parágrafos densos.
   — Seja específico, detalhado e persuasivo. Destaque o impacto sobre o autor.
   — Inclua datas aproximadas, valores e circunstâncias relevantes ao caso.

Entregue apenas essas partes. Não escreva "Do Direito", pedidos nem encerramento.`;

  let section1 = "";
  for await (const chunk of streamSection(prompt1, 3072)) {
    section1 += chunk;
    yield chunk;
  }

  // ── SEÇÃO 2: Do Direito ────────────────────────────────────────────────────
  const prompt2 = `${ragCtx}

CASO: ${caseDescription}
${instrBlock}
Você está redigindo a seção jurídica central de uma petição inicial cujo início já foi escrito assim (use como contexto):

---
${section1.slice(-400)}
---

Escreva SOMENTE a seção "III — DO DIREITO" desta petição inicial.

ESTRUTURA OBRIGATÓRIA:
— Numere as subteses: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6 (mínimo 6 subteses)
— Para cada subtese:
   • Título em negrito ou maiúsculas
   • Enuncie a proposição jurídica
   • Fundamente com artigo de lei específico (CF/88, CC/2002, CPC/2015, ou lei especial aplicável)
   • Desenvolva 3 a 4 parágrafos conectando a norma, os princípios constitucionais e os fatos do caso
— Para cada [JUR-N] do contexto acima: abra uma subtese dedicada com:
   • Tribunal, número do processo e data
   • Tese jurídica central consagrada pela decisão
   • 2 parágrafos aplicando a tese diretamente ao caso concreto
   • Vínculo explícito com um pedido específico

Escreva APENAS "III — DO DIREITO". Não escreva pedidos, tutela nem encerramento.`;

  let section2 = "";
  for await (const chunk of streamSection(prompt2, 6144)) {
    section2 += chunk;
    yield chunk;
  }

  // ── SEÇÃO 3: Tutela + Gratuidade + Pedidos + Valor da Causa ───────────────
  const prompt3 = `CASO: ${caseDescription}
${instrBlock}
Você está finalizando uma petição inicial. A seção "III — DO DIREITO" já foi escrita (trecho final):

---
${section2.slice(-400)}
---

Escreva SOMENTE as seções finais da petição inicial:

IV — DA TUTELA DE URGÊNCIA (INCLUA apenas se o caso envolver urgência demonstrável)
   — Demonstre fumus boni iuris e periculum in mora
   — Fundamente no art. 300 do CPC/2015
   — Se não houver urgência clara no caso, OMITA esta seção

V — DA GRATUIDADE DA JUSTIÇA (INCLUA se a parte autora for hipossuficiente)
   — Art. 98 do CPC/2015 c/c art. 5º, LXXIV da CF/88
   — Se não for o caso, OMITA

VI — DOS PEDIDOS
   — Liste TODOS os pedidos numerados (mínimo 6)
   — Cada pedido DEVE citar seu fundamento legal: "[N]. Requerer [resultado] com fundamento no art. X do Diploma Y."
   — Inclua pedido de honorários advocatícios (art. 85 CPC/2015), custas e demais verbas de sucumbência

VII — DO VALOR DA CAUSA
   — Calcule e justifique o valor com base nos pedidos (art. 292 CPC/2015)

ENCERRAMENTO FORMAL:
   — "Nestes termos, pede e espera deferimento."
   — Cidade/data fictícios (ex: "São Paulo, [data].")
   — "Advogado(a)" + OAB fictício`;

  for await (const chunk of streamSection(prompt3, 2048)) {
    yield chunk;
  }
}

export async function* generateDocumentStream(
  params: GenerateDocumentParams,
  onUsage?: (input: number, output: number) => void,
): AsyncGenerator<string> {
  const { type, caseDescription, jurisprudencias, instruction } = params;

  // PETIÇÃO INICIAL: geração em 3 seções para garantir completude
  if (type === "PETICAO_INICIAL") {
    yield* generatePeticaoBySection(caseDescription, jurisprudencias as Jurisprudencia[], instruction, onUsage);
    return;
  }

  const client = getOpenAIClient();
  const isPostulatorio = type === "RECURSO";

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: isPostulatorio ? 16384 : 8192,
    temperature: isPostulatorio ? 0.9 : 0.7,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildDocumentPrompt(type, caseDescription, jurisprudencias, instruction) },
    ],
    stream: true,
    stream_options: { include_usage: true },
  });

  for await (const chunk of stream) {
    if (chunk.usage && onUsage) {
      onUsage(chunk.usage.prompt_tokens, chunk.usage.completion_tokens);
    }
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) yield text;
  }
}

export async function* analyzeCaseStream(
  params: AnalyzeParams
): AsyncGenerator<string> {
  const { caseDescription, jurisprudencias } = params;
  const client = getOpenAIClient();

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildAnalysisPrompt(caseDescription, jurisprudencias) },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) yield text;
  }
}

export async function* generatePremiumDocumentStream(
  params: PremiumGenerateParams,
  onUsage?: (input: number, output: number) => void,
): AsyncGenerator<string> {
  const { type, documents, jurisprudencias, legislation, caseDescription, instruction } = params;
  const client = getOpenAIClient();

  const maxTokens = (type === "PETICAO_INICIAL" || type === "RECURSO") ? 16384 : 8192;
  const isPostulatorio = type === "PETICAO_INICIAL" || type === "RECURSO";

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature: isPostulatorio ? 0.9 : 0.7,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: buildPremiumDocumentPrompt(
          type, documents, jurisprudencias, legislation, caseDescription, instruction
        ),
      },
    ],
    stream: true,
    stream_options: { include_usage: true },
  });

  for await (const chunk of stream) {
    if (chunk.usage && onUsage) {
      onUsage(chunk.usage.prompt_tokens, chunk.usage.completion_tokens);
    }
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) yield text;
  }
}

export async function generateDocument(params: GenerateDocumentParams): Promise<AIResult> {
  const { type, caseDescription, jurisprudencias } = params;
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildDocumentPrompt(type, caseDescription, jurisprudencias) },
    ],
    stream: false,
  });

  return {
    content: response.choices[0]?.message?.content ?? "",
    modelUsed: MODEL,
    sourcesUsed: jurisprudencias,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

export async function analyzeCase(params: AnalyzeParams): Promise<AIResult> {
  const { caseDescription, jurisprudencias } = params;
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildAnalysisPrompt(caseDescription, jurisprudencias) },
    ],
    stream: false,
  });

  return {
    content: response.choices[0]?.message?.content ?? "",
    modelUsed: MODEL,
    sourcesUsed: jurisprudencias,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

import { getOpenAIClient, MODEL } from "./client.js";
import { buildSystemPrompt, buildDocumentPrompt, buildAnalysisPrompt, buildPremiumDocumentPrompt } from "./prompts.js";
import type { GenerateDocumentParams, AnalyzeParams, AIResult, PremiumGenerateParams } from "./types.js";
import type OpenAI from "openai";

// Detecta casos com competência federal pela descrição do caso
function isFederalCase(text: string): boolean {
  return /\b(uni[aã]o\s+federal|servidor.*federal|inss|rpps\b|cef\b|receita\s+federal|ec\s*n?[oº°]?\s*41|ec\s*n?[oº°]?\s*47|emenda.*41|emenda.*47|minist[eé]rio|autarquia\s+federal|pens[aã]o.*servidor|servidor.*p[uú]blico\s+federal|regime\s+pr[eé]videnci[aá]rio.*federal)\b/i.test(text);
}

// Gera o prefill de início de petição para "travar" o GPT-4.1 em competência correta e dados fictícios
function buildPeticaoPrefill(caseDescription: string, jurisprudencias: { tribunal?: string }[]): string {
  const federal = isFederalCase(caseDescription) || jurisprudencias.some(j => /TRF|STJ|STF/i.test(j.tribunal ?? ""));

  const cabecalho = federal
    ? "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) FEDERAL DA ___ VARA FEDERAL DA SUBSEÇÃO JUDICIÁRIA DE [CIDADE]\n\n"
    : "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA [ESPECIALIDADE] DA COMARCA DE [CIDADE]\n\n";

  return (
    cabecalho +
    "I — DA QUALIFICAÇÃO DAS PARTES\n\n" +
    "A autora, Maria de Lourdes Ferreira da Silva, brasileira, viúva, professora aposentada, portadora do CPF nº ***.456.789-** e RG nº 1.234.567 SSP/GO, residente à Rua das Bromélias, nº 87, Bairro Jardim Primavera, CEP 74.000-100, Goiânia/GO, por seu advogado infra-assinado (procuração em anexo),"
  );
}

export async function* generateDocumentStream(
  params: GenerateDocumentParams,
  onUsage?: (input: number, output: number) => void,
): AsyncGenerator<string> {
  const { type, caseDescription, jurisprudencias, instruction } = params;
  const client = getOpenAIClient();

  const isPostulatorio = type === "PETICAO_INICIAL" || type === "RECURSO";

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildDocumentPrompt(type, caseDescription, jurisprudencias, instruction) },
  ];

  // Prefill: força GPT-4.1 a começar do ponto certo e continuar escrevendo
  if (type === "PETICAO_INICIAL") {
    const prefill = buildPeticaoPrefill(caseDescription, jurisprudencias);
    messages.push({ role: "assistant", content: prefill });
  }

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 16384,
    temperature: isPostulatorio ? 0.9 : 0.7,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  });

  // Se houve prefill, emite ele primeiro para o caller
  if (type === "PETICAO_INICIAL") {
    yield buildPeticaoPrefill(caseDescription, jurisprudencias);
  }

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

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt() },
    {
      role: "user",
      content: buildPremiumDocumentPrompt(
        type, documents, jurisprudencias, legislation, caseDescription, instruction
      ),
    },
  ];

  if (type === "PETICAO_INICIAL") {
    const prefill = buildPeticaoPrefill(caseDescription ?? "", jurisprudencias);
    messages.push({ role: "assistant", content: prefill });
  }

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature: isPostulatorio ? 0.9 : 0.7,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  });

  if (type === "PETICAO_INICIAL") {
    yield buildPeticaoPrefill(caseDescription ?? "", jurisprudencias);
  }

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

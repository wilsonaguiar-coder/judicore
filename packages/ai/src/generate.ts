import { getGroqClient, MODEL } from "./client.js";
import { buildSystemPrompt, buildDocumentPrompt, buildAnalysisPrompt } from "./prompts.js";
import type { GenerateDocumentParams, AnalyzeParams, AIResult } from "./types.js";

export async function* generateDocumentStream(
  params: GenerateDocumentParams
): AsyncGenerator<string> {
  const { type, caseDescription, jurisprudencias } = params;
  const client = getGroqClient();

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildDocumentPrompt(type, caseDescription, jurisprudencias) },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) yield text;
  }
}

export async function* analyzeCaseStream(
  params: AnalyzeParams
): AsyncGenerator<string> {
  const { caseDescription, jurisprudencias } = params;
  const client = getGroqClient();

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

export async function generateDocument(params: GenerateDocumentParams): Promise<AIResult> {
  const { type, caseDescription, jurisprudencias } = params;
  const client = getGroqClient();

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
  const client = getGroqClient();

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

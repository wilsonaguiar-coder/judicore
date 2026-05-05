import { getAnthropicClient, MODEL } from "./client.js";
import { buildSystemPrompt, buildDocumentPrompt, buildAnalysisPrompt } from "./prompts.js";
import type { GenerateDocumentParams, AnalyzeParams, AIResult } from "./types.js";

export async function* generateDocumentStream(
  params: GenerateDocumentParams
): AsyncGenerator<string> {
  const { type, caseDescription, jurisprudencias } = params;
  const client = getAnthropicClient();

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: buildDocumentPrompt(type, caseDescription, jurisprudencias) }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

export async function* analyzeCaseStream(
  params: AnalyzeParams
): AsyncGenerator<string> {
  const { caseDescription, jurisprudencias } = params;
  const client = getAnthropicClient();

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: buildAnalysisPrompt(caseDescription, jurisprudencias) }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}


export async function generateDocument(params: GenerateDocumentParams): Promise<AIResult> {
  const { type, caseDescription, jurisprudencias } = params;
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildDocumentPrompt(type, caseDescription, jurisprudencias),
      },
    ],
  });

  const content = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    content,
    modelUsed: MODEL,
    sourcesUsed: jurisprudencias,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

export async function analyzeCase(params: AnalyzeParams): Promise<AIResult> {
  const { caseDescription, jurisprudencias } = params;
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: buildSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildAnalysisPrompt(caseDescription, jurisprudencias),
      },
    ],
  });

  const content = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    content,
    modelUsed: MODEL,
    sourcesUsed: jurisprudencias,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

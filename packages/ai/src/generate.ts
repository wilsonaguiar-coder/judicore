import { getGroqClient, MODEL } from "./client.js";
import { buildSystemPrompt, buildDocumentPrompt, buildAnalysisPrompt, buildPremiumDocumentPrompt } from "./prompts.js";
import type { GenerateDocumentParams, AnalyzeParams, AIResult, PremiumGenerateParams } from "./types.js";

/** Remove blocos <think>...</think> gerados por modelos de raciocínio (DeepSeek R1, QwQ). */
async function* filterThink(
  chunks: AsyncIterable<any>,
  onUsage?: (input: number, output: number) => void,
): AsyncGenerator<string> {
  let inThink = false;
  let buf = "";

  for await (const chunk of chunks) {
    if (chunk.usage) {
      if (onUsage) onUsage(chunk.usage.prompt_tokens, chunk.usage.completion_tokens);
      continue;
    }
    const text: string = chunk.choices?.[0]?.delta?.content ?? "";
    if (!text) continue;

    buf += text;

    while (buf.length > 0) {
      if (inThink) {
        const end = buf.indexOf("</think>");
        if (end === -1) { buf = buf.slice(-20); break; }
        buf = buf.slice(end + 8).replace(/^\n+/, "");
        inThink = false;
      } else {
        const start = buf.indexOf("<think>");
        if (start === -1) {
          const tag = "<think>";
          let partial = 0;
          for (let i = 1; i < tag.length; i++)
            if (buf.endsWith(tag.slice(0, i))) { partial = i; break; }
          const safe = buf.slice(0, buf.length - partial);
          buf = buf.slice(safe.length);
          if (safe) yield safe;
          break;
        }
        const before = buf.slice(0, start);
        if (before) yield before;
        buf = buf.slice(start + 7);
        inThink = true;
      }
    }
  }
  if (buf && !inThink) yield buf;
}

export async function* generateDocumentStream(
  params: GenerateDocumentParams,
  onUsage?: (input: number, output: number) => void,
): AsyncGenerator<string> {
  const { type, caseDescription, jurisprudencias, instruction } = params;
  const client = getGroqClient();

  const stream = await (client.chat.completions.create as any)({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildDocumentPrompt(type, caseDescription, jurisprudencias, instruction) },
    ],
    stream: true,
    stream_options: { include_usage: true },
  }) as AsyncIterable<any>;

  yield* filterThink(stream, onUsage);
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

export async function* generatePremiumDocumentStream(
  params: PremiumGenerateParams,
  onUsage?: (input: number, output: number) => void,
): AsyncGenerator<string> {
  const { type, documents, jurisprudencias, legislation, caseDescription, instruction } = params;
  const client = getGroqClient();

  const maxTokens = (type === "PETICAO_INICIAL" || type === "RECURSO") ? 16384 : 8192;

  const stream = await (client.chat.completions.create as any)({
    model: MODEL,
    max_tokens: maxTokens,
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
  }) as AsyncIterable<any>;

  yield* filterThink(stream, onUsage);
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

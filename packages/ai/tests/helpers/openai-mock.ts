// Mock do client OpenAI para testes de pipeline sem chamada real à API.
//
// Estratégia: fila sequencial de responders. O pipeline chama a OpenAI em
// ordem determinística (classifier → extractor → evidence → matrix → drafter
// → auditor), então enfileirar respostas na mesma ordem é a forma mais
// robusta de simular o pipeline.

import type OpenAI from "openai";

type ChatCompletionCreateParams = OpenAI.Chat.Completions.ChatCompletionCreateParams;
type ChatCompletion = OpenAI.Chat.Completions.ChatCompletion;
type ChatCompletionChunk = OpenAI.Chat.Completions.ChatCompletionChunk;

export type StageResponder =
  | { kind: "json"; payload: unknown }
  | { kind: "text"; content: string }
  | { kind: "stream"; chunks: string[] };

export interface MockCall {
  index: number;
  params: ChatCompletionCreateParams;
  systemPrompt: string;
  userPrompt: string;
}

function extractMessages(params: ChatCompletionCreateParams): { systemPrompt: string; userPrompt: string } {
  const join = (role: "system" | "user") =>
    params.messages
      .filter((m) => m.role === role)
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join("\n");
  return { systemPrompt: join("system"), userPrompt: join("user") };
}

function buildCompletion(payload: unknown, kind: "json" | "text"): ChatCompletion {
  const content = kind === "json" ? JSON.stringify(payload) : (payload as string);
  return {
    id: "chatcmpl-mock",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "gpt-4.1",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content, refusal: null },
        finish_reason: "stop",
        logprobs: null,
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  } as unknown as ChatCompletion;
}

async function* buildStream(chunks: string[]): AsyncIterable<ChatCompletionChunk> {
  for (const text of chunks) {
    yield {
      id: "chatcmpl-mock-stream",
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: "gpt-4.1",
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: text },
          finish_reason: null,
        },
      ],
    } as unknown as ChatCompletionChunk;
  }
  yield {
    id: "chatcmpl-mock-stream",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "gpt-4.1",
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
  } as unknown as ChatCompletionChunk;
}

export interface MockedOpenAIClient {
  client: OpenAI;
  calls: MockCall[];
}

/**
 * Cria um mock que retorna respostas na ordem em que foram passadas.
 * Cada call OpenAI consome uma resposta da fila.
 */
export function createMockOpenAI(queue: StageResponder[]): MockedOpenAIClient {
  const calls: MockCall[] = [];
  let index = 0;
  const queueCopy = [...queue];

  const client = {
    chat: {
      completions: {
        create: async (params: ChatCompletionCreateParams) => {
          const { systemPrompt, userPrompt } = extractMessages(params);
          calls.push({ index, params, systemPrompt, userPrompt });
          const responder = queueCopy.shift();
          index++;
          if (!responder) {
            throw new Error(
              `Mock OpenAI: fila de respostas esgotada na chamada ${index}. ` +
                `Adicione mais responders ao array passado para createMockOpenAI.`,
            );
          }
          if (responder.kind === "json") return buildCompletion(responder.payload, "json");
          if (responder.kind === "text") return buildCompletion(responder.content, "text");
          if (responder.kind === "stream") return buildStream(responder.chunks);
          throw new Error("Mock OpenAI: responder com tipo desconhecido");
        },
      },
    },
  } as unknown as OpenAI;

  return { client, calls };
}

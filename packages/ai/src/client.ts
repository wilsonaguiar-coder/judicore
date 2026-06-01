import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("OPENAI_API_KEY não definida");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

// Injetor para testes — permite substituir o client por um mock.
// Em produção, JAMAIS é chamado. Aceita `null` para resetar.
export function setOpenAIClient(client: OpenAI | null): void {
  _client = client;
}

export const MODEL = "gpt-4.1";

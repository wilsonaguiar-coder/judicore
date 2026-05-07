import Groq from "groq-sdk";

let _client: Groq | null = null;

export function getGroqClient(): Groq {
  if (!_client) {
    const apiKey = process.env["GROQ_API_KEY"];
    if (!apiKey) throw new Error("GROQ_API_KEY não definida");
    _client = new Groq({ apiKey });
  }
  return _client;
}

export const MODEL = "deepseek-r1-distill-llama-70b";

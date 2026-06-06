export interface RevisionProviderConfig {
  provider: "OPENAI" | "CLAUDE" | "DEEPSEEK" | "GEMINI";
  model: string;
  temperature: number;
  maxTokens: number;
}

// Pontos de extensão para futura sumarização de grandes volumes

export interface IChunker {
  chunk(text: string, maxTokens: number): string[];
}

export interface IBlockSummarizer {
  summarizeBlock(chunk: string): Promise<string>;
  consolidateSummaries(summaries: string[]): Promise<string>;
}

export class TokenChunker implements IChunker {
  chunk(text: string, maxTokens: number): string[] {
    // TODO: Lógica de split por tokens (ex: tiktoken)
    // Retornando o texto inteiro em 1 chunk como placeholder
    return [text];
  }
}

export class DocumentSummarizerPrep implements IBlockSummarizer {
  async summarizeBlock(chunk: string): Promise<string> {
    // Chamada LLM futura
    return "Resumo do bloco (placeholder)";
  }

  async consolidateSummaries(summaries: string[]): Promise<string> {
    // Chamada LLM futura
    return "Resumo consolidado (placeholder)";
  }
}

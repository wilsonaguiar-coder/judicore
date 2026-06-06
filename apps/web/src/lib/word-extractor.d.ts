declare module "word-extractor" {
  interface WordDocument {
    getBody(): string;
  }
  class WordExtractor {
    extract(buffer: Buffer): Promise<WordDocument>;
  }
  export = WordExtractor;
}

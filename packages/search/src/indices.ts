import { getElasticsearchClient } from "./client.js";

const JURISPRUDENCIA_INDEX = "jurisprudencia";

const indexMapping = {
  settings: {
    analysis: {
      analyzer: {
        portuguese_legal: {
          type: "custom",
          tokenizer: "standard",
          filter: ["lowercase", "portuguese_stop", "portuguese_stemmer"],
        },
      },
      filter: {
        portuguese_stop: {
          type: "stop",
          stopwords: "_portuguese_",
        },
        portuguese_stemmer: {
          type: "stemmer",
          language: "portuguese",
        },
      },
    },
  },
  mappings: {
    properties: {
      tribunal:        { type: "keyword" },
      numero:          { type: "keyword" },
      ementa:          { type: "text", analyzer: "portuguese_legal" },
      relator:         { type: "keyword" },
      dataJulgamento:  { type: "date", format: "yyyy-MM-dd" },
      area:            { type: "keyword" },
      url:             { type: "keyword", index: false },
      conteudoIntegral: { type: "text", analyzer: "portuguese_legal" },
    },
  },
};

export async function ensureIndices(): Promise<void> {
  const client = getElasticsearchClient();
  const exists = await client.indices.exists({ index: JURISPRUDENCIA_INDEX });
  if (!exists) {
    await client.indices.create({
      index: JURISPRUDENCIA_INDEX,
      ...indexMapping,
    });
    console.log(`Índice '${JURISPRUDENCIA_INDEX}' criado.`);
  }
}

export { JURISPRUDENCIA_INDEX };

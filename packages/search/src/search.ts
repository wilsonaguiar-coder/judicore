import { getElasticsearchClient } from "./client.js";
import { JURISPRUDENCIA_INDEX } from "./indices.js";
import type { SearchParams, SearchResult, Jurisprudencia } from "./types.js";

export async function searchJurisprudencia(params: SearchParams): Promise<SearchResult> {
  const client = getElasticsearchClient();
  const { query, area, tribunais, size = 10 } = params;

  const must: object[] = [
    {
      multi_match: {
        query,
        fields: ["ementa^2", "conteudoIntegral"],
        analyzer: "portuguese_legal",
        fuzziness: "AUTO",
      },
    },
  ];

  const filter: object[] = [];

  if (area) {
    filter.push({ term: { area } });
  }

  if (tribunais && tribunais.length > 0) {
    filter.push({ terms: { tribunal: tribunais } });
  }

  const response = await client.search({
    index: JURISPRUDENCIA_INDEX,
    size,
    query: {
      bool: { must, filter },
    },
    highlight: {
      fields: {
        ementa: { number_of_fragments: 2, fragment_size: 300 },
      },
    },
  });

  const hits: Jurisprudencia[] = response.hits.hits.map((hit) => {
    const src = hit._source as Omit<Jurisprudencia, "id" | "score">;
    return {
      id: hit._id ?? "",
      ...src,
      score: hit._score ?? 0,
    };
  });

  return {
    hits,
    total: typeof response.hits.total === "number"
      ? response.hits.total
      : (response.hits.total?.value ?? 0),
    took: response.took,
  };
}

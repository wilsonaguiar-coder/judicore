import { Agent } from "undici";
import type { Jurisprudencia, LegalArea } from "../types.js";
import type { JurisprudenciaAdapter, IndexerOptions } from "./types.js";

// Portal de Jurisprudência do STF — sem API formal, usa endpoint interno do portal
const STF_BASE = "https://jurisprudencia.stf.jus.br";

// O STF usa certificado ICP-Brasil não reconhecido pelo trust store padrão do Node.js
const tlsAgent = new Agent({ connect: { rejectUnauthorized: false } });

interface StfApiResponse {
  resultado?: {
    hits?: {
      hits?: Array<{
        _id?: string;
        _source?: {
          numeroProcesso?: string;
          nomeTribunal?: string;
          relator?: string;
          dataJulgamento?: string;
          ementa?: string;
          descricao?: string;
          link?: string;
          classe?: { sigla?: string };
        };
      }>;
      total?: { value?: number };
    };
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchStfPage(
  query: string,
  from: number
): Promise<{ items: Jurisprudencia[]; total: number }> {
  // O portal do STF usa uma API interna Elasticsearch-like
  const params = new URLSearchParams({
    query,
    page: String(Math.floor(from / 10) + 1),
    pageSize: "10",
    sort: "relevancia",
    bases: "AC,ADPF,ADC,ADI,ADPF,ARE,HC,MS,RE,RHC,RMS",
  });

  const url = `${STF_BASE}/api/search/search?${params}`;

  const res = await fetch(url, {
    dispatcher: tlsAgent,
    headers: {
      "User-Agent": "Judicore/1.0 (pesquisa jurídica institucional)",
      Accept: "application/json",
      Referer: "https://jurisprudencia.stf.jus.br/pages/search",
    },
  });

  if (!res.ok) throw new Error(`STF HTTP ${res.status}`);

  const json = (await res.json()) as StfApiResponse;
  const hits = json.resultado?.hits?.hits ?? [];
  const total = json.resultado?.hits?.total?.value ?? 0;

  const items: Jurisprudencia[] = hits.map((h) => {
    const src = h._source ?? {};
    const classe = src.classe?.sigla ?? "";
    const numero = src.numeroProcesso ?? h._id ?? "";

    return {
      id: `stf-${h._id ?? numero}`,
      tribunal: "STF",
      numero: classe ? `${classe} ${numero}` : numero,
      ementa: src.ementa ?? src.descricao ?? "Ementa não disponível",
      relator: src.relator ?? "Não informado",
      dataJulgamento: src.dataJulgamento?.slice(0, 10) ?? "",
      area: "OUTRO" as LegalArea,
      url: src.link ?? `https://jurisprudencia.stf.jus.br/pages/search?base=acordaos&pesquisa_inteiro_teor=false&sinonimo=true&plural=true&radicais=false&buscaExata=false&page=1&pageSize=10&queryString=${encodeURIComponent(numero)}`,
    };
  });

  return { items, total };
}

export const stfAdapter: JurisprudenciaAdapter = {
  name: "STF Jurisprudência",

  async *fetch(query: string, options: IndexerOptions) {
    const maxPages = options.maxPages ?? 3;
    const delayMs = options.delayMs ?? 1500;
    let from = 0;

    for (let page = 0; page < maxPages; page++) {
      try {
        const { items, total } = await fetchStfPage(query, from);
        if (items.length === 0) break;

        yield items;

        from += 10;
        if (from >= total) break;
        await delay(delayMs);
      } catch (err) {
        console.error(`STF p${page}:`, err);
        break;
      }
    }
  },
};

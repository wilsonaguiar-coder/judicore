import type { Jurisprudencia, LegalArea } from "../types.js";
import type { JurisprudenciaAdapter, IndexerOptions } from "./types.js";

// API pública DataJud — chave pública oficial do CNJ
const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const BASE_URL = "https://api-publica.datajud.cnj.jus.br";

// Alias dos tribunais no DataJud
const TRIBUNAL_ALIAS: Record<string, string> = {
  STJ:  "api_publica_stj",
  STF:  "api_publica_stf",
  TRF1: "api_publica_trf1",
  TRF2: "api_publica_trf2",
  TRF3: "api_publica_trf3",
  TRF4: "api_publica_trf4",
  TRF5: "api_publica_trf5",
  TRF6: "api_publica_trf6",
};

interface DataJudHit {
  _id: string;
  _source: {
    numeroProcesso?: string;
    tribunal?: string;
    orgaoJulgador?: { nome?: string };
    dataAjuizamento?: string;
    dataHoraUltimaAtualizacao?: string;
    movimentos?: Array<{ nome?: string; dataHora?: string }>;
    assuntos?: Array<{ nome?: string }>;
    classeProcessual?: { nome?: string };
  };
}

function getTribunalUrl(tribunal: string, numeroProcesso?: string): string {
  if (!numeroProcesso) return "";
  const enc = encodeURIComponent(numeroProcesso);
  switch (tribunal) {
    case "STJ":
      return `https://processo.stj.jus.br/processo/pesquisa/?tipoPesquisa=tipoPesquisaNumeroUnico&termo=${enc}`;
    case "STF":
      return `https://portal.stf.jus.br/processos/listarPartes.asp?termo=${enc}`;
    case "TRF1":
      return `https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=${enc}&secao=TRF`;
    case "TRF2":
      return `https://consultaprocessual.trf2.jus.br/consultaProcessual/servlet/ConsultaProcessual?numero=${enc}`;
    case "TRF3":
      return `https://web.trf3.jus.br/base/PesquisaProcessual/PesquisaProcessual/Resultado?Proc=${enc}`;
    case "TRF4":
      return `https://www2.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_pesquisa_doc&doc=${enc}`;
    case "TRF5":
      return `https://www.trf5.jus.br/cp/cp.do?proc=${enc}`;
    default:
      return `https://www.cnj.jus.br/consultas-processuais/?numero=${enc}`;
  }
}

function mapToJurisprudencia(hit: DataJudHit, tribunal: string): Jurisprudencia {
  const src = hit._source;
  const assunto = src.assuntos?.map((a) => a.nome).filter(Boolean).join("; ") ?? "";
  const ultimoMov = src.movimentos?.[0];

  return {
    id: hit._id,
    tribunal,
    numero: src.numeroProcesso ?? hit._id,
    ementa: assunto || src.classeProcessual?.nome || "Sem ementa disponível",
    relator: src.orgaoJulgador?.nome ?? "Não informado",
    dataJulgamento: ultimoMov?.dataHora?.slice(0, 10) ?? src.dataHoraUltimaAtualizacao?.slice(0, 10) ?? "",
    area: "OUTRO" as LegalArea,
    url: getTribunalUrl(tribunal, src.numeroProcesso),
  };
}

async function fetchPage(
  tribunal: string,
  query: string,
  searchAfter?: unknown[]
): Promise<{ hits: DataJudHit[]; lastSort?: unknown[] }> {
  const alias = TRIBUNAL_ALIAS[tribunal];
  if (!alias) return { hits: [] };

  const body: Record<string, unknown> = {
    size: 20,
    query: {
      multi_match: {
        query,
        fields: ["assuntos.nome^2", "classeProcessual.nome", "movimentos.nome"],
        fuzziness: "AUTO",
      },
    },
    sort: [{ dataHoraUltimaAtualizacao: "desc" }],
  };

  if (searchAfter) body["search_after"] = searchAfter;

  const res = await fetch(`${BASE_URL}/${alias}/_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `APIKey ${DATAJUD_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`DataJud ${tribunal}: HTTP ${res.status}`);
  }

  const json = await res.json() as { hits?: { hits?: DataJudHit[] } };
  const hits = json.hits?.hits ?? [];
  const last = hits[hits.length - 1];
  return { hits, lastSort: last ? (last as any).sort : undefined };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const datajudAdapter: JurisprudenciaAdapter = {
  name: "DataJud (CNJ)",

  async *fetch(query: string, options: IndexerOptions) {
    const tribunais = options.tribunais ?? Object.keys(TRIBUNAL_ALIAS);
    const maxPages = options.maxPages ?? 5;
    const delayMs = options.delayMs ?? 600; // respeita limite de 120 req/min

    for (const tribunal of tribunais) {
      let page = 0;
      let searchAfter: unknown[] | undefined;

      while (page < maxPages) {
        try {
          const { hits, lastSort } = await fetchPage(tribunal, query, searchAfter);
          if (hits.length === 0) break;

          yield hits.map((h) => mapToJurisprudencia(h, tribunal));

          searchAfter = lastSort;
          page++;
          await delay(delayMs);
        } catch (err) {
          console.error(`DataJud ${tribunal} p${page}:`, err);
          break;
        }
      }
    }
  },
};

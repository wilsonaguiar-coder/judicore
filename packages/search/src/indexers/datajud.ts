import type { Jurisprudencia, LegalArea } from "../types.js";
import type { JurisprudenciaAdapter, IndexerOptions } from "./types.js";

// API pública DataJud — chave pública oficial do CNJ
const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const BASE_URL = "https://api-publica.datajud.cnj.jus.br";

// Alias dos tribunais no DataJud (STF e STJ não usam DataJud — STJ vem do SCON com inteiro teor)
const TRIBUNAL_ALIAS: Record<string, string> = {
  // Tribunais Superiores
  TST:   "api_publica_tst",
  TSE:   "api_publica_tse",
  STM:   "api_publica_stm",

  // Tribunais Regionais Federais
  TRF1:  "api_publica_trf1",
  TRF2:  "api_publica_trf2",
  TRF3:  "api_publica_trf3",
  TRF4:  "api_publica_trf4",
  TRF5:  "api_publica_trf5",
  TRF6:  "api_publica_trf6",

  // Tribunais Regionais do Trabalho
  TRT1:  "api_publica_trt1",
  TRT2:  "api_publica_trt2",
  TRT3:  "api_publica_trt3",
  TRT4:  "api_publica_trt4",
  TRT5:  "api_publica_trt5",
  TRT6:  "api_publica_trt6",
  TRT7:  "api_publica_trt7",
  TRT8:  "api_publica_trt8",
  TRT9:  "api_publica_trt9",
  TRT10: "api_publica_trt10",
  TRT11: "api_publica_trt11",
  TRT12: "api_publica_trt12",
  TRT13: "api_publica_trt13",
  TRT14: "api_publica_trt14",
  TRT15: "api_publica_trt15",
  TRT16: "api_publica_trt16",
  TRT17: "api_publica_trt17",
  TRT18: "api_publica_trt18",
  TRT19: "api_publica_trt19",
  TRT20: "api_publica_trt20",
  TRT21: "api_publica_trt21",
  TRT22: "api_publica_trt22",
  TRT23: "api_publica_trt23",
  TRT24: "api_publica_trt24",

  // Tribunais de Justiça Estaduais
  TJSP:  "api_publica_tjsp",
  TJRJ:  "api_publica_tjrj",
  TJMG:  "api_publica_tjmg",
  TJRS:  "api_publica_tjrs",
  TJPR:  "api_publica_tjpr",
  TJSC:  "api_publica_tjsc",
  TJBA:  "api_publica_tjba",
  TJPE:  "api_publica_tjpe",
  TJCE:  "api_publica_tjce",
  TJGO:  "api_publica_tjgo",
  TJDFT: "api_publica_tjdft",
  TJMA:  "api_publica_tjma",
  TJPA:  "api_publica_tjpa",
  TJES:  "api_publica_tjes",
  TJMT:  "api_publica_tjmt",
  TJMS:  "api_publica_tjms",
  TJAL:  "api_publica_tjal",
  TJSE:  "api_publica_tjse",
  TJRN:  "api_publica_tjrn",
  TJPB:  "api_publica_tjpb",
  TJPI:  "api_publica_tjpi",
  TJAM:  "api_publica_tjam",
  TJAC:  "api_publica_tjac",
  TJRO:  "api_publica_tjro",
  TJRR:  "api_publica_tjrr",
  TJAP:  "api_publica_tjap",
  TJTO:  "api_publica_tjto",

  // Tribunais de Justiça Militar Estaduais
  TJMMG: "api_publica_tjmmg",
  TJMRS: "api_publica_tjmrs",
  TJMSP: "api_publica_tjmsp",

  // Tribunais Regionais Eleitorais
  "TRE-AC": "api_publica_tre-ac",
  "TRE-AL": "api_publica_tre-al",
  "TRE-AM": "api_publica_tre-am",
  "TRE-AP": "api_publica_tre-ap",
  "TRE-BA": "api_publica_tre-ba",
  "TRE-CE": "api_publica_tre-ce",
  "TRE-DF": "api_publica_tre-dft",
  "TRE-ES": "api_publica_tre-es",
  "TRE-GO": "api_publica_tre-go",
  "TRE-MA": "api_publica_tre-ma",
  "TRE-MG": "api_publica_tre-mg",
  "TRE-MS": "api_publica_tre-ms",
  "TRE-MT": "api_publica_tre-mt",
  "TRE-PA": "api_publica_tre-pa",
  "TRE-PB": "api_publica_tre-pb",
  "TRE-PE": "api_publica_tre-pe",
  "TRE-PI": "api_publica_tre-pi",
  "TRE-PR": "api_publica_tre-pr",
  "TRE-RJ": "api_publica_tre-rj",
  "TRE-RN": "api_publica_tre-rn",
  "TRE-RO": "api_publica_tre-ro",
  "TRE-RR": "api_publica_tre-rr",
  "TRE-RS": "api_publica_tre-rs",
  "TRE-SC": "api_publica_tre-sc",
  "TRE-SE": "api_publica_tre-se",
  "TRE-SP": "api_publica_tre-sp",
  "TRE-TO": "api_publica_tre-to",
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

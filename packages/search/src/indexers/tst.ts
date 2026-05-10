import type { Jurisprudencia } from "../types.js";
import type { JurisprudenciaAdapter, IndexerOptions } from "./types.js";

const TST_BASE = "https://jurisprudencia-backend2.tst.jus.br/rest/pesquisa-textual";
const PAGE_SIZE = 100;

interface TSTRegistro {
  id?: string;
  numero?: string;
  numFormatado?: string;
  nomRelator?: string;
  dtaPublicacao?: string;
  txtConteudoDecisaoHighlight?: string;
  tipo?: { codigoTipoJurisprudencia?: string };
  anoProcInt?: number | string;
  numProcInt?: number | string;
  numMinuta?: number | string;
}

interface TSTResponse {
  totalRegistros: number;
  registros?: Array<{ registro: TSTRegistro }>;
}

function buildPdfUrl(r: TSTRegistro): string | undefined {
  if (!r.anoProcInt || !r.numProcInt || !r.numMinuta || !r.dtaPublicacao) return undefined;
  // Converte ISO "2020-01-31T07:00:00..." para "31/01/2020 07:00:00"
  const iso = r.dtaPublicacao;
  const [datePart, timePart] = iso.split("T");
  const [y, m, d] = (datePart ?? "").split("-");
  const time = (timePart ?? "00:00:00").slice(0, 8);
  const dtaStr = `${d}/${m}/${y} ${time}`;
  const params = new URLSearchParams({
    anoProcInt: String(r.anoProcInt),
    numProcInt: String(r.numProcInt),
    dtaPublicacaoStr: dtaStr,
    nia: String(r.numMinuta),
  });
  return `https://consultadocumento.tst.jus.br/consultaDocumento/acordao.do?${params}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(
  query: string,
  page: number,
  retries = 5,
  startDate?: string,
  endDate?: string,
): Promise<TSTResponse> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const body: Record<string, unknown> = (startDate || endDate)
        ? {
            orgao: "TST",
            termoExato: query.trim() || "",
            ...(startDate && { publicacaoInicial: startDate }),
            ...(endDate && { publicacaoFinal: endDate }),
          }
        : (query.trim() ? { searchParameter: query } : {});

      const res = await fetch(`${TST_BASE}/${page}/${PAGE_SIZE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Referer": "https://jurisprudencia.tst.jus.br/",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`TST HTTP ${res.status}`);
      return res.json() as Promise<TSTResponse>;
    } catch (err) {
      if (attempt === retries) throw err;
      // Backoff exponencial: 10s, 20s, 40s, 80s entre tentativas
      await delay(10000 * Math.pow(2, attempt - 1));
    }
  }
  throw new Error("TST: retries esgotados");
}

export const tstAdapter: JurisprudenciaAdapter = {
  name: "TST Jurisprudência",

  async *fetch(query: string, options: IndexerOptions) {
    const maxPages = options.maxPages ?? 5;
    const delayMs  = options.delayMs ?? 1200;
    const startDate = options.startDate;
    const endDate   = options.endDate;

    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;

    for (let page = 1; page <= maxPages; page++) {
      try {
        const data = await fetchPage(query, page, 5, startDate, endDate);
        if (!data.registros?.length) break;

        const items: Jurisprudencia[] = [];
        for (const { registro: r } of data.registros) {
          if (!r?.id) continue;
          const texto = stripHtml(r.txtConteudoDecisaoHighlight ?? "");
          const ementa = texto || "Ementa não disponível";
          const pdfUrl = buildPdfUrl(r);
          const item: Jurisprudencia = {
            id: `tst-${r.id}`,
            tribunal: "TST",
            numero: r.numFormatado ?? r.numero ?? r.id,
            ementa,
            relator: r.nomRelator ?? "Não informado",
            dataJulgamento: r.dtaPublicacao?.slice(0, 10) ?? "",
            area: "TRABALHISTA",
            url: `https://jurisprudencia.tst.jus.br/#!/resultado?id=${r.id}`,
            ...(pdfUrl ? { urlPdf: pdfUrl } : {}),
          };
          if (texto.length > 0) item.conteudoIntegral = texto;
          items.push(item);
        }

        if (items.length === 0) break;

        consecutiveErrors = 0;
        yield items;

        const totalPages = Math.ceil(data.totalRegistros / PAGE_SIZE);
        if (page >= totalPages) break;

        await delay(delayMs);
      } catch (err) {
        consecutiveErrors++;
        console.error(`TST p${page} (erro ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err);
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error(`TST: ${MAX_CONSECUTIVE_ERRORS} erros consecutivos — abortando.`);
          break;
        }
        await delay(delayMs * 3);
      }
    }
  },
};

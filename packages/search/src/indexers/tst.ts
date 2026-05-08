import type { Jurisprudencia } from "../types.js";
import type { JurisprudenciaAdapter, IndexerOptions } from "./types.js";

const TST_BASE = "https://jurisprudencia-backend2.tst.jus.br/rest/pesquisa-textual";
const PAGE_SIZE = 20;

interface TSTRegistro {
  id?: string;
  numero?: string;
  numFormatado?: string;
  nomRelator?: string;
  dtaPublicacao?: string;
  txtConteudoDecisaoHighlight?: string;
  tipo?: { codigoTipoJurisprudencia?: string };
}

interface TSTResponse {
  totalRegistros: number;
  registros?: Array<{ registro: TSTRegistro }>;
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

async function fetchPage(query: string, page: number, retries = 3): Promise<TSTResponse> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${TST_BASE}/${page}/${PAGE_SIZE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query.trim() ? { searchParameter: query } : {}),
      });
      if (!res.ok) throw new Error(`TST HTTP ${res.status}`);
      return res.json() as Promise<TSTResponse>;
    } catch (err) {
      if (attempt === retries) throw err;
      await delay(attempt * 5000);
    }
  }
  throw new Error("TST: retries esgotados");
}

export const tstAdapter: JurisprudenciaAdapter = {
  name: "TST Jurisprudência",

  async *fetch(query: string, options: IndexerOptions) {
    const maxPages = options.maxPages ?? 5;
    const delayMs  = options.delayMs ?? 1200;

    for (let page = 1; page <= maxPages; page++) {
      try {
        const data = await fetchPage(query, page);
        if (!data.registros?.length) break;

        const items: Jurisprudencia[] = [];
        for (const { registro: r } of data.registros) {
          if (!r?.id) continue;
          const texto = stripHtml(r.txtConteudoDecisaoHighlight ?? "");
          const ementa = texto || "Ementa não disponível";
          const item: Jurisprudencia = {
            id: `tst-${r.id}`,
            tribunal: "TST",
            numero: r.numFormatado ?? r.numero ?? r.id,
            ementa,
            relator: r.nomRelator ?? "Não informado",
            dataJulgamento: r.dtaPublicacao?.slice(0, 10) ?? "",
            area: "TRABALHISTA",
            url: `https://jurisprudencia.tst.jus.br/#!/resultado?id=${r.id}`,
          };
          if (texto.length > 0) item.conteudoIntegral = texto;
          items.push(item);
        }

        if (items.length === 0) break;
        yield items;

        const totalPages = Math.ceil(data.totalRegistros / PAGE_SIZE);
        if (page >= totalPages) break;

        await delay(delayMs);
      } catch (err) {
        console.error(`TST p${page}:`, err);
        break;
      }
    }
  },
};

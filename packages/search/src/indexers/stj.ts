import { Agent } from "undici";
import type { Jurisprudencia, LegalArea } from "../types.js";
import type { JurisprudenciaAdapter, IndexerOptions } from "./types.js";

// SCON do STJ — interface web pública, retorna XML com ementa completa
const SCON_BASE = "https://scon.stj.jus.br/SCON";

// STJ usa certificado ICP-Brasil não reconhecido pelo trust store padrão do Node.js
const tlsAgent = new Agent({ connect: { rejectUnauthorized: false } });

interface SconResult {
  documento: Array<{
    "num-processo"?: string[];
    "min-relator"?: string[];
    "orgao-julgador"?: string[];
    "data-julgamento"?: string[];
    ementa?: string[];
    "num-registro"?: string[];
    "processo-formato"?: string[];
  }>;
  registros?: number;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchInteiroTeor(numReg: string, dtPublicacao: string): Promise<string> {
  try {
    const url = `${SCON_BASE}/GetInteiroTeorDoAcordao?num_registro=${numReg}&dt_publicacao=${dtPublicacao}`;
    const res = await fetch(url, {
      dispatcher: tlsAgent as any,
      headers: { "User-Agent": "Judicore/1.0", Accept: "text/html" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    // Remove tags HTML, CDATA e normaliza espaços
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 50000); // ES limita text fields grandes
  } catch {
    return "";
  }
}

async function fetchSconPage(
  query: string,
  start: number
): Promise<{ items: Jurisprudencia[]; total: number }> {
  const params = new URLSearchParams({
    b: "ACOR",
    p: "true",
    t: "V",
    l: "20",
    i: String(start),
    operador: "e",
    pesquisa_tipo: "livre",
    pesquisa: query,
    formato: "XML",
  });

  const url = `${SCON_BASE}/pesquisar.jsp?${params}`;

  const res = await fetch(url, {
    dispatcher: tlsAgent as any,
    headers: {
      "User-Agent": "Judicore/1.0 (pesquisa jurídica institucional)",
      Accept: "application/xml, text/xml, */*",
    },
  });

  if (!res.ok) throw new Error(`SCON STJ HTTP ${res.status}`);

  const text = await res.text();
  const items = parseSTJXml(text);
  const totalMatch = text.match(/<registros>(\d+)<\/registros>/);
  const total = totalMatch ? parseInt(totalMatch[1] ?? "0", 10) : 0;

  return { items, total };
}

function extractTag(xml: string, ...tags: string[]): string {
  for (const tag of tags) {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (match) return match[1]?.replace(/<!\[CDATA\[|\]\]>|<[^>]+>/g, "").trim() ?? "";
  }
  return "";
}

function parseSTJXml(xml: string): Jurisprudencia[] {
  const docMatches = xml.match(/<documento[\s\S]*?<\/documento>/gi) ?? [];

  return docMatches
    .map((doc) => {
      const numero  = extractTag(doc, "num-processo", "numero-processo");
      const relator = extractTag(doc, "min-relator", "relator");
      const dataJulg = extractTag(doc, "data-julgamento", "data-decisao");
      const ementa  = extractTag(doc, "ementa");
      const numReg  = extractTag(doc, "num-registro", "numero-registro");
      const classe  = extractTag(doc, "classe");

      if (!numReg && !numero) return null;

      const numeroDisplay = classe ? `${classe} ${numero}`.trim() : numero;

      return {
        id: `stj-${numReg || numero}`,
        tribunal: "STJ",
        numero: numeroDisplay,
        ementa: ementa || "Ementa não disponível",
        relator,
        dataJulgamento: formatDate(dataJulg),
        area: "OUTRO" as LegalArea,
        url: numReg
          ? `https://scon.stj.jus.br/SCON/GetInteiroTeorDoAcordao?num_registro=${numReg}&dt_publicacao=${dataJulg}`
          : `https://processo.stj.jus.br/processo/pesquisa/?tipoPesquisa=tipoPesquisaNumeroUnico&termo=${encodeURIComponent(numero)}`,
      };
    })
    .filter((item): item is Jurisprudencia => item !== null);
}

function formatDate(raw: string): string {
  // Formatos: "DD/MM/YYYY" → "YYYY-MM-DD"
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return raw.slice(0, 10);
}

export const stjAdapter: JurisprudenciaAdapter = {
  name: "STJ SCON",

  async *fetch(query: string, options: IndexerOptions) {
    const maxPages = options.maxPages ?? 3;
    const delayMs = options.delayMs ?? 1500;

    let start = 1;

    for (let page = 0; page < maxPages; page++) {
      try {
        const { items, total } = await fetchSconPage(query, start);
        if (items.length === 0) break;

        // Busca inteiro teor sequencialmente para não saturar a conexão
        const enriched: Jurisprudencia[] = [];
        for (const item of items) {
          const numReg = item.id.replace("stj-", "");
          const dtPublicacao = item.dataJulgamento.replace(/-/g, "/");
          const conteudoIntegral = await fetchInteiroTeor(numReg, dtPublicacao);
          enriched.push(conteudoIntegral ? { ...item, conteudoIntegral } : item);
          await delay(500);
        }

        yield enriched;

        start += 20;
        if (start > total) break;
        await delay(delayMs);
      } catch (err) {
        console.error(`STJ SCON p${page}:`, err);
        break;
      }
    }
  },
};

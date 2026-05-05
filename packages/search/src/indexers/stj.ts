import type { Jurisprudencia, LegalArea } from "../types.js";
import type { JurisprudenciaAdapter, IndexerOptions } from "./types.js";

// SCON do STJ — interface web pública, sem API formal
// Endpoint de busca retorna HTML; usamos o endpoint que expõe JSON interno
const SCON_BASE = "https://scon.stj.jus.br/SCON";

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

async function fetchSconPage(
  query: string,
  start: number
): Promise<{ items: Jurisprudencia[]; total: number }> {
  const params = new URLSearchParams({
    b: "ACOR",          // base: acórdãos
    p: "true",
    t: "V",
    l: "20",            // 20 por página
    i: String(start),
    operador: "e",
    pesquisa_tipo: "livre",
    pesquisa: query,
    formato: "XML",
  });

  const url = `${SCON_BASE}/pesquisar.jsp?${params}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Judicore/1.0 (pesquisa jurídica institucional)",
      Accept: "application/xml, text/xml",
    },
  });

  if (!res.ok) throw new Error(`SCON STJ HTTP ${res.status}`);

  const text = await res.text();

  // Parse XML simples sem dependência externa
  const items = parseSTJXml(text);
  const totalMatch = text.match(/<registros>(\d+)<\/registros>/);
  const total = totalMatch ? parseInt(totalMatch[1] ?? "0", 10) : 0;

  return { items, total };
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1]?.replace(/<[^>]+>/g, "").trim() ?? "" : "";
}

function parseSTJXml(xml: string): Jurisprudencia[] {
  const docMatches = xml.match(/<documento[\s\S]*?<\/documento>/gi) ?? [];

  return docMatches.map((doc) => {
    const numero = extractTag(doc, "num-processo");
    const relator = extractTag(doc, "min-relator");
    const orgao = extractTag(doc, "orgao-julgador");
    const dataJulg = extractTag(doc, "data-julgamento");
    const ementa = extractTag(doc, "ementa");
    const numReg = extractTag(doc, "num-registro");

    return {
      id: `stj-${numReg || numero}`,
      tribunal: "STJ",
      numero,
      ementa: ementa || "Ementa não disponível",
      relator,
      dataJulgamento: formatDate(dataJulg),
      area: "OUTRO" as LegalArea,
      url: numero
        ? `https://scon.stj.jus.br/SCON/GetInteiroTeorDoAcordao?num_registro=${numReg}&dt_publicacao=${dataJulg}`
        : "https://scon.stj.jus.br/SCON/",
    };
  });
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
    const delayMs = options.delayMs ?? 1500; // STJ sem rate limit documentado — conservador

    let start = 1;

    for (let page = 0; page < maxPages; page++) {
      try {
        const { items, total } = await fetchSconPage(query, start);
        if (items.length === 0) break;

        yield items;

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

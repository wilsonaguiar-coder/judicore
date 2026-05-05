import type { Jurisprudencia, LegalArea } from "../types.js";
import type { JurisprudenciaAdapter, IndexerOptions } from "./types.js";

// LexML — repositório oficial de normas e jurisprudência do governo federal
// Protocolo SRU (Search/Retrieve via URL) — padrão ISO 23950
const LEXML_SRU = "https://www.lexml.gov.br/busca/SRU";

interface SruRecord {
  xml: string;
}

function extractDc(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<(?:dc:|urn:)${tag}[^>]*>([\\s\\S]*?)<\\/(?:dc:|urn:)${tag}>`, "i"))
    ?? xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1]?.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim() ?? "" : "";
}

function parseUrn(urn: string): { tribunal: string; url: string } {
  // URN LexML: urn:lex:br:superior.tribunal.justica;acordao:2023-01-01;resp.1234567-sp
  const tribunalMap: Record<string, string> = {
    "superior.tribunal.justica": "STJ",
    "supremo.tribunal.federal": "STF",
    "tribunal.regional.federal.1.regiao": "TRF1",
    "tribunal.regional.federal.2.regiao": "TRF2",
    "tribunal.regional.federal.3.regiao": "TRF3",
    "tribunal.regional.federal.4.regiao": "TRF4",
    "tribunal.regional.federal.5.regiao": "TRF5",
  };

  const match = urn.match(/urn:lex:br:([^;]+)/);
  const tribunalKey = match?.[1] ?? "";
  const tribunal = tribunalMap[tribunalKey] ?? tribunalKey.split(".").pop()?.toUpperCase() ?? "FEDERAL";
  const url = `https://www.lexml.gov.br/urn/${encodeURIComponent(urn)}`;
  return { tribunal, url };
}

async function fetchLexmlPage(
  query: string,
  start: number
): Promise<{ items: Jurisprudencia[]; total: number }> {
  // Filtra apenas acórdãos e jurisprudência federal
  const cql = `palavras="${query}" AND (tipoDocumento="Acórdão" OR tipoDocumento="Acórdão STF" OR tipoDocumento="Acórdão STJ")`;

  const params = new URLSearchParams({
    operation: "searchRetrieve",
    version: "1.1",
    query: cql,
    maximumRecords: "20",
    startRecord: String(start),
    recordSchema: "info:srw/schema/1/dc-v1.1",
  });

  const res = await fetch(`${LEXML_SRU}?${params}`, {
    headers: {
      "User-Agent": "Judicore/1.0 (pesquisa jurídica institucional)",
      Accept: "application/xml, text/xml",
    },
  });

  if (!res.ok) throw new Error(`LexML HTTP ${res.status}`);

  const xml = await res.text();

  // Total de resultados
  const totalMatch = xml.match(/<(?:srw:)?numberOfRecords>(\d+)<\/(?:srw:)?numberOfRecords>/);
  const total = totalMatch ? parseInt(totalMatch[1] ?? "0", 10) : 0;

  // Extrai cada record
  const recordMatches = xml.match(/<(?:srw:)?recordData[\s\S]*?<\/(?:srw:)?recordData>/gi) ?? [];

  const items: Jurisprudencia[] = recordMatches
    .map((record): Jurisprudencia | null => {
      const urn        = extractDc(record, "identifier");
      const title      = extractDc(record, "title");
      const description = extractDc(record, "description");
      const date       = extractDc(record, "date");
      const creator    = extractDc(record, "creator");

      if (!urn) return null;

      const { tribunal, url } = parseUrn(urn);
      const numero = title || (urn.split(";").pop() ?? urn);

      return {
        id: `lexml-${urn.replace(/[^a-zA-Z0-9]/g, "-")}`,
        tribunal,
        numero,
        ementa: description || title || "Ementa não disponível",
        relator: creator || "Não informado",
        dataJulgamento: date?.slice(0, 10) ?? "",
        area: "OUTRO" as LegalArea,
        url,
      };
    })
    .filter((item): item is Jurisprudencia => item !== null);

  return { items, total };
}

export const lexmlAdapter: JurisprudenciaAdapter = {
  name: "LexML Federal",

  async *fetch(query: string, options: IndexerOptions) {
    const maxPages = options.maxPages ?? 5;
    const delayMs  = options.delayMs ?? 1000;
    let start = 1;

    for (let page = 0; page < maxPages; page++) {
      try {
        const { items, total } = await fetchLexmlPage(query, start);
        if (items.length === 0) break;

        yield items;

        start += 20;
        if (start > total) break;
        await new Promise((r) => setTimeout(r, delayMs));
      } catch (err) {
        console.error(`LexML p${page}:`, err);
        break;
      }
    }
  },
};

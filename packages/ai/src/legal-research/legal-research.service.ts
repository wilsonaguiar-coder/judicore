import { searchJurisprudencia, searchLanceDB } from "@judicore/search";

export interface LegalResearchPack {
  jurisprudenciaLocal: any[];
  jurisprudenciaLexML: any[];
  legislacaoLexML: any[];
  timeLanceDbMs: number;
  timeLexMlMs: number;
  observability?: {
    queryLexML_Jurisprudencia: string;
    queryLexML_Legislacao: string;
    queryLanceDB: string;
    queryTST?: string;
  };
}

export class LegalResearchService {
  /**
   * Monta o Pacote Jurídico combinando LanceDB, Elasticsearch e LexML.
   */
  static async executeResearch(
    keywords: string[],
    userOrientation: string,
    isTrabalhista: boolean
  ): Promise<LegalResearchPack> {
    // 1. Jurisprudência Local
    // A query combina as palavras-chave analíticas do Gemini e a determinação estratégica do usuário.
    const queryBase = `${keywords.join(" ")} ${userOrientation}`.trim().slice(0, 150);
    
    let timeLanceDbMs = 0;
    let timeLexMlMs = 0;

    let jurisprudenciaLocal: any[] = [];

    // 1. Jurisprudência Local LanceDB (STF/STJ)
    try {
      const t0 = Date.now();
      const lanceResults = await searchLanceDB(queryBase, ["STF", "STJ"], 10);
      timeLanceDbMs += Date.now() - t0;
      jurisprudenciaLocal = jurisprudenciaLocal.concat(lanceResults);
    } catch (err: any) {
      console.warn("[LegalResearchService] LanceDB fallback - Falha ao consultar STF/STJ:", err.message);
    }

    // Se trabalhista, adiciona o Elasticsearch para TST
    if (isTrabalhista) {
      try {
        const t1 = Date.now();
        const tstResults = await searchJurisprudencia({
          query: queryBase,
          tribunais: ["TST"],
          size: 10
        });
        timeLanceDbMs += Date.now() - t1; // Treat ES time as LanceDb/Local search time for simplicity
        jurisprudenciaLocal = jurisprudenciaLocal.concat(tstResults.hits.slice(0, 10));
      } catch (err) {
        console.warn("Falha ao buscar TST no Elasticsearch:", err);
      }
    }

    const t2 = Date.now();
    // 2. LexML - Jurisprudência Complementar
    const cqlJuri = `palavras="${queryBase}" AND (tipoDocumento="Acórdão")`;
    const jurisprudenciaLexML = await this.fetchLexml(cqlJuri, 10).catch(() => []);

    // 3. LexML - Legislação
    const cqlLegis = `palavras="${queryBase}" AND (tipoDocumento="Lei" OR tipoDocumento="Decreto" OR tipoDocumento="Constituição")`;
    const legislacaoLexML = await this.fetchLexml(cqlLegis, 10).catch(() => []);
    
    timeLexMlMs = Date.now() - t2;

    return {
      jurisprudenciaLocal,
      jurisprudenciaLexML,
      legislacaoLexML,
      timeLanceDbMs,
      timeLexMlMs,
      observability: {
        queryLexML_Jurisprudencia: cqlJuri,
        queryLexML_Legislacao: cqlLegis,
        queryLanceDB: queryBase,
        ...(isTrabalhista ? { queryTST: queryBase } : {})
      }
    };
  }

  private static async fetchLexml(cql: string, limit: number) {
    const params = new URLSearchParams({
      operation: "searchRetrieve",
      version: "1.1",
      query: cql,
      maximumRecords: String(limit),
      startRecord: "1",
      recordSchema: "info:srw/schema/1/dc-v1.1",
    });

    const url = `https://www.lexml.gov.br/busca/SRU?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Judicore/1.0 (pesquisa jurídica institucional)",
        Accept: "application/xml, text/xml",
      }
    });
    
    if (!res.ok) throw new Error(`LexML HTTP Error ${res.status}`);
    const xml = await res.text();
    
    const recordMatches = xml.match(/<(?:srw:)?recordData[\s\S]*?<\/(?:srw:)?recordData>/gi) ?? [];
    return recordMatches.map(record => {
      const title = this.extractDc(record, "title");
      const desc = this.extractDc(record, "description");
      const urn = this.extractDc(record, "identifier");
      return {
        titulo: title,
        conteudo: desc || title || "Não disponível",
        fonte: urn
      };
    });
  }

  private static extractDc(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<(?:dc:|urn:)${tag}[^>]*>([\\s\\S]*?)<\\/(?:dc:|urn:)${tag}>`, "i"))
      ?? xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    return match ? match[1]?.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim() ?? "" : "";
  }
}

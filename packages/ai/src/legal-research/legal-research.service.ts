import { searchJurisprudencia, searchLanceDB } from "@judicore/search";
import type { PieceBrief } from "../generation-pipeline/piece-brief.service.js";

export interface RankedResult {
  titulo: string;
  conteudo: string;
  fonte: string;
  tribunal?: string;
  numero?: string;
  ementa?: string;
  tese?: string;
  score: number;
  reason?: string;
}

export interface TeseResearchPack {
  tese: string;
  queries: {
    lanceDB: string;
    lexMLOldQuery: string;
    lexMLQueries: { cql: string; returnedCount: number; url: string }[];
  };
  jurisprudencia: RankedResult[];
  legislacao: RankedResult[];
  descartes: RankedResult[];
}

export interface LegalResearchPack {
  teses: TeseResearchPack[];
  timeLanceDbMs: number;
  timeLexMlMs: number;
}

export class LegalResearchService {
  static async executeResearch(
    brief: PieceBrief,
    userOrientation: string,
    isTrabalhista: boolean,
    domain: string = "CIVIL"
  ): Promise<LegalResearchPack> {
    
    let timeLanceDbMs = 0;
    let timeLexMlMs = 0;
    
    const tesesBase = brief.tesesIdentificadas && brief.tesesIdentificadas.length > 0 
      ? brief.tesesIdentificadas 
      : [brief.estrategiaSugerida || "Tese Principal"];

    const researchPacks: TeseResearchPack[] = [];

    for (const teseText of tesesBase) {
       // LanceDB Query (Vetor/BM25 tolera query maior)
       const cleanWords = teseText.split(" ").map(w => w.replace(/[.,()]/g, ""));
       const allowList = ["tema", "re", "are", "stf", "stj", "ec", "lei", "art"];
       const siglaMatches = cleanWords.filter(w => allowList.includes(w.toLowerCase()) || !isNaN(parseInt(w)));
       const normalWords = cleanWords.filter(w => w.length > 5 && !siglaMatches.includes(w));
       const keywords = [...siglaMatches, ...normalWords].slice(0, 12);
       const coreKeywords = Array.from(new Set([...keywords, ...(brief.palavrasChave || []).slice(0, 3)])).slice(0, 15);
       const lanceDbQueryString = coreKeywords.join(" ");

       // Old Query para o Snapshot
       const oldQuery = `palavras="${lanceDbQueryString}" AND (tipoDocumento="Acórdão")`;

       // Novas Queries Curtas para o LexML
       const lexmlQueriesList = this.buildLexmlQueriesForTese(teseText, brief);
       const lexMLQueriesLogged: { cql: string; returnedCount: number; url: string }[] = [];

       let rawJuri: any[] = [];
       let rawLegis: any[] = [];
       const descartes: RankedResult[] = [];

       // 1. LanceDB
       try {
         const t0 = Date.now();
         const lanceResults = await searchLanceDB(lanceDbQueryString, ["STF", "STJ"], 10);
         timeLanceDbMs += Date.now() - t0;
         rawJuri = rawJuri.concat(lanceResults.map((r: any) => ({ ...r, origin: "LanceDB" })));
       } catch (err: any) {
         console.warn("[LegalResearchService] LanceDB fallback:", err.message);
       }

       // 2. LexML Múltiplas Chamadas (Sem usar OR no SRU CQL)
       for (const lq of lexmlQueriesList) {
           let currentUrl = "";
           try {
               const fullCql = `${lq.cql} AND (${lq.type === "Juri" ? 'tipoDocumento="Acórdão"' : 'tipoDocumento="Lei" OR tipoDocumento="Decreto" OR tipoDocumento="Constituição"'})`;
               const limit = 5; // Menos resultados por query curta
               const t1 = Date.now();
               
               const params = new URLSearchParams({
                  operation: "searchRetrieve",
                  version: "1.1",
                  query: fullCql,
                  maximumRecords: String(limit),
                  startRecord: "1",
                  recordSchema: "info:srw/schema/1/dc-v1.1",
               });
               currentUrl = `https://www.lexml.gov.br/busca/SRU?${params.toString()}`;

               const { results } = await this.fetchLexmlWithUrl(currentUrl);
               timeLexMlMs += Date.now() - t1;
               
               lexMLQueriesLogged.push({ cql: lq.cql, returnedCount: results.length, url: currentUrl });

               if (lq.type === "Juri") {
                   rawJuri = rawJuri.concat(results.map(r => ({ ...r, origin: "LexML", tribunal: "LexML" })));
               } else {
                   rawLegis = rawLegis.concat(results.map(r => ({ ...r, origin: "LexML" })));
               }
           } catch (err) {
               lexMLQueriesLogged.push({ cql: lq.cql, returnedCount: 0, url: currentUrl || "Erro de Conexão" });
           }
       }

       // DEDUPLICAÇÃO E RANKING JURISPRUDÊNCIA LOCAL
       const dedupMapJuri = new Map<string, any>();
       for (const r of rawJuri) {
           const id = r.numero || r.titulo;
           if (!id) continue;
           if (dedupMapJuri.has(id)) {
               const exist = dedupMapJuri.get(id);
               if (!exist.origin.includes(r.origin)) exist.origin += ` + ${r.origin}`;
           } else {
               dedupMapJuri.set(id, r);
           }
       }

       const rankedJuri: RankedResult[] = [];
       for (const item of dedupMapJuri.values()) {
           const scored = this.rankResults(item, teseText, domain, brief.tipoPeca, userOrientation, item.origin, item.tribunal);
           if (scored.score > 0.3) {
               rankedJuri.push(scored);
           } else {
               descartes.push(scored);
           }
       }

       // DEDUPLICAÇÃO E RANKING LEGISLAÇÃO LOCAL
       const dedupMapLegis = new Map<string, any>();
       for (const r of rawLegis) {
           const id = r.titulo;
           if (!dedupMapLegis.has(id)) dedupMapLegis.set(id, r);
       }

       const rankedLegis: RankedResult[] = [];
       for (const item of dedupMapLegis.values()) {
           const scored = this.rankResults(item, teseText, domain, brief.tipoPeca, userOrientation, item.origin);
           if (scored.score > 0.2) {
               rankedLegis.push(scored);
           } else {
               descartes.push(scored);
           }
       }

       researchPacks.push({
          tese: teseText,
          queries: {
             lanceDB: lanceDbQueryString,
             lexMLOldQuery: oldQuery,
             lexMLQueries: lexMLQueriesLogged
          },
          jurisprudencia: rankedJuri.sort((a,b) => b.score - a.score),
          legislacao: rankedLegis.sort((a,b) => b.score - a.score),
          descartes
       });
    }

    return { teses: researchPacks, timeLanceDbMs, timeLexMlMs };
  }

  private static buildLexmlQueriesForTese(teseText: string, brief: PieceBrief): { type: "Juri"|"Legis", cql: string }[] {
      const queries: { type: "Juri"|"Legis", cql: string }[] = [];
      const lower = teseText.toLowerCase();

      // Q2 - Jurisprudência Exata (Normalização de Tema e RE)
      const temaMatch = lower.match(/tema\s*(\d+)/);
      if (temaMatch) {
          queries.push({ type: "Juri", cql: `palavras="Tema ${temaMatch[1]}"` });
      }

      const reMatch = lower.match(/re\s*(\d+)[.-]?(\d+)?/);
      if (reMatch) {
          const rawNum = reMatch[0].replace(/[^0-9]/g, ""); // Ex: 603580
          queries.push({ type: "Juri", cql: `palavras="RE ${rawNum}"` });
          if (rawNum.length > 3) {
              const formatted = `RE ${rawNum.slice(0,3)}.${rawNum.slice(3)}`;
              queries.push({ type: "Juri", cql: `palavras="${formatted}"` });
          }
      }

      // Q3 - Normativa Exata (captura TODAS as ECs com matchAll — EC 41, EC 41/2003, Emenda Constitucional nº 41, etc.)
      const ecRegex = /(?:\bec\b|emenda constitucional)\s*(?:n[.o]?\s*)?(\d+)(?:\/(\d{4}))?/gi;
      const ecMatches = Array.from(lower.matchAll(ecRegex));
      const seenEcs = new Set<string>();
      let ecNumber: string | null = null;

      for (const ecMatch of ecMatches) {
          const num = ecMatch[1];
          const year = ecMatch[2] || null;
          if (seenEcs.has(num)) continue;
          seenEcs.add(num);

          if (!ecNumber) ecNumber = num; // primeiro EC detectado para uso no Q1

          queries.push({ type: "Legis", cql: `palavras="EC ${num}"` });
          queries.push({ type: "Juri",  cql: `palavras="EC ${num}"` });
          if (year) {
              queries.push({ type: "Legis", cql: `palavras="EC ${num}/${year}"` });
              queries.push({ type: "Juri",  cql: `palavras="EC ${num}/${year}"` });
          }
      }


      // Q1 - Conceitual
      const teseKeywords = (brief.palavrasChave || []).filter(kw => lower.includes(kw.toLowerCase()));
      const selected = teseKeywords.filter(kw => !kw.toLowerCase().includes("tema") && !kw.toLowerCase().includes("re") && !kw.toLowerCase().includes("ec ")).slice(0, 2);
      
      if (selected.length > 0) {
          const mainConcept = selected.join(" ");
          queries.push({ type: "Juri", cql: `palavras="${mainConcept}"` });
          if (ecNumber) {
              queries.push({ type: "Juri", cql: `palavras="EC ${ecNumber} ${mainConcept}"` });
          }
      } else {
          // Fallback se não encontrar keywords prontas
          const stopwords = ["direito","procedência","pedido","benefício","servidor","instituidor","falecido","após","geral","regra","exceção","entendimento","firmado","aplicação","houvesse"];
          const cleanWords = lower.replace(/[.,():/]/g, " ").split(" ")
             .filter(w => w.length > 5 && !stopwords.includes(w));
          const fallback = Array.from(new Set(cleanWords)).slice(0, 2).join(" ");
          if (fallback) {
              queries.push({ type: "Juri", cql: `palavras="${fallback}"` });
          }
      }

      return queries;
  }

  private static async fetchLexmlWithUrl(url: string): Promise<{ results: any[] }> {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Judicore/1.0",
        Accept: "application/xml, text/xml",
      }
    });
    
    if (!res.ok) throw new Error(`LexML HTTP Error ${res.status}`);
    const xml = await res.text();
    
    const recordMatches = xml.match(/<(?:srw:)?recordData[\s\S]*?<\/(?:srw:)?recordData>/gi) ?? [];
    const results = recordMatches.map(record => {
      const title = this.extractDc(record, "title");
      const desc = this.extractDc(record, "description");
      const urn = this.extractDc(record, "identifier");
      return {
        titulo: title,
        conteudo: desc || title || "Não disponível",
        fonte: urn
      };
    });

    return { results };
  }

  private static rankResults(
    item: any, 
    teseText: string, 
    domain: string, 
    pieceType: string, 
    userOrientation: string, 
    source: string, 
    tribunal?: string
  ): RankedResult {
      let score = 1.0;
      let reason = "Aderência inicial";

      const textContext = ((item.titulo || "") + " " + (item.ementa || "") + " " + (item.conteudo || "")).toLowerCase();
      const teseKeywords = teseText.toLowerCase().split(" ").filter(w => w.length > 4);

      let hits = 0;
      for (const w of teseKeywords) {
          if (textContext.includes(w)) hits++;
      }
      if (hits > 0) {
          score += (hits * 0.1);
          reason += ` | Match tese (+${(hits*0.1).toFixed(1)})`;
      }

      if (tribunal && (tribunal.includes("STF") || tribunal.includes("STJ"))) {
          score += 0.3;
          reason += " | STF/STJ (+0.3)";
      }

      if (item.ementa && item.ementa.length > 150) {
          score += 0.2;
          reason += " | Ementa rica (+0.2)";
      } else if (!item.ementa && !source.includes("LexML")) {
          score -= 0.5;
          reason += " | Sem ementa (-0.5)";
      }

      if (textContext.includes("repercussão geral") || textContext.includes("recurso repetitivo") || textContext.match(/tema \d+/)) {
          score += 0.4;
          reason += " | Repercussão/Repetitivo (+0.4)";
      }

      const contaminations = ["militar", "policial", "ferroviário", "invalidez", "penal", "criminal"];
      for (const cont of contaminations) {
          if (textContext.includes(cont) && !userOrientation.toLowerCase().includes(cont) && !teseText.toLowerCase().includes(cont)) {
              score -= 0.8;
              reason += ` | Subtema Incompatível (${cont}) (-0.8)`;
          }
      }

      return {
          titulo: item.titulo || "Desconhecido",
          conteudo: item.conteudo || item.texto || item.conteudoIntegral || "",
          fonte: source,
          tribunal: tribunal || item.tribunal,
          numero: item.numero,
          ementa: item.ementa,
          tese: item.tese,
          score: parseFloat(score.toFixed(2)),
          reason
      };
  }

  private static extractDc(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<(?:dc:|urn:)${tag}[^>]*>([\\s\\S]*?)<\\/(?:dc:|urn:)${tag}>`, "i"))
      ?? xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    return match ? match[1]?.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim() ?? "" : "";
  }
}

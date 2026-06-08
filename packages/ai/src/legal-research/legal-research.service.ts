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
    lexMLJuri: string;
    lexMLLegis: string;
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
  /**
   * Monta o Pacote Jurídico combinando LanceDB, Elasticsearch e LexML de forma isolada por Tese.
   */
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
       // Extração simples das palavras-chave da tese (remove stopwords curtas)
       const keywords = teseText.split(" ")
         .filter(w => w.length > 4)
         .map(w => w.replace(/[.,()]/g, ""))
         .slice(0, 10);
       
       // Inclui termos centrais do brief, se faltarem, para dar contexto mínimo, limitando
       const coreKeywords = Array.from(new Set([...keywords, ...(brief.palavrasChave || []).slice(0, 3)])).slice(0, 8);
       const queryString = coreKeywords.join(" ");

       const queryLexJuri = `palavras="${queryString}" AND (tipoDocumento="Acórdão")`;
       const queryLexLegis = `palavras="${queryString}" AND (tipoDocumento="Lei" OR tipoDocumento="Decreto" OR tipoDocumento="Constituição")`;

       let rawJuri: any[] = [];
       let rawLegis: any[] = [];
       const descartes: RankedResult[] = [];

       // 1. LANCEDb (Jurisprudência)
       try {
         const t0 = Date.now();
         const lanceResults = await searchLanceDB(queryString, ["STF", "STJ"], 10);
         timeLanceDbMs += Date.now() - t0;
         rawJuri = rawJuri.concat(lanceResults.map((r: any) => ({ ...r, origin: "LanceDB" })));
       } catch (err: any) {
         console.warn("[LegalResearchService] LanceDB fallback:", err.message);
       }

       // 2. LexML Jurisprudencia
       try {
         const t1 = Date.now();
         const lexmlJuri = await this.fetchLexml(queryLexJuri, 10);
         timeLexMlMs += Date.now() - t1;
         rawJuri = rawJuri.concat(lexmlJuri.map(r => ({ ...r, origin: "LexML", tribunal: "LexML" })));
       } catch (err) {}

       // 3. LexML Legislacao
       try {
         const t2 = Date.now();
         const lexmlLegis = await this.fetchLexml(queryLexLegis, 10);
         timeLexMlMs += Date.now() - t2;
         rawLegis = rawLegis.concat(lexmlLegis.map(r => ({ ...r, origin: "LexML" })));
       } catch (err) {}

       // RANKING JURISPRUDÊNCIA
       const rankedJuri: RankedResult[] = [];
       for (const item of rawJuri) {
           const scored = this.rankResults(item, teseText, domain, brief.tipoPeca, userOrientation, item.origin, item.tribunal);
           if (scored.score > 0.3) { // Threshold de aceite
               rankedJuri.push(scored);
           } else {
               descartes.push(scored);
           }
       }

       // DEDUPLICAÇÃO JURISPRUDÊNCIA (Mesclar LanceDB e LexML se mesmo RE/AgInt)
       const dedupJuri = new Map<string, RankedResult>();
       for (const r of rankedJuri) {
           // Tenta extrair o número do processo como chave única
           const numMatch = (r.titulo || r.numero || "").match(/(?:RE|ARE|HC|AgInt|REsp|MS)[\s\d.-]+/i);
           const key = numMatch ? numMatch[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase() : r.titulo;
           
           if (dedupJuri.has(key)) {
               const existing = dedupJuri.get(key)!;
               existing.fonte = `${existing.fonte} + ${r.fonte}`;
               // Mantém o conteúdo mais rico
               if ((r.ementa?.length || 0) > (existing.ementa?.length || 0)) {
                   existing.ementa = r.ementa;
                   existing.conteudo = r.conteudo;
               }
           } else {
               dedupJuri.set(key, r);
           }
       }

       // RANKING LEGISLAÇÃO
       const rankedLegis: RankedResult[] = [];
       for (const item of rawLegis) {
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
             lanceDB: queryString,
             lexMLJuri: queryLexJuri,
             lexMLLegis: queryLexLegis
          },
          jurisprudencia: Array.from(dedupJuri.values()).sort((a,b) => b.score - a.score),
          legislacao: rankedLegis.sort((a,b) => b.score - a.score),
          descartes
       });
    }

    return {
      teses: researchPacks,
      timeLanceDbMs,
      timeLexMlMs
    };
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

      // + Aderência à tese
      let hits = 0;
      for (const w of teseKeywords) {
          if (textContext.includes(w)) hits++;
      }
      if (hits > 0) {
          score += (hits * 0.1);
          reason += ` | Match tese (+${(hits*0.1).toFixed(1)})`;
      }

      // + Tribunal Superior
      if (tribunal && (tribunal.includes("STF") || tribunal.includes("STJ"))) {
          score += 0.3;
          reason += " | STF/STJ (+0.3)";
      }

      // + Ementa Rica
      if (item.ementa && item.ementa.length > 150) {
          score += 0.2;
          reason += " | Ementa rica (+0.2)";
      } else if (!item.ementa && source !== "LexML") {
          score -= 0.5;
          reason += " | Sem ementa (-0.5)";
      }

      // + Temas de Repercussão Geral
      if (textContext.includes("repercussão geral") || textContext.includes("recurso repetitivo") || textContext.match(/tema \d+/)) {
          score += 0.4;
          reason += " | Repercussão/Repetitivo (+0.4)";
      }

      // - Contaminação de domínio
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
        "User-Agent": "Judicore/1.0",
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

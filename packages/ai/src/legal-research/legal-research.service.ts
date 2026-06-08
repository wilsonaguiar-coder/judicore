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
    lexMLQueries: { keyword: string; returnedCount: number; url: string }[];
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
      // LanceDB query string
      const cleanWords = teseText.split(" ").map(w => w.replace(/[.,()]/g, ""));
      const allowList = ["tema", "re", "are", "stf", "stj", "ec", "lei", "art"];
      const siglaMatches = cleanWords.filter(w => allowList.includes(w.toLowerCase()) || !isNaN(parseInt(w)));
      const normalWords = cleanWords.filter(w => w.length > 5 && !siglaMatches.includes(w));
      const keywords = [...siglaMatches, ...normalWords].slice(0, 12);
      const coreKeywords = Array.from(new Set([...keywords, ...(brief.palavrasChave || []).slice(0, 3)])).slice(0, 15);
      const lanceDbQueryString = coreKeywords.join(" ");

      // LexML keyword queries (HTML search — SRU endpoint was removed)
      const lexmlQueriesList = this.buildLexmlQueriesForTese(teseText, brief);
      const lexMLQueriesLogged: { keyword: string; returnedCount: number; url: string }[] = [];

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

      // 2. LexML — HTML keyword search (/busca/search?keyword=...&f1-tipoDocumento=...)
      for (const lq of lexmlQueriesList) {
        let currentUrl = "";
        try {
          const t1 = Date.now();
          const { results, url } = await this.fetchLexmlSearch(lq.keyword, lq.type);
          timeLexMlMs += Date.now() - t1;
          currentUrl = url;

          lexMLQueriesLogged.push({ keyword: lq.keyword, returnedCount: results.length, url });

          if (lq.type === "Juri") {
            rawJuri = rawJuri.concat(results.map(r => ({ ...r, origin: "LexML" })));
          } else {
            rawLegis = rawLegis.concat(results.map(r => ({ ...r, origin: "LexML" })));
          }
        } catch (err) {
          lexMLQueriesLogged.push({ keyword: lq.keyword, returnedCount: 0, url: currentUrl || "Erro de Conexão" });
        }
      }

      // DEDUPLICAÇÃO E RANKING — JURISPRUDÊNCIA
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

      // DEDUPLICAÇÃO E RANKING — LEGISLAÇÃO
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
          lexMLQueries: lexMLQueriesLogged,
        },
        jurisprudencia: rankedJuri.sort((a, b) => b.score - a.score),
        legislacao: rankedLegis.sort((a, b) => b.score - a.score),
        descartes,
      });
    }

    return { teses: researchPacks, timeLanceDbMs, timeLexMlMs };
  }

  // Builds keyword strings for /busca/search — simpler and more effective than SRU CQL
  private static buildLexmlQueriesForTese(
    teseText: string,
    brief: PieceBrief
  ): { type: "Juri" | "Legis"; keyword: string }[] {
    const queries: { type: "Juri" | "Legis"; keyword: string }[] = [];
    const lower = teseText.toLowerCase();

    // Collect EC references
    const ecRegex = /(?:\bec\b|emenda constitucional)\s*(?:n[.o]?\s*)?(\d+)(?:\/(\d{4}))?/gi;
    const ecMatches = Array.from(lower.matchAll(ecRegex));
    const seenEcs = new Set<string>();
    const ecTerms: string[] = [];
    for (const m of ecMatches) {
      const num = m[1];
      const year = m[2];
      if (seenEcs.has(num)) continue;
      seenEcs.add(num);
      ecTerms.push(year ? `EC ${num}/${year}` : `EC ${num}`);
    }

    // Collect Tema reference
    const temaMatch = lower.match(/tema\s*(\d+)/);

    // Collect RE/ARE/REsp numbers
    const reMatch = lower.match(/\b(re|are|resp)\s*(\d+)/i);

    // Get relevant palavrasChave (those that appear in the tese text)
    const relevantKw = (brief.palavrasChave || [])
      .filter(kw => lower.includes(kw.toLowerCase()))
      .filter(kw => kw.length > 5 && !kw.toLowerCase().startsWith("tema") && !kw.toLowerCase().startsWith("re "))
      .slice(0, 3);

    // Q1 — main conceptual query: brief keywords + first EC term
    const mainParts = [...relevantKw.slice(0, 2), ...ecTerms.slice(0, 1)].filter(Boolean);
    if (mainParts.length > 0) {
      queries.push({ type: "Juri", keyword: mainParts.join(" ") });
    } else {
      // Fallback: extract meaningful words from tese
      const stopwords = new Set(["direito", "pedido", "benefício", "servidor", "instituidor",
        "falecido", "geral", "regra", "exceção", "entendimento", "firmado", "aplicação"]);
      const fallbackWords = lower.replace(/[.,():/]/g, " ").split(/\s+/)
        .filter(w => w.length > 6 && !stopwords.has(w));
      const fallback = Array.from(new Set(fallbackWords)).slice(0, 3).join(" ");
      if (fallback) queries.push({ type: "Juri", keyword: fallback });
    }

    // Q2 — Tema-specific query
    if (temaMatch) {
      const temaKw = relevantKw[0] ? `Tema ${temaMatch[1]} ${relevantKw[0]}` : `Tema ${temaMatch[1]}`;
      queries.push({ type: "Juri", keyword: temaKw });
    }

    // Q3 — RE/ARE/REsp-specific query
    if (reMatch) {
      queries.push({ type: "Juri", keyword: `${reMatch[1].toUpperCase()} ${reMatch[2]}` });
    }

    // Q4 — EC-focused jurisprudência (if EC not already in Q1)
    if (ecTerms.length > 0 && relevantKw.length > 1) {
      queries.push({ type: "Juri", keyword: `${ecTerms[0]} ${relevantKw[1]}` });
    }

    return queries;
  }

  // Fetches /busca/search and parses HTML results (replaces defunct SRU endpoint)
  private static async fetchLexmlSearch(
    keyword: string,
    type: "Juri" | "Legis"
  ): Promise<{ results: any[]; url: string }> {
    const params = new URLSearchParams({
      keyword,
      "f1-tipoDocumento": type === "Juri" ? "Jurisprudência" : "Legislação",
    });
    const url = `https://www.lexml.gov.br/busca/search?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 Judicore/1.0",
        Accept: "text/html",
      },
    });
    if (!res.ok) throw new Error(`LexML HTTP ${res.status}`);
    const html = await res.text();
    const results = this.parseLexmlSearchHtml(html);
    return { results, url };
  }

  // Parses the /busca/search HTML page into structured result objects
  private static parseLexmlSearchHtml(html: string): any[] {
    const results: any[] = [];

    // Each result is inside a div with class="docHit"
    const blocks = html.split(/(?=<div[^>]+class="docHit")/gi).filter(b => b.includes('class="docHit"'));

    for (const block of blocks) {
      const autoridade = this.extractLexmlField(block, "Autoridade");
      const tituloRaw  = this.extractLexmlField(block, "Título");
      const ementa     = this.extractLexmlField(block, "Ementa");
      const urn        = this.extractLexmlField(block, "URN");

      if (!urn && !autoridade) continue;

      const titulo = this.cleanHtml(tituloRaw);
      const tribunal = this.parseTribunal(autoridade);

      // Extract decision number from title (e.g. "ARE 1300613 AgR-segundo / CE")
      const numeroMatch = titulo.match(/^([A-Z]+\s+[\d.-]+)/);
      const numero = numeroMatch ? numeroMatch[1].trim() : titulo.slice(0, 40);

      const cleanEmenta = this.cleanHtml(ementa);

      results.push({
        titulo,
        conteudo: cleanEmenta || titulo,
        fonte: urn || "LexML",
        autoridade,
        tribunal,
        numero,
        ementa: cleanEmenta,
      });
    }

    return results;
  }

  // Extracts a field value from a docHit HTML block by its label name
  private static extractLexmlField(block: string, fieldName: string): string {
    const regex = new RegExp(
      `${fieldName}\\s*(?:\\s|&nbsp;)*<\\/b><\\/td><td[^>]*>([\\s\\S]*?)<\\/td>`,
      "i"
    );
    const m = block.match(regex);
    return m ? m[1].trim() : "";
  }

  // Maps full tribunal name to abbreviation for scoring
  private static parseTribunal(autoridade: string): string {
    const lower = autoridade.toLowerCase();
    if (lower.includes("supremo tribunal federal")) return "STF";
    if (lower.includes("superior tribunal de justiça")) return "STJ";
    if (lower.includes("tribunal superior do trabalho")) return "TST";
    if (lower.includes("tribunal regional federal")) return "TRF";
    return autoridade.split(".")[0].trim() || "Outro";
  }

  // Strips HTML tags and decodes common entities
  private static cleanHtml(html: string): string {
    return html
      .replace(/<span[^>]*>/gi, "")
      .replace(/<\/span>/gi, "")
      .replace(/<a[^>]*>/gi, "")
      .replace(/<\/a>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#150;/g, " – ")
      .replace(/&#147;/g, '"')
      .replace(/&#148;/g, '"')
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
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
      score += hits * 0.1;
      reason += ` | Match tese (+${(hits * 0.1).toFixed(1)})`;
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

    if (
      textContext.includes("repercussão geral") ||
      textContext.includes("recurso repetitivo") ||
      textContext.match(/tema \d+/)
    ) {
      score += 0.4;
      reason += " | Repercussão/Repetitivo (+0.4)";
    }

    const contaminations = ["militar", "policial", "ferroviário", "invalidez", "penal", "criminal"];
    for (const cont of contaminations) {
      if (
        textContext.includes(cont) &&
        !userOrientation.toLowerCase().includes(cont) &&
        !teseText.toLowerCase().includes(cont)
      ) {
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
      reason,
    };
  }
}

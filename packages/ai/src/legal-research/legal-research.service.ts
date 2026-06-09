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

    // Usar a teseCentralBusca fornecida pelo analista (fallback para palavrasChave)
    const searchPhrase = brief.teseCentralBusca || (brief.palavrasChave || []).join(" ");
    const lanceDbQueryString = searchPhrase.slice(0, 100);

    let globalRawJuri: any[] = [];
    let globalRawLegis: any[] = [];
    const lexMLQueriesLogged: { keyword: string; returnedCount: number; url: string }[] = [];

    // Executar buscas em paralelo para acelerar drasticamente o pipeline
    const t0 = Date.now();
    const lancePromise = searchLanceDB(lanceDbQueryString, ["STF", "STJ"], 10)
      .then(results => { globalRawJuri = globalRawJuri.concat(results.map((r: any) => ({ ...r, origin: "LanceDB" }))); })
      .catch(err => console.warn("[LegalResearchService] LanceDB fallback:", err.message));

    const lexmlJuriPromise = this.fetchLexmlSearch(searchPhrase, "Juri")
      .then(({ results, url }) => {
        lexMLQueriesLogged.push({ keyword: searchPhrase, returnedCount: results.length, url });
        globalRawJuri = globalRawJuri.concat(results.map(r => ({ ...r, origin: "LexML" })));
      })
      .catch(() => { lexMLQueriesLogged.push({ keyword: searchPhrase, returnedCount: 0, url: "Erro de Conexão" }); });

    const lexmlLegisPromise = this.fetchLexmlSearch(searchPhrase, "Legis")
      .then(({ results, url }) => {
        lexMLQueriesLogged.push({ keyword: searchPhrase, returnedCount: results.length, url });
        globalRawLegis = globalRawLegis.concat(results.map(r => ({ ...r, origin: "LexML" })));
      })
      .catch(() => { lexMLQueriesLogged.push({ keyword: searchPhrase, returnedCount: 0, url: "Erro de Conexão" }); });

    await Promise.all([lancePromise, lexmlJuriPromise, lexmlLegisPromise]);
    const totalTimeMs = Date.now() - t0;
    timeLanceDbMs = totalTimeMs;
    timeLexMlMs = totalTimeMs;

    const researchPacks: TeseResearchPack[] = [];

    for (let i = 0; i < tesesBase.length; i++) {
      const teseText = tesesBase[i];
      const rawJuri = [...globalRawJuri];
      const rawLegis = [...globalRawLegis];
      const descartes: RankedResult[] = [];

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
        const scored = this.rankResults(
          item, teseText, domain, brief.tipoPeca, userOrientation,
          item.origin, item.tribunal, brief.palavrasChave
        );
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
        const scored = this.rankResults(
          item, teseText, domain, brief.tipoPeca, userOrientation,
          item.origin, undefined, brief.palavrasChave
        );
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

    const blocks = html.split(/(?=<div[^>]+class="docHit")/gi).filter(b => b.includes('class="docHit"'));

    for (const block of blocks) {
      const autoridade = this.extractLexmlField(block, "Autoridade");
      const tituloRaw  = this.extractLexmlField(block, "Título");
      const ementa     = this.extractLexmlField(block, "Ementa");
      const urn        = this.extractLexmlField(block, "URN");

      if (!urn && !autoridade) continue;

      const titulo = this.cleanHtml(tituloRaw);
      const tribunal = this.parseTribunal(autoridade);

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

  private static extractLexmlField(block: string, fieldName: string): string {
    const regex = new RegExp(
      `${fieldName}\\s*(?:\\s|&nbsp;)*<\\/b><\\/td><td[^>]*>([\\s\\S]*?)<\\/td>`,
      "i"
    );
    const m = block.match(regex);
    return m ? m[1].trim() : "";
  }

  private static parseTribunal(autoridade: string): string {
    const lower = autoridade.toLowerCase();
    if (lower.includes("supremo tribunal federal")) return "STF";
    if (lower.includes("superior tribunal de justiça")) return "STJ";
    if (lower.includes("tribunal superior do trabalho")) return "TST";
    if (lower.includes("tribunal regional federal")) return "TRF";
    return autoridade.split(".")[0].trim() || "Outro";
  }

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
    tribunal?: string,
    briefKeywords?: string[]
  ): RankedResult {
    let score = 1.0;
    let reason = "Base";

    const textContext = (
      (item.titulo || "") + " " +
      (item.ementa || "") + " " +
      (item.conteudo || "")
    ).toLowerCase();

    const teseWords = teseText.toLowerCase().split(" ").filter(w => w.length > 4);
    let teseHits = 0;
    for (const w of teseWords) {
      if (textContext.includes(w)) teseHits++;
    }
    if (teseHits > 0) {
      score += teseHits * 0.1;
      reason += ` | Tese ${teseHits}(+${(teseHits * 0.1).toFixed(1)})`;
    }

    // Brief-anchored relevance: counts how many of the case's specific keywords
    // appear in this decision's ementa/content.
    // Zero matches → likely off-topic regardless of court prestige → penalize heavily.
    // 2+ matches → strong contextual signal → reward.
    if (briefKeywords && briefKeywords.length >= 3) {
      let briefHits = 0;
      for (const kw of briefKeywords) {
        if (textContext.includes(kw.toLowerCase())) briefHits++;
      }
      if (briefHits >= 2) {
        const bonus = parseFloat((briefHits * 0.25).toFixed(2));
        score += bonus;
        reason += ` | BriefMatch ${briefHits}(+${bonus})`;
      } else if (briefHits === 0) {
        score *= 0.1;
        reason += ` | Off-topic(0/${briefKeywords.length})`;
      }
    }

    if (tribunal && (tribunal.includes("STF") || tribunal.includes("STJ"))) {
      score += 0.3;
      reason += " | STF/STJ(+0.3)";
    }

    if (item.ementa && item.ementa.length > 150) {
      score += 0.2;
      reason += " | Ementa(+0.2)";
    } else if (!item.ementa && !source.includes("LexML")) {
      score -= 0.5;
      reason += " | SemEmenta(-0.5)";
    }

    if (
      textContext.includes("repercussão geral") ||
      textContext.includes("recurso repetitivo") ||
      textContext.match(/tema \d+/)
    ) {
      score += 0.4;
      reason += " | RepGeral(+0.4)";
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

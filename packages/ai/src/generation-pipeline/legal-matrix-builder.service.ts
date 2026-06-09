import type { PieceBrief } from "./piece-brief.service.js";
import type { LegalResearchPack } from "../legal-research/legal-research.service.js";
import { PrismaClient } from "@judicore/db";

function toArr(v: any): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim()) return [v];
  return [];
}

const prisma = new PrismaClient();

export interface LegalMatrixTese {
  tese: string;
  fatosRelevantes: string[];
  fundamentosLegais: string[];
  jurisprudenciaAplicavel: string[];
  aplicacaoConcreta: string;
  pedidoRelacionado: string;
}

export interface LegalMatrix {
  teses: LegalMatrixTese[];
  legislacaoSelecionada: any[];
  jurisprudenciaSelecionada: any[];
  observability?: any;
}

// ─────────────────────────────────────────────────────────────
// 1. NORMALIZAÇÃO DE DISPOSITIVOS
//    Remove o prefixo "Art." independente de maiúsculas ou pontuação.
//    "Art. 1º" → "1º"   |  "ART. 5°" → "5°"  |  "art 40" → "40"
// ─────────────────────────────────────────────────────────────
function normalizeDispositivo(raw: string): string {
  return raw.trim().replace(/^art\.?\s*/i, "").trim();
}

// ─────────────────────────────────────────────────────────────
// 2. GENERIC AUTHORITY FILTER
//    Retorna `true` se o dispositivo deve ser bloqueado.
//    Art. 1º, 3º, 4º, 6º CF: sempre bloqueados.
//    Art. 5º CF inteiro: bloqueado — só passa com inciso explícito.
// ─────────────────────────────────────────────────────────────
function isGenericCFAuthority(dispositivo: string, normaNome: string): boolean {
  if (!normaNome.toLowerCase().includes("constituição")) return false;
  const norm = normalizeDispositivo(dispositivo).toLowerCase();
  // bloqueia sempre os genéricos
  if (["1º", "1°", "1o", "3º", "3°", "3o", "4º", "4°", "4o", "6º", "6°", "6o"].includes(norm)) return true;
  // bloqueia art. 5º sem inciso (sem "inciso", "§", ou letra específica)
  if ((norm === "5º" || norm === "5°" || norm === "5o") && !dispositivo.match(/inciso|§|\bI\b|\bII\b|\bXXXVI\b/i)) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────
// 3. LEGISLATION RANKER — score temático por domínio
// ─────────────────────────────────────────────────────────────
interface LegislationScore {
  score: number;
  reason: string;
  foundInBrief: boolean;
}

function rankLegislation(
  dispositivo: string,
  normaNome: string,
  teseText: string,
  combinedContext: string,
  brief: PieceBrief
): LegislationScore {
  const normNome = normaNome.toLowerCase();
  const normDisp = normalizeDispositivo(dispositivo).toLowerCase();
  const tese = teseText.toLowerCase();
  const context = combinedContext.toLowerCase();
  const reasons: string[] = [];
  let score = 0.0;

  // ── 4. PROMOÇÃO EXPLÍCITA: foundInBrief ──────────────────────
  // Verifica se a norma está mencionada explicitamente no PieceBrief
  const briefText = [
    ...brief.tesesIdentificadas,
    ...(brief.palavrasChave || []),
    brief.estrategiaSugerida || "",
  ].join(" ").toLowerCase();

  const normaNomeLower = normaNome.toLowerCase();
  const ecNumMatch = normaNomeLower.match(/(?:emenda constitucional|ec)\D*(\d+)/);
  const leiNumMatch = normaNomeLower.match(/lei\D*([\d.]+)/);
  const artNumNorm = normDisp.replace(/[º°o]/g, "");

  let foundInBrief = false;
  if (ecNumMatch) {
    const ecNum = ecNumMatch[1];
    if (briefText.includes(`ec ${ecNum}`) || briefText.includes(`emenda constitucional`) && briefText.includes(ecNum)) {
      foundInBrief = true;
    }
  }
  if (leiNumMatch && briefText.includes(leiNumMatch[1].replace(/\./g, ""))) {
    foundInBrief = true;
  }
  if (context.includes("art. 40") && artNumNorm === "40") {
    foundInBrief = true;
  }

  if (foundInBrief) {
    score += 0.60;
    reasons.push("foundInBrief (+0.60)");
  }

  // ── Domínio RPPS ──────────────────────────────────────────────
  const rppsTerms = ["previdência", "rpps", "aposentadoria", "pensão", "servidor", "paridade", "integralidade"];
  const rppsMatches = rppsTerms.filter(t => normNome.includes(t) || tese.includes(t));
  if (rppsMatches.length > 0) {
    score += 0.15;
    reasons.push(`domínio RPPS (+0.15)`);
  }

  // ── Aderência semântica ───────────────────────────────────────
  const teseWords = tese.split(" ").filter(w => w.length > 5);
  const hits = teseWords.filter(w => normNome.includes(w) || (dispositivo + " " + normaNome).toLowerCase().includes(w)).length;
  if (hits > 0) {
    const bonus = Math.min(hits * 0.05, 0.20);
    score += bonus;
    reasons.push(`aderência semântica +${hits} hits (+${bonus.toFixed(2)})`);
  }

  // ── Normas centrais identificadas ────────────────────────────
  if (normNome.includes("emenda constitucional nº 41") || normNome.includes("emenda constitucional n. 41")) {
    score += 0.20;
    reasons.push("EC 41/2003 central (+0.20)");
  }
  if (normNome.includes("emenda constitucional nº 47") || normNome.includes("emenda constitucional n. 47")) {
    score += 0.20;
    reasons.push("EC 47/2005 central (+0.20)");
  }
  if (normNome.includes("lei nº 8.112") || normNome.includes("lei 8.112")) {
    score += 0.15;
    reasons.push("Lei 8.112/90 RPPS (+0.15)");
  }
  if ((normNome.includes("constituição") && (normDisp === "40" || normDisp === "40-a"))) {
    score += 0.15;
    reasons.push("Art. 40 CF — RPPS (+0.15)");
  }

  // ── Penalidade: autoridade genérica ──────────────────────────
  if (normNome.includes("constituição") && ["1", "2", "3", "4", "5", "6"].includes(artNumNorm)) {
    if (!foundInBrief) {
      score -= 0.80;
      reasons.push("CF genérica não solicitada (-0.80)");
    }
  }

  return { score: parseFloat(score.toFixed(3)), reason: reasons.join(" | "), foundInBrief };
}

// ─────────────────────────────────────────────────────────────
// THRESHOLD — legislação só entra se score >= este valor
// ─────────────────────────────────────────────────────────────
const LEGIS_SCORE_THRESHOLD = 0.30;

export class LegalMatrixBuilderService {
  static async buildMatrix(brief: PieceBrief, research: LegalResearchPack): Promise<LegalMatrix> {
    const teses: LegalMatrixTese[] = [];

    const globalLegislacao = new Map<string, any>();
    const globalJurisprudencia = new Map<string, any>();

    const observability = {
      pesquisaPorTese: [] as any[],
      resultadosRetornados: { legisDB: 0, lexML: 0, lanceDB: 0 },
      resultadosAproveitados: { legisDB: 0, lexML: 0, lanceDB: 0 },
      resultadosDescartados: [] as any[],
      legislacaoRanking: [] as any[],   // 5. OBSERVABILIDADE
    };

    let dispCounter = 1;
    let jurCounter = 1;

    for (let i = 0; i < research.teses.length; i++) {
      const researchTese = research.teses[i];
      const teseText = researchTese.tese;
      const refsTeseLegis: string[] = [];
      const refsTeseJuri: string[] = [];

      const combinedContext = (teseText + " " + toArr(brief.fatosRelevantes).join(" ") + " " + toArr(brief.palavrasChave).join(" ")).toLowerCase();

      // ===== JURISPRUDÊNCIA (LanceDB + LexML) =====
      let juriAproveitadosTese = 0;
      let juriLimit = 5;

      if (combinedContext.includes("tema") || combinedContext.includes("repercussão geral") || combinedContext.includes("repetitivo") || teseText.toLowerCase().includes("stf")) {
        juriLimit = 8;
      }

      for (const j of researchTese.jurisprudencia) {
        if (juriAproveitadosTese >= juriLimit) break;

        let existingId: string | null = null;
        for (const [key, val] of globalJurisprudencia.entries()) {
          if (val.numero === j.numero || val.titulo === j.titulo) { existingId = key; break; }
        }

        if (!existingId) {
          existingId = `[JUR-${jurCounter++}]`;
          globalJurisprudencia.set(existingId, {
            id: existingId,
            titulo: j.titulo,
            fonte: j.fonte,
            tribunal: j.tribunal || "Tribunal Superior",
            numero: j.numero || "Indisponível",
            ementa: j.ementa || j.conteudo || "Ementa indisponível",
          });
          observability.resultadosAproveitados[j.fonte === "LexML" ? "lexML" : "lanceDB"]++;
        }
        if (!refsTeseJuri.includes(existingId)) refsTeseJuri.push(existingId);
        juriAproveitadosTese++;
      }

      for (let k = juriLimit; k < researchTese.jurisprudencia.length; k++) {
        observability.resultadosDescartados.push({ item: researchTese.jurisprudencia[k].titulo, score: researchTese.jurisprudencia[k].score, reason: "Descartado pelo limite por tese (máx " + juriLimit + ")" });
      }

      // ===== LEGISDB (Local) =====
      const searchKeywords = teseText.split(" ").filter(w => w.length > 4);
      const exactMatches: any[] = [];

      if (combinedContext.includes("ec 41") || combinedContext.includes("emenda constitucional 41") || combinedContext.includes("emenda constitucional nº 41")) {
        exactMatches.push({ normaNome: { contains: "Emenda Constitucional nº 41" } });
      }
      if (combinedContext.includes("ec 47") || combinedContext.includes("emenda constitucional 47")) {
        exactMatches.push({ normaNome: { contains: "Emenda Constitucional nº 47" } });
      }
      if (combinedContext.includes("lei 8.112") || combinedContext.includes("lei 8112")) {
        exactMatches.push({ normaNome: { contains: "Lei nº 8.112" } });
      }
      if (combinedContext.includes("art. 40") || combinedContext.includes("artigo 40")) {
        exactMatches.push({ dispositivo: { startsWith: "Art. 40" } });
      }

      let localDevices: any[] = [];
      let queryUsed: any = {};

      try {
        if (exactMatches.length > 0) {
          queryUsed = { OR: exactMatches };
          localDevices = await prisma.legisDevice.findMany({ where: queryUsed, take: 8 });
        } else if (searchKeywords.length > 0) {
          queryUsed = { OR: searchKeywords.map(k => ({ texto: { contains: k, mode: "insensitive" as const } })) };
          localDevices = await prisma.legisDevice.findMany({ where: queryUsed, take: 5 });
        }
      } catch (err) {
        console.warn("Falha ao buscar no LegisDB:", err);
      }
      observability.resultadosRetornados.legisDB += localDevices.length;

      let legisAproveitadas = 0;
      for (const d of localDevices) {
        if (legisAproveitadas >= 3) break;

        // 1. NORMALIZAÇÃO
        const dispNorm = normalizeDispositivo(d.dispositivo);
        // título canônico usa o dispositivo normalizado (sem duplo "Art.")
        const tituloDevice = `Art. ${dispNorm} da ${d.normaNome}`;

        // 2. GENERIC AUTHORITY FILTER — baseado no dispositivo normalizado
        if (isGenericCFAuthority(dispNorm, d.normaNome)) {
          observability.resultadosDescartados.push({
            item: tituloDevice,
            scoreRaw: 0,
            scoreFinal: 0,
            reason: "Bloqueado: CF genérica (Art. 1º/3º/4º/5º/6º sem inciso específico)",
            foundInBrief: false,
          });
          continue;
        }

        // 3. LEGISLATION RANKER — score temático
        const ranked = rankLegislation(dispNorm, d.normaNome, teseText, combinedContext, brief);

        // 5. OBSERVABILIDADE — registro completo
        observability.legislacaoRanking.push({
          item: tituloDevice,
          scoreRaw: ranked.score,
          scoreFinal: ranked.score,
          foundInBrief: ranked.foundInBrief,
          motivo: ranked.reason,
          aprovado: ranked.score >= LEGIS_SCORE_THRESHOLD,
        });

        if (ranked.score < LEGIS_SCORE_THRESHOLD) {
          observability.resultadosDescartados.push({
            item: tituloDevice,
            scoreRaw: ranked.score,
            scoreFinal: ranked.score,
            reason: `Score abaixo do threshold (${ranked.score} < ${LEGIS_SCORE_THRESHOLD}) | ${ranked.reason}`,
            foundInBrief: ranked.foundInBrief,
          });
          continue;
        }

        let existingId: string | null = null;
        for (const [key, val] of globalLegislacao.entries()) {
          if (val.titulo === tituloDevice) { existingId = key; break; }
        }

        if (!existingId) {
          existingId = `[DISP-${dispCounter++}]`;
          globalLegislacao.set(existingId, {
            id: existingId,
            titulo: tituloDevice,
            fonte: "LegisDB Local",
            textoLiteral: d.texto,
            score: ranked.score,
            foundInBrief: ranked.foundInBrief,
          });
          observability.resultadosAproveitados.legisDB++;
        }
        if (!refsTeseLegis.includes(existingId)) refsTeseLegis.push(existingId);
        legisAproveitadas++;
      }

      // ===== LEGISLAÇÃO LEXML =====
      for (const l of researchTese.legislacao) {
        if (legisAproveitadas >= 3) break;

        // aplica generic filter e ranker também para legislação LexML
        const dispNormL = normalizeDispositivo(l.titulo?.replace(/^Art\.\s*/i, "") || "");
        const normaNomeL = l.titulo || "";
        if (isGenericCFAuthority(dispNormL, normaNomeL)) {
          observability.resultadosDescartados.push({ item: l.titulo, scoreRaw: 0, scoreFinal: 0, reason: "Bloqueado: CF genérica (LexML)", foundInBrief: false });
          continue;
        }

        let existingId: string | null = null;
        for (const [key, val] of globalLegislacao.entries()) {
          if (val.titulo === l.titulo) { existingId = key; break; }
        }
        if (!existingId) {
          existingId = `[DISP-${dispCounter++}]`;
          globalLegislacao.set(existingId, {
            id: existingId,
            titulo: l.titulo,
            fonte: l.fonte,
            textoLiteral: l.conteudo,
          });
          observability.resultadosAproveitados.lexML++;
        }
        if (!refsTeseLegis.includes(existingId)) refsTeseLegis.push(existingId);
        legisAproveitadas++;
      }

      observability.pesquisaPorTese.push({
        tese: teseText,
        queries: researchTese.queries,
        queryLegisDB: queryUsed,
        resultadosLanceDB: researchTese.jurisprudencia.filter(r => r.fonte.includes("LanceDB")).length,
        resultadosLexML: researchTese.jurisprudencia.filter(r => r.fonte.includes("LexML")).length + researchTese.legislacao.length,
        descartes: researchTese.descartes,
      });

      teses.push({
        tese: teseText,
        fatosRelevantes: toArr(brief.fatosRelevantes),
        fundamentosLegais: refsTeseLegis,
        jurisprudenciaAplicavel: refsTeseJuri,
        aplicacaoConcreta: `[Instrução ao Writer: Argumentar em favor desta tese usando os fatos listados.${refsTeseLegis.length > 0 ? ` Para embasamento, cite expressamente as normas indicadas em: ${refsTeseLegis.join(", ")}.` : ""}${refsTeseJuri.length > 0 ? ` Utilize também a jurisprudência indicada em: ${refsTeseJuri.join(", ")}.` : ""}]`,
        pedidoRelacionado: toArr(brief.pedidosIdentificados)[i % (toArr(brief.pedidosIdentificados).length || 1)] || "Procedência do pedido",
      });
    }

    return {
      teses,
      legislacaoSelecionada: Array.from(globalLegislacao.values()),
      jurisprudenciaSelecionada: Array.from(globalJurisprudencia.values()),
      observability,
    };
  }

  static formatToMarkdown(matrix: LegalMatrix): string {
    let md = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    md += "MATRIZ JURÍDICA E ARGUMENTATIVA (SÍNTESE DAS FONTES)\n";
    md += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

    md += `### POOL DE FUNDAMENTAÇÃO LEGAL (Não Repetir)\n\n`;
    if (matrix.legislacaoSelecionada.length > 0) {
      matrix.legislacaoSelecionada.forEach(l => {
        md += `**${l.id} - ${l.titulo}**\n${l.textoLiteral}\n\n`;
      });
    } else {
      md += `(Nenhum dispositivo legal selecionado no Pool)\n\n`;
    }

    md += `### POOL DE JURISPRUDÊNCIA\n\n`;
    if (matrix.jurisprudenciaSelecionada.length > 0) {
      matrix.jurisprudenciaSelecionada.forEach(j => {
        md += `**${j.id} - ${j.tribunal} / ${j.numero}**\n*Ementa:* ${j.ementa}\n\n`;
      });
    } else {
      md += `(Nenhuma jurisprudência selecionada no Pool)\n\n`;
    }

    md += "---\n\n### TESES A SEREM DESENVOLVIDAS NA PEÇA\n\n";

    matrix.teses.forEach((tese, i) => {
      md += `#### TESE ${i + 1}: ${tese.tese}\n\n`;
      md += `* **Fatos Relevantes:** ${tese.fatosRelevantes.join(" ")}\n`;
      md += `* **Fundamentação Legal Recomendada:** ${tese.fundamentosLegais.join(", ")}\n`;
      md += `* **Jurisprudência Recomendada:** ${tese.jurisprudenciaAplicavel.join(", ")}\n`;
      md += `* **Pedido Relacionado:** ${tese.pedidoRelacionado}\n\n`;
      md += `* **Aplicação ao Caso Concreto:** ${tese.aplicacaoConcreta}\n\n`;
      md += `---\n\n`;
    });

    return md;
  }
}

import type { PieceBrief } from "./piece-brief.service.js";
import type { LegalResearchPack, TeseResearchPack } from "../legal-research/legal-research.service.js";
import { PrismaClient } from "@judicore/db";

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

export class LegalMatrixBuilderService {
  static async buildMatrix(brief: PieceBrief, research: LegalResearchPack): Promise<LegalMatrix> {
    const teses: LegalMatrixTese[] = [];

    const globalLegislacao = new Map<string, any>();
    const globalJurisprudencia = new Map<string, any>();
    
    const observability = {
      pesquisaPorTese: [] as any[],
      resultadosRetornados: { legisDB: 0, lexML: 0, lanceDB: 0 },
      resultadosAproveitados: { legisDB: 0, lexML: 0, lanceDB: 0 },
      resultadosDescartados: [] as any[]
    };

    let dispCounter = 1;
    let jurCounter = 1;

    for (let i = 0; i < research.teses.length; i++) {
      const researchTese = research.teses[i];
      const teseText = researchTese.tese;
      const refsTeseLegis: string[] = [];
      const refsTeseJuri: string[] = []; 
      
      const combinedContext = (teseText + " " + brief.fatosRelevantes.join(" ") + " " + (brief.palavrasChave||[]).join(" ")).toLowerCase();
      
      // ===== JURISPRUDÊNCIA (LanceDB + LexML) =====
      // Limites: 3 por padrão, até 5 se for Tema/STF/Repercussão
      let juriAproveitadosTese = 0;
      let juriLimit = 3;
      
      // Verifica se a tese pede exceção
      if (combinedContext.includes("tema") || combinedContext.includes("repercussão geral") || combinedContext.includes("repetitivo") || teseText.toLowerCase().includes("stf")) {
          juriLimit = 5;
      }

      for (const j of researchTese.jurisprudencia) {
          if (juriAproveitadosTese >= juriLimit) break;
          
          let existingId = null;
          // Busca no global
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
               ementa: j.ementa || j.conteudo || "Ementa indisponível"
             });
             observability.resultadosAproveitados[j.fonte === "LexML" ? "lexML" : "lanceDB"]++;
          }
          if (!refsTeseJuri.includes(existingId)) refsTeseJuri.push(existingId);
          juriAproveitadosTese++;
      }

      // Descarta o excedente
      for (let k = juriLimit; k < researchTese.jurisprudencia.length; k++) {
         observability.resultadosDescartados.push({ item: researchTese.jurisprudencia[k].titulo, score: researchTese.jurisprudencia[k].score, reason: "Descartado pelo limite por tese (máx " + juriLimit + ")" });
      }

      // ===== LEGISDB (Local) =====
      const searchKeywords = teseText.split(" ").filter(w => w.length > 4);
      const exactMatches = [];
      
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

      let localDevices = [];
      let queryUsed = {};

      if (exactMatches.length > 0) {
         queryUsed = { OR: exactMatches };
         localDevices = await prisma.legisDevice.findMany({ where: queryUsed, take: 5 });
      } else if (searchKeywords.length > 0) {
         queryUsed = { OR: searchKeywords.map(k => ({ texto: { contains: k, mode: 'insensitive' } })) };
         localDevices = await prisma.legisDevice.findMany({ where: queryUsed, take: 3 });
      }
      observability.resultadosRetornados.legisDB += localDevices.length;

      let legisAproveitadas = 0;
      for (const d of localDevices) {
         if (legisAproveitadas >= 3) break;
         const tituloDevice = `Art. ${d.dispositivo} da ${d.normaNome}`;
         
         if (d.dispositivo === "5º" && d.normaNome.includes("Constituição") && !combinedContext.includes("art. 5")) {
             observability.resultadosDescartados.push({ item: tituloDevice, score: 0, reason: "Truncado por ser CF genérica" });
             const caput = d.texto.split("\\n")[0];
             d.texto = caput + " ... [Restante do Art. 5 omitido por diretriz de deduplicação]";
         }
         if (["1º", "3º", "4º", "6º"].includes(d.dispositivo) && d.normaNome.includes("Constituição") && !combinedContext.includes("art. " + d.dispositivo)) {
             observability.resultadosDescartados.push({ item: tituloDevice, score: 0, reason: "Descartado por ser CF genérica não solicitada" });
             continue; 
         }

         let existingId = null;
         for (const [key, val] of globalLegislacao.entries()) {
             if (val.titulo === tituloDevice) { existingId = key; break; }
         }

         if (!existingId) {
             existingId = `[DISP-${dispCounter++}]`;
             globalLegislacao.set(existingId, {
               id: existingId,
               titulo: tituloDevice,
               fonte: "LegisDB Local",
               textoLiteral: d.texto
             });
             observability.resultadosAproveitados.legisDB++;
         }
         if (!refsTeseLegis.includes(existingId)) refsTeseLegis.push(existingId);
         legisAproveitadas++;
      }

      // ===== LEGISLAÇÃO LEXML =====
      for (const l of researchTese.legislacao) {
         if (legisAproveitadas >= 3) break;
         let existingId = null;
         for (const [key, val] of globalLegislacao.entries()) {
             if (val.titulo === l.titulo) { existingId = key; break; }
         }
         if (!existingId) {
             existingId = `[DISP-${dispCounter++}]`;
             globalLegislacao.set(existingId, { 
               id: existingId,
               titulo: l.titulo, 
               fonte: l.fonte, 
               textoLiteral: l.conteudo
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
         descartes: researchTese.descartes
      });

      teses.push({
        tese: teseText,
        fatosRelevantes: brief.fatosRelevantes,
        fundamentosLegais: refsTeseLegis,
        jurisprudenciaAplicavel: refsTeseJuri,
        aplicacaoConcreta: `[Instrução ao Writer: Argumentar em favor desta tese usando os fatos listados. Para embasamento, cite expressamente as normas indicadas em: ${refsTeseLegis.join(", ")}. Utilize também a jurisprudência indicada em: ${refsTeseJuri.join(", ")}]`,
        pedidoRelacionado: brief.pedidosIdentificados[i % (brief.pedidosIdentificados.length || 1)] || "Procedência do pedido",
      });
    }

    return { 
      teses, 
      legislacaoSelecionada: Array.from(globalLegislacao.values()), 
      jurisprudenciaSelecionada: Array.from(globalJurisprudencia.values()),
      observability 
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

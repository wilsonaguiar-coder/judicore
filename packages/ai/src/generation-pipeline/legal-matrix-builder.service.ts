import type { PieceBrief } from "./piece-brief.service.js";
import type { LegalResearchPack } from "../legal-research/legal-research.service.js";
import { PrismaClient } from "@judicore/db";

const prisma = new PrismaClient();

export interface LegalMatrixTese {
  tese: string;
  fatosRelevantes: string[];
  fundamentosLegais: string[]; // Agora guarda apenas as chaves [DISP-X]
  jurisprudenciaAplicavel: string[]; // Agora guarda apenas as chaves [JUR-X]
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
  /**
   * Constrói de forma determinística a Matriz de Argumentação, 
   * buscando os textos literais no LegisDB local.
   */
  static async buildMatrix(brief: PieceBrief, research: LegalResearchPack): Promise<LegalMatrix> {
    const teses: LegalMatrixTese[] = [];
    
    const topLegislacao = research.legislacaoLexML.slice(0, 3);
    const topJurisprudencia = [
      ...research.jurisprudenciaLocal.slice(0, 3),
      ...research.jurisprudenciaLexML.slice(0, 2)
    ];

    const tesesBase = brief.tesesIdentificadas.length > 0 
      ? brief.tesesIdentificadas 
      : [brief.estrategiaSugerida || "Tese Jurídica Principal"];

    const globalLegislacao = new Map<string, any>();
    const globalJurisprudencia = new Map<string, any>();
    
    // Objeto de observabilidade que a nova versão exigiu
    const observability = {
      queryLexML_Jurisprudencia: research.observability?.queryLexML_Jurisprudencia || "N/A",
      queryLexML_Legislacao: research.observability?.queryLexML_Legislacao || "N/A",
      queryLanceDB: research.observability?.queryLanceDB || "N/A",
      queryTST: research.observability?.queryTST || "N/A",
      queriesLegisDbPorTese: [] as any[],
      resultadosRetornados: {
        legisDB: [] as string[],
        lexML: [] as string[],
        lanceDB: [] as string[]
      },
      resultadosAproveitados: {
        legisDB: [] as string[],
        lexML: [] as string[],
        lanceDB: [] as string[]
      },
      resultadosDescartados: [] as string[]
    };

    // Populando resultados retornados na origem
    observability.resultadosRetornados.lexML = topLegislacao.map(l => l.titulo);
    observability.resultadosRetornados.lanceDB = topJurisprudencia.map(j => j.numero || j.titulo);

    // Mapeamento corrigido para preservar EMENTAS INTEGRALMENTE (Bloco 6)
    // Sem truncamento substring(0,300)
    const enrichedJurisprudencia = topJurisprudencia.map((j, idx) => {
      const id = `[JUR-${idx + 1}]`;
      const doc = {
        id,
        titulo: j.titulo || `Decisão do ${j.tribunal || "Tribunal"}`, 
        fonte: j.fonte || j.url || "Indisponível",
        tribunal: j.tribunal || "Indisponível",
        numero: j.numero || "Indisponível",
        ementa: j.ementa || j.conteudo || j.conteudoIntegral || "Ementa indisponível",
        motivoSelecao: "Identificado como relevante para as teses do PieceBrief e orientação do usuário."
      };
      globalJurisprudencia.set(id, doc);
      observability.resultadosAproveitados.lanceDB.push(doc.numero);
      return doc;
    });

    let dispCounter = 1;

    for (let i = 0; i < tesesBase.length; i++) {
      const teseText = tesesBase[i];
      const refsTeseLegis: string[] = [];
      const refsTeseJuri: string[] = []; // Se tivéssemos classificação por tese, colocaríamos aqui.
      
      // Associamos todas as JUR por padrão ou fazemos match simples
      enrichedJurisprudencia.forEach(j => refsTeseJuri.push(j.id));

      // 1. Busca Direcionada no LegisDB por tese (Bloco 1 e 5)
      // Extrair padrões específicos: EC, Lei, Art.
      const searchKeywords = teseText.split(" ").filter(w => w.length > 4);
      const exactMatches = [];
      
      // Busca específica de Emendas (ex: EC 41/2003, Tema 396) no teseText e brief
      const combinedContext = (teseText + " " + brief.fatosRelevantes.join(" ") + " " + (brief.palavrasChave||[]).join(" ")).toLowerCase();
      
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
         // Fallback para keywords, mas vamos limitar
         queryUsed = { OR: searchKeywords.map(k => ({ texto: { contains: k, mode: 'insensitive' } })) };
         localDevices = await prisma.legisDevice.findMany({ where: queryUsed, take: 3 });
      }

      observability.queriesLegisDbPorTese.push({ tese: teseText, query: queryUsed, returnedCount: localDevices.length });

      for (const d of localDevices) {
         const tituloDevice = `Art. ${d.dispositivo} da ${d.normaNome}`;
         observability.resultadosRetornados.legisDB.push(tituloDevice);
         
         // Regra de descarte: Art. 5 inteiro (Bloco 3)
         if (d.dispositivo === "5º" && d.normaNome.includes("Constituição") && !combinedContext.includes("art. 5")) {
             // Limita a apenas o caput ou descarta se for mto genérico
             const caput = d.texto.split("\\n")[0];
             d.texto = caput + " ... [Restante do Art. 5 omitido por diretriz de deduplicação]";
             observability.resultadosDescartados.push(tituloDevice + " (truncado por ser CF genérica)");
         }
         if (["1º", "3º", "4º", "6º"].includes(d.dispositivo) && d.normaNome.includes("Constituição") && !combinedContext.includes("art. " + d.dispositivo)) {
             observability.resultadosDescartados.push(tituloDevice + " (descartado por ser CF genérica não solicitada)");
             continue; // Pula a inserção (Bloco 1)
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
             observability.resultadosAproveitados.legisDB.push(tituloDevice);
         }
         if (!refsTeseLegis.includes(existingId)) refsTeseLegis.push(existingId);
      }

      // Fallback LexML para tese
      for (const l of topLegislacao) {
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
               textoLiteral: "Fallback Seguro: O texto literal desta lei não está no LegisDB. Argumente com base nos princípios e cite a norma." 
             });
             observability.resultadosAproveitados.lexML.push(l.titulo);
         }
         if (!refsTeseLegis.includes(existingId)) refsTeseLegis.push(existingId);
      }

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
  
  static buildFilteredResearch(research: LegalResearchPack) {
    return {
      legislacaoSelecionada: research.legislacaoLexML.slice(0, 3),
      jurisprudenciaSelecionada: [
        ...research.jurisprudenciaLocal.slice(0, 3),
        ...research.jurisprudenciaLexML.slice(0, 2)
      ]
    };
  }
}

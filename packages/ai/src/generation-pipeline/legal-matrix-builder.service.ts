import type { PieceBrief } from "./piece-brief.service.js";
import type { LegalResearchPack } from "../legal-research/legal-research.service.js";
import { PrismaClient } from "@judicore/db";

const prisma = new PrismaClient();

export interface LegalMatrixTese {
  tese: string;
  fatosRelevantes: string[];
  fundamentosLegais: any[];
  jurisprudenciaAplicavel: any[];
  aplicacaoConcreta: string;
  pedidoRelacionado: string;
}

export interface LegalMatrix {
  teses: LegalMatrixTese[];
  legislacaoSelecionada: any[];
  jurisprudenciaSelecionada: any[];
}

export class LegalMatrixBuilderService {
  /**
   * Constrói de forma determinística a Matriz de Argumentação, 
   * buscando os textos literais no LegisDB local.
   */
  static async buildMatrix(brief: PieceBrief, research: LegalResearchPack): Promise<LegalMatrix> {
    const teses: LegalMatrixTese[] = [];

    const topLegislacao = research.legislacaoLexML.slice(0, 3);
    
    // Busca os textos literais no LegisDB
    const lexmlEnriched = await Promise.all(topLegislacao.map(async (l) => {
      const artMatch = l.titulo.match(/Art\.?\s*(\d+)/i);
      const leiMatch = l.titulo.match(/Lei\s*(?:n[ºo]\s*)?([\d\.]+)/i);
      
      if (artMatch && leiMatch) {
         const art = `Art. ${artMatch[1]}`;
         const leiFormatada = leiMatch[1].replace(/\./g, ""); // Remove pontos, ex 8.213 -> 8213
         
         const devices = await prisma.legisDevice.findMany({
           where: {
              dispositivo: { startsWith: art },
           }
         });
         
         // Filtra em memória para evitar problemas com LIKE no Prisma e diferentes formatos de pontos
         const device = devices.find(d => d.normaNome.replace(/\./g, "").includes(leiFormatada));
         
         if (device) {
            return { titulo: l.titulo, fonte: l.fonte, textoLiteral: device.texto };
         }
      }
      return { 
        titulo: l.titulo, 
        fonte: l.fonte, 
        textoLiteral: "Fallback Seguro: O texto literal desta lei não está no LegisDB. Argumente com base nos princípios e cite a norma, mas NÃO transcreva seu texto entre aspas." 
      };
    }));

    const topJurisprudencia = [
      ...research.jurisprudenciaLocal.slice(0, 3),
      ...research.jurisprudenciaLexML.slice(0, 2)
    ];

    const tesesBase = brief.tesesIdentificadas.length > 0 
      ? brief.tesesIdentificadas 
      : [brief.estrategiaSugerida || "Tese Jurídica Principal"];

    const searchKeywords = tesesBase.join(" ").split(" ").filter(w => w.length > 4);
    
    // 1. Busca Primária no LegisDB local por similaridade semântica / keywords
    // Como não temos vector search puro no LegisDB ainda, usamos LIKE nas palavras chaves principais
    let localDevices = [];
    if (searchKeywords.length > 0) {
       localDevices = await prisma.legisDevice.findMany({
         where: {
            OR: searchKeywords.map(k => ({ texto: { contains: k, mode: 'insensitive' } }))
         },
         take: 5
       });
    }

    // Mescla o LegisDB com o LexML
    const combinedLegislacao = [];
    
    for (const d of localDevices) {
       combinedLegislacao.push({
         titulo: `Art. ${d.dispositivo} da ${d.normaNome}`,
         fonte: "LegisDB Local",
         textoLiteral: d.texto
       });
    }

    // Se LexML trouxe algo não coberto pelo LegisDB, tenta buscar e adiciona
    for (const l of topLegislacao) {
      const artMatch = l.titulo.match(/Art\.?\s*(\d+)/i);
      const leiMatch = l.titulo.match(/Lei\s*(?:n[ºo]\s*)?([\d\.]+)/i);
      
      let foundInLocal = false;
      if (artMatch && leiMatch) {
         const art = `Art. ${artMatch[1]}`;
         const leiFormatada = leiMatch[1].replace(/\./g, "");
         const device = await prisma.legisDevice.findFirst({
           where: { dispositivo: { startsWith: art } }
         });
         
         if (device && device.normaNome.replace(/\./g, "").includes(leiFormatada)) {
            combinedLegislacao.push({ titulo: l.titulo, fonte: "LegisDB (via LexML)", textoLiteral: device.texto });
            foundInLocal = true;
         }
      }
      
      if (!foundInLocal) {
         combinedLegislacao.push({ 
           titulo: l.titulo, 
           fonte: l.fonte, 
           textoLiteral: "Fallback Seguro: O texto literal desta lei não está no LegisDB. Argumente com base nos princípios e cite a norma, mas NÃO transcreva seu texto entre aspas." 
         });
      }
    }

    // Remove duplicatas
    const enrichedLegislacao = combinedLegislacao.filter((v,i,a)=>a.findIndex(v2=>(v2.titulo===v.titulo))===i).slice(0, 5);

    // Mapeamento corrigido para preservar EMENTAS
    const enrichedJurisprudencia = topJurisprudencia.map(j => ({ 
      titulo: j.titulo || `Decisão do ${j.tribunal || "Tribunal"}`, 
      fonte: j.fonte || j.url || "Indisponível",
      tribunal: j.tribunal || "Indisponível",
      numero: j.numero || "Indisponível",
      ementa: j.ementa || j.conteudo || j.conteudoIntegral || "Ementa indisponível",
      teseTrechoRelevante: j.tese || j.ementa?.substring(0, 300) || "Trecho indisponível",
      motivoSelecao: "Identificado como relevante para as teses do PieceBrief e orientação do usuário."
    }));

    for (let i = 0; i < tesesBase.length; i++) {
      teses.push({
        tese: tesesBase[i],
        fatosRelevantes: brief.fatosRelevantes,
        fundamentosLegais: enrichedLegislacao,
        jurisprudenciaAplicavel: enrichedJurisprudencia,
        aplicacaoConcreta: "[Instrução ao Writer: Aplicar os fatos aos fundamentos acima]",
        pedidoRelacionado: brief.pedidosIdentificados[i % (brief.pedidosIdentificados.length || 1)] || "Procedência do pedido",
      });
    }

    return { teses, legislacaoSelecionada: enrichedLegislacao, jurisprudenciaSelecionada: enrichedJurisprudencia };
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

import type { PieceBrief } from "./piece-brief.service.js";
import type { LegalResearchPack } from "../legal-research/legal-research.service.js";

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
}

export class LegalMatrixBuilderService {
  /**
   * Constrói de forma determinística a Matriz de Argumentação, 
   * organizando os dados do PieceBrief e reduzindo o escopo das pesquisas.
   */
  static buildMatrix(brief: PieceBrief, research: LegalResearchPack): LegalMatrix {
    const teses: LegalMatrixTese[] = [];

    // Filtra as melhores fontes para evitar "Lost in the Middle" (redução de contexto)
    const topLegislacao = research.legislacaoLexML.slice(0, 3);
    
    // Mistura STF/STJ com LexML limitando para não inflar o contexto
    const topJurisprudencia = [
      ...research.jurisprudenciaLocal.slice(0, 3),
      ...research.jurisprudenciaLexML.slice(0, 2)
    ];

    const tesesBase = brief.tesesIdentificadas.length > 0 
      ? brief.tesesIdentificadas 
      : [brief.estrategiaSugerida || "Tese Jurídica Principal"];

    for (let i = 0; i < tesesBase.length; i++) {
      teses.push({
        tese: tesesBase[i],
        fatosRelevantes: brief.fatosRelevantes, // Todos os fatos são relevantes para contextualizar
        fundamentosLegais: topLegislacao.map(l => ({ titulo: l.titulo, fonte: l.fonte })), // Apenas metadados curtos
        jurisprudenciaAplicavel: topJurisprudencia.map(j => ({ titulo: j.titulo, fonte: j.fonte })), // Apenas metadados curtos
        aplicacaoConcreta: "[Instrução ao Writer: Aplicar os fatos aos fundamentos acima]",
        pedidoRelacionado: brief.pedidosIdentificados[i % (brief.pedidosIdentificados.length || 1)] || "Procedência do pedido",
      });
    }

    return { teses };
  }
  
  /**
   * Extrai apenas os resumos da pesquisa para serem enviados ao GPT,
   * descartando o volume gigante do Elasticsearch/LanceDB cru.
   */
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

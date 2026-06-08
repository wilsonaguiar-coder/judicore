import { LegalMatrix, LegalMatrixBuilderService } from "../generation-pipeline/legal-matrix-builder.service.js";

export interface BenchmarkMetrics {
  legalMatrixChars: number;
  statutesCount: number;
  precedentsCount: number;
  thesesCount: number;
  duplicatedItemsRemoved: number;
  generatedPieceChars?: number;
  generatedPiecePagesEstimate?: number;
}

export interface BenchmarkReport {
  processId: string;
  mode: "snapshot" | "manual";
  before?: BenchmarkMetrics;
  after: BenchmarkMetrics;
  deltas?: {
    legalMatrixCharsReductionPercent?: number;
    statutesDelta?: number;
    precedentsDelta?: number;
    duplicatedItemsDelta?: number;
  };
  notes?: string;
}

export class LegalMatrixBenchmarkService {
  /**
   * Mede o estado "DEPOIS" baseado no output gerado atualmente pelo pipeline.
   */
  static measureAfter(matrix: LegalMatrix, pieceText: string = ""): BenchmarkMetrics {
    const md = LegalMatrixBuilderService.formatToMarkdown(matrix);
    
    return {
      legalMatrixChars: md.length,
      statutesCount: matrix.legislacaoSelecionada?.length || 0,
      precedentsCount: matrix.jurisprudenciaSelecionada?.length || 0,
      thesesCount: matrix.teses?.length || 0,
      duplicatedItemsRemoved: matrix.observability?.resultadosDescartados?.length || 0,
      generatedPieceChars: pieceText.length,
      generatedPiecePagesEstimate: Math.ceil((pieceText.length || 0) / 1800),
    };
  }

  /**
   * Constrói o relatório e computa deltas matemáticos comparando ANTES e DEPOIS.
   */
  static generateReport(processId: string, after: BenchmarkMetrics, before?: BenchmarkMetrics, notes?: string): BenchmarkReport {
    const report: BenchmarkReport = {
      processId,
      mode: before ? "manual" : "snapshot", // Se passarmos before explicitamente no script, será manual. Se o motor lêsse o DB, seria snapshot.
      after,
      notes
    };

    if (before) {
      report.before = before;
      const reduction = before.legalMatrixChars > 0 
        ? ((before.legalMatrixChars - after.legalMatrixChars) / before.legalMatrixChars) * 100 
        : 0;

      report.deltas = {
        legalMatrixCharsReductionPercent: parseFloat(reduction.toFixed(2)),
        statutesDelta: after.statutesCount - before.statutesCount,
        precedentsDelta: after.precedentsCount - before.precedentsCount,
        duplicatedItemsDelta: after.duplicatedItemsRemoved - before.duplicatedItemsRemoved,
      };
    }

    return report;
  }

  /**
   * Formata o relatório para exibição CLI e Markdown.
   */
  static formatReportToMarkdown(report: BenchmarkReport): string {
    let md = `# BENCHMARK CONTROLADO: WRITER × LEGALMATRIX\n\n`;
    md += `**Process ID:** ${report.processId}\n`;
    md += `**Modo de Baseline:** ${report.mode.toUpperCase()}\n`;
    if (report.notes) md += `**Notas:** ${report.notes}\n`;
    
    if (report.mode === "manual") {
       md += `\n> **Limitações do Benchmark**: O baseline está no modo MANUAL. Como o pipeline da LegalMatrix "Antiga" (Fase 13.0) foi desativado e substituído pela pesquisa em teses, as métricas de ANTES foram alimentadas de forma estática com base na auditoria histórica documentada.\n\n`;
    }

    md += `## 1. LEGAL MATRIX REPORT\n\n`;
    md += `| Métrica | Antes | Depois | Delta |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    
    const b = report.before;
    const a = report.after;
    const d = report.deltas;

    md += `| **Caracteres (Ruído)** | ${b?.legalMatrixChars || "-"} | ${a.legalMatrixChars} | ${d?.legalMatrixCharsReductionPercent !== undefined ? (d.legalMatrixCharsReductionPercent > 0 ? `-${d.legalMatrixCharsReductionPercent}%` : `+${Math.abs(d.legalMatrixCharsReductionPercent)}%`) : "-"} |\n`;
    md += `| **Total de Teses** | ${b?.thesesCount || "-"} | ${a.thesesCount} | - |\n`;
    md += `| **Dispositivos Legais** | ${b?.statutesCount || "-"} | ${a.statutesCount} | ${d?.statutesDelta !== undefined ? (d.statutesDelta > 0 ? `+${d.statutesDelta}` : d.statutesDelta) : "-"} |\n`;
    md += `| **Precedentes** | ${b?.precedentsCount || "-"} | ${a.precedentsCount} | ${d?.precedentsDelta !== undefined ? (d.precedentsDelta > 0 ? `+${d.precedentsDelta}` : d.precedentsDelta) : "-"} |\n`;
    md += `| **Duplicações Removidas** | ${b?.duplicatedItemsRemoved || "-"} | ${a.duplicatedItemsRemoved} | ${d?.duplicatedItemsDelta !== undefined ? (d.duplicatedItemsDelta > 0 ? `+${d.duplicatedItemsDelta}` : d.duplicatedItemsDelta) : "-"} |\n\n`;

    md += `## 2. PIECE REPORT (ESTIMATIVA)\n\n`;
    md += `- **Caracteres Gerados:** ${a.generatedPieceChars || 0}\n`;
    md += `- **Páginas Estimadas:** ${a.generatedPiecePagesEstimate || 0}\n`;

    return md;
  }
}

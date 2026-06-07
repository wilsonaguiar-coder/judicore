import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { performance } from "perf_hooks";
import { createDeepSeekReviewer } from "../src/legal-reviewer/live-providers/deepseek-reviewer.provider.js";
import { createGeminiReviewer } from "../src/legal-reviewer/live-providers/gemini-reviewer.provider.js";

// Load .env
dotenv.config();

const CORPUS_DIR = path.resolve(process.cwd(), ".real-corpus");
const INDEX_FILE = path.join(CORPUS_DIR, "real-corpus-index.json");
const TEXT_DIR = path.join(CORPUS_DIR, "text");

const RESULTS_FILE = path.join(CORPUS_DIR, "real-findings-smoke10-results.json");
const SUMMARY_FILE = path.join(CORPUS_DIR, "real-findings-smoke10-summary.json");
const ERRORS_FILE = path.join(CORPUS_DIR, "real-findings-smoke10-provider-errors.json");
const REPORT_FILE = path.join(CORPUS_DIR, "REAL_FINDINGS_SMOKE10_REPORT.md");

const KEYWORDS = [
  "relatório", "fundamentação", "dispositivo", "voto", "ementa",
  "decisão", "conclusão", "ordem", "condeno", "absolvo", "julgo",
  "defiro", "indefiro", "procedente", "improcedente"
];

function buildDeterministicContext(text: string, maxTokens: number): string {
  const size = text.length;
  if (size <= 40000) return text;

  let ranges: Array<{start: number; end: number}> = [];
  ranges.push({ start: 0, end: Math.min(8000, size) });
  
  const lowerText = text.toLowerCase();
  for (const kw of KEYWORDS) {
    let index = lowerText.indexOf(kw);
    while (index !== -1) {
      ranges.push({ start: Math.max(0, index - 1500), end: Math.min(size, index + 2500) });
      index = lowerText.indexOf(kw, index + kw.length);
    }
  }

  ranges.push({ start: Math.max(0, size - 10000), end: size });

  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{start: number; end: number}> = [];
  for (const r of ranges) {
    if (merged.length === 0) {
      merged.push(r);
    } else {
      const last = merged[merged.length - 1];
      if (r.start <= last.end) {
        last.end = Math.max(last.end, r.end);
      } else {
        merged.push(r);
      }
    }
  }

  let finalContext = "";
  for (const r of merged) {
    if (finalContext.length > 0) finalContext += "\n\n[...TRECHO OMITIDO...]\n\n";
    finalContext += text.substring(r.start, r.end);
  }

  if (finalContext.length > maxTokens) {
    finalContext = finalContext.substring(0, maxTokens);
  }

  return finalContext;
}

const pricing = {
  deepseek: { input: 0.14 / 1000000, output: 0.28 / 1000000 },
  gemini: { input: 0.075 / 1000000, output: 0.30 / 1000000 }
};

function estimateCost(chars: number, findings: number, type: "deepseek" | "gemini") {
  const tokensIn = chars / 4;
  const tokensOut = findings * 150;
  return (tokensIn * pricing[type].input) + (tokensOut * pricing[type].output);
}

async function run() {
  const indexData = await fs.readFile(INDEX_FILE, "utf-8");
  const index = JSON.parse(indexData);
  const smokeDocs = index.filter((i: any) => i.grupo === "Smoke 10");

  const results: any[] = [];
  const errorsList: any[] = [];
  const summary: any = {
    deepseek: { processed: 0, failed: 0, totalFindings: 0, totalCost: 0, totalLatency: 0 },
    gemini: { processed: 0, failed: 0, totalFindings: 0, totalCost: 0, totalLatency: 0 }
  };

  const deepseek = createDeepSeekReviewer();
  const gemini = createGeminiReviewer();

  for (const doc of smokeDocs) {
    console.log(`Processing ${doc.id}...`);
    const text = await fs.readFile(path.join(TEXT_DIR, `${doc.id}.txt`), "utf-8");
    
    const dsContext = buildDeterministicContext(text, 60000);
    const gemContext = buildDeterministicContext(text, 80000);

    const docResult: any = {
      id: doc.id,
      filename: doc.filename,
      deepseek: null,
      gemini: null
    };

    const mockAudit = {
      audit: {
        fatalErrors: [],
        nonFatalErrors: [],
        score: 100,
        status: "APPROVED"
      }
    };

    // DEEPSEEK
    try {
      const start = performance.now();
      const res = await deepseek.review({ 
        draft: dsContext, 
        classification: doc.tipo,
        domain: doc.dominio.toLowerCase() as any,
        pieceType: doc.tipo,
        audit: mockAudit as any
      });
      const lat = performance.now() - start;
      const cost = estimateCost(dsContext.length, res.findings.length, "deepseek");
      
      docResult.deepseek = {
        findings: res.findings,
        latencyMs: lat,
        costUsd: cost,
        summary: res.summary
      };
      summary.deepseek.processed++;
      summary.deepseek.totalFindings += res.findings.length;
      summary.deepseek.totalCost += cost;
      summary.deepseek.totalLatency += lat;
    } catch (e: any) {
      console.error(`DeepSeek failed on ${doc.id}:`, e.message);
      docResult.deepseek = { error: e.message };
      errorsList.push({ id: doc.id, provider: "DeepSeek", error: e.message });
      summary.deepseek.failed++;
    }

    // GEMINI
    try {
      const start = performance.now();
      const res = await gemini.review({ 
        draft: gemContext, 
        classification: doc.tipo,
        domain: doc.dominio.toLowerCase() as any,
        pieceType: doc.tipo,
        audit: mockAudit as any
      });
      const lat = performance.now() - start;
      const cost = estimateCost(gemContext.length, res.findings.length, "gemini");

      docResult.gemini = {
        findings: res.findings,
        latencyMs: lat,
        costUsd: cost,
        summary: res.summary
      };
      summary.gemini.processed++;
      summary.gemini.totalFindings += res.findings.length;
      summary.gemini.totalCost += cost;
      summary.gemini.totalLatency += lat;
    } catch (e: any) {
      console.error(`Gemini failed on ${doc.id}:`, e.message);
      docResult.gemini = { error: e.message };
      errorsList.push({ id: doc.id, provider: "Gemini", error: e.message });
      summary.gemini.failed++;
    }

    results.push(docResult);
    
    // Add small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  await fs.writeFile(RESULTS_FILE, JSON.stringify(results, null, 2));
  await fs.writeFile(ERRORS_FILE, JSON.stringify(errorsList, null, 2));
  await fs.writeFile(SUMMARY_FILE, JSON.stringify(summary, null, 2));

  let md = `# REAL FINDINGS SMOKE 10 - REPORT

## Resumo da Execução
- **Documentos Analisados:** ${smokeDocs.length}
- **DeepSeek:** Processados (${summary.deepseek.processed}), Falhas (${summary.deepseek.failed})
- **Gemini:** Processados (${summary.gemini.processed}), Falhas (${summary.gemini.failed})

## Métricas DeepSeek Reasoner
- **Total de Findings:** ${summary.deepseek.totalFindings}
- **Média por Doc:** ${(summary.deepseek.totalFindings / summary.deepseek.processed || 0).toFixed(1)}
- **Latência Total:** ${(summary.deepseek.totalLatency / 1000).toFixed(1)}s (Média ${(summary.deepseek.totalLatency / summary.deepseek.processed / 1000 || 0).toFixed(1)}s)
- **Custo Est.:** $${summary.deepseek.totalCost.toFixed(4)}

## Métricas Gemini 2.5 Pro
- **Total de Findings:** ${summary.gemini.totalFindings}
- **Média por Doc:** ${(summary.gemini.totalFindings / summary.gemini.processed || 0).toFixed(1)}
- **Latência Total:** ${(summary.gemini.totalLatency / 1000).toFixed(1)}s (Média ${(summary.gemini.totalLatency / summary.gemini.processed / 1000 || 0).toFixed(1)}s)
- **Custo Est.:** $${summary.gemini.totalCost.toFixed(4)}

## Erros Controlados
${errorsList.length === 0 ? "Nenhum erro registrado. Todas as chamadas de API tiveram sucesso." : errorsList.map(e => `- **${e.id} (${e.provider}):** ${e.error}`).join("\n")}

## Detalhamento por Documento
`;

  for (const res of results) {
    md += `\n### ${res.id} - ${res.filename}\n`;
    if (res.deepseek.error) {
      md += `- **DeepSeek:** Falhou (${res.deepseek.error})\n`;
    } else {
      md += `- **DeepSeek:** ${res.deepseek.findings.length} findings | ${Math.round(res.deepseek.latencyMs)}ms | $${res.deepseek.costUsd.toFixed(4)}\n`;
    }
    
    if (res.gemini.error) {
      md += `- **Gemini:** Falhou (${res.gemini.error})\n`;
    } else {
      md += `- **Gemini:** ${res.gemini.findings.length} findings | ${Math.round(res.gemini.latencyMs)}ms | $${res.gemini.costUsd.toFixed(4)}\n`;
    }
  }

  await fs.writeFile(REPORT_FILE, md);
  console.log("Real Findings Generation concluída com sucesso!");
}

run().catch(console.error);

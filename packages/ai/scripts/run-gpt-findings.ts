import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { performance } from "perf_hooks";
import { createOpenAIReviewer } from "../src/legal-reviewer/live-providers/openai-reviewer.provider.js";

dotenv.config();

const CORPUS_DIR = path.resolve(process.cwd(), ".real-corpus");
const INDEX_FILE = path.join(CORPUS_DIR, "real-corpus-index.json");
const TEXT_DIR = path.join(CORPUS_DIR, "text");

const RESULTS_FILE = path.join(CORPUS_DIR, "gpt-smoke10-results.json");
const SUMMARY_FILE = path.join(CORPUS_DIR, "gpt-smoke10-summary.json");
const ERRORS_FILE = path.join(CORPUS_DIR, "gpt-smoke10-provider-errors.json");

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
  gpt: { input: 5.00 / 1000000, output: 15.00 / 1000000 } // GPT-4o estimated pricing per 1M tokens
};

function estimateCost(chars: number, findings: number, type: "gpt") {
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
    processed: 0, failed: 0, totalFindings: 0, totalCost: 0, totalLatency: 0
  };

  const openai = createOpenAIReviewer();

  for (const doc of smokeDocs) {
    console.log(`Processing ${doc.id} with GPT-5.5...`);
    const text = await fs.readFile(path.join(TEXT_DIR, `${doc.id}.txt`), "utf-8");
    
    // Using 80,000 for GPT (like Gemini)
    const gptContext = buildDeterministicContext(text, 80000);

    const docResult: any = {
      id: doc.id,
      filename: doc.filename,
      gpt: null
    };

    const mockAudit = {
      audit: {
        fatalErrors: [],
        nonFatalErrors: [],
        score: 100,
        status: "APPROVED"
      }
    };

    try {
      const start = performance.now();
      const res = await openai.review({ 
        provider: "OPENAI", // VERY IMPORTANT
        draft: gptContext, 
        classification: doc.tipo,
        domain: doc.dominio.toLowerCase() as any,
        pieceType: doc.tipo,
        audit: mockAudit as any
      });
      const lat = performance.now() - start;
      const cost = estimateCost(gptContext.length, res.findings.length, "gpt");

      docResult.gpt = {
        findings: res.findings,
        latencyMs: lat,
        costUsd: cost,
        summary: res.summary
      };
      summary.processed++;
      summary.totalFindings += res.findings.length;
      summary.totalCost += cost;
      summary.totalLatency += lat;
    } catch (e: any) {
      console.error(`GPT failed on ${doc.id}:`, e.message);
      docResult.gpt = { error: e.message };
      errorsList.push({ id: doc.id, provider: "GPT-4o", error: e.message });
      summary.failed++;
    }

    results.push(docResult);
    
    // Add small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  await fs.writeFile(RESULTS_FILE, JSON.stringify(results, null, 2));
  await fs.writeFile(ERRORS_FILE, JSON.stringify(errorsList, null, 2));
  await fs.writeFile(SUMMARY_FILE, JSON.stringify(summary, null, 2));

  console.log("GPT Real Findings Generation concluída com sucesso!");
}

run().catch(console.error);

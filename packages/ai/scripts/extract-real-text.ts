import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

const CORPUS_DIR = path.resolve(process.cwd(), ".real-corpus");
const RAW_DIR = path.join(CORPUS_DIR, "raw");
const TEXT_DIR = path.join(CORPUS_DIR, "text");
const INDEX_FILE = path.join(CORPUS_DIR, "real-corpus-index.json");
const REPORT_FILE = path.join(CORPUS_DIR, "REAL_TEXT_EXTRACTION_REPORT.md");

const LEGAL_KEYWORDS = [
  "sentença", "sentenca", "decisão", "decisao", "acórdão", "acordao",
  "relatório", "relatorio", "fundamentação", "fundamentacao",
  "dispositivo", "voto", "ordem", "condeno", "absolvo", "julgo",
  "processo", "autos", "juiz", "desembargador"
];

function checkQuality(text: string): { usable: boolean; needOcr: boolean; reason?: string } {
  if (!text || text.trim().length < 1500) {
    // Texto muito curto. Pode ser que falhou a extração (PDF escaneado).
    return { usable: false, needOcr: true, reason: "Text too short (< 1500 chars), likely scanned/image." };
  }
  
  if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
    return { usable: false, needOcr: false, reason: "HTML content instead of PDF." };
  }

  const lowerText = text.toLowerCase();
  let keywordMatchCount = 0;
  for (const kw of LEGAL_KEYWORDS) {
    if (lowerText.includes(kw)) keywordMatchCount++;
  }

  if (keywordMatchCount < 2) {
    return { usable: false, needOcr: true, reason: "Few legal keywords found. OCR might be incomplete or garbage." };
  }

  return { usable: true, needOcr: false };
}

async function run() {
  const indexData = await fs.readFile(INDEX_FILE, "utf-8");
  const index = JSON.parse(indexData);

  let extractedCount = 0;
  let ocrRequiredCount = 0;
  let failedCount = 0;
  let usableDocs = [];
  const discardedList = [];

  const pyScript = `
import sys
import json
try:
    from pypdf import PdfReader
    reader = PdfReader(sys.argv[1])
    text = ""
    for page in reader.pages:
        t = page.extract_text()
        if t: text += t + "\\n"
    print(json.dumps({"success": True, "text": text, "pages": len(reader.pages)}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
  `.trim();

  const pyScriptPath = path.join(CORPUS_DIR, "temp_extract.py");
  await fs.writeFile(pyScriptPath, pyScript);

  for (const entry of index) {
    if (entry.status === "discarded") continue;

    const pdfPath = path.join(RAW_DIR, `${entry.id}.pdf`);
    const textPath = path.join(TEXT_DIR, `${entry.id}.txt`);
    
    let text = "";
    let pages = 0;
    
    try {
      const output = execSync(`python "${pyScriptPath}" "${pdfPath}"`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 });
      const res = JSON.parse(output);
      if (res.success) {
        text = res.text || "";
        pages = res.pages || 0;
      } else {
        throw new Error(res.error);
      }
    } catch (e: any) {
      entry.extractionStatus = "EXTRACTION_FAILED";
      entry.errorMessage = e.message;
      failedCount++;
      discardedList.push(`- ${entry.id}: EXTRACTION_FAILED (${e.message})`);
      continue;
    }

    entry.textLength = text.length;
    entry.pageCount = pages;
    entry.extractionMethod = "pypdf";

    const quality = checkQuality(text);

    if (quality.usable) {
      entry.extractionStatus = "TEXT_EXTRACTED";
      extractedCount++;
      usableDocs.push(entry);
      await fs.writeFile(textPath, text);
    } else if (quality.needOcr) {
      entry.extractionStatus = "OCR_REQUIRED";
      entry.errorMessage = quality.reason;
      ocrRequiredCount++;
      discardedList.push(`- ${entry.id}: OCR_REQUIRED (${quality.reason})`);
    } else {
      entry.extractionStatus = "NOT_PDF"; // or HTML
      entry.errorMessage = quality.reason;
      failedCount++;
      discardedList.push(`- ${entry.id}: NOT_PDF (${quality.reason})`);
    }
  }

  // Cleanup py script
  await fs.unlink(pyScriptPath).catch(() => {});

  // Reselect Smoke 10
  // Clear old groups
  index.forEach(i => i.grupo = null);
  
  // Assign Smoke 10
  let smokeCount = 0;
  for (const doc of usableDocs) {
    if (smokeCount < 10) {
      doc.grupo = "Smoke 10";
      smokeCount++;
    } else {
      break;
    }
  }

  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));

  const top10 = usableDocs.slice(0, 10).map(i => `- ${i.id}: [${i.dominio}] ${i.tipo} (${i.pageCount} págs, ${i.textLength} chars) - ${i.filename}`).join("\n");

  const report = `# REAL TEXT EXTRACTION REPORT

## Resumo
- **Total de PDFs Avaliados:** ${index.filter(i => i.status !== "discarded").length}
- **Texto Extraído com Sucesso:** ${extractedCount}
- **Exigem OCR (Escaneados):** ${ocrRequiredCount}
- **Falha na Extração (Erros/HTML):** ${failedCount}

## Top 10 Melhores Documentos (Novo Smoke 10)
${top10}

## Documentos Descartados nesta fase
${discardedList.join("\n")}
`;

  await fs.writeFile(REPORT_FILE, report);
  console.log("Extração Real de Texto concluída com sucesso!");
}

run().catch(console.error);

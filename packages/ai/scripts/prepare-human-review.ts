import fs from "fs/promises";
import path from "path";

const CORPUS_DIR = path.resolve(process.cwd(), ".real-corpus");
const RESULTS_FILE = path.join(CORPUS_DIR, "real-findings-smoke10-results.json");
const QUEUE_FILE = path.join(CORPUS_DIR, "human-review-smoke10-queue.json");
const CSV_FILE = path.join(CORPUS_DIR, "human-review-smoke10-sheet.csv");
const GUIDE_FILE = path.join(CORPUS_DIR, "HUMAN_REVIEW_SMOKE10_GUIDE.md");

async function run() {
  const data = JSON.parse(await fs.readFile(RESULTS_FILE, "utf-8"));

  const queue: any[] = [];
  let counter = 1;

  for (const doc of data) {
    if (doc.deepseek && doc.deepseek.findings) {
      for (const finding of doc.deepseek.findings) {
        queue.push(createReviewItem(counter++, doc.id, doc.filename, "DeepSeek", finding));
      }
    }
    if (doc.gemini && doc.gemini.findings) {
      for (const finding of doc.gemini.findings) {
        queue.push(createReviewItem(counter++, doc.id, doc.filename, "Gemini", finding));
      }
    }
  }

  // 1. JSON Queue
  await fs.writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2));

  // 2. CSV Sheet
  const csvHeaders = [
    "reviewItemId", "documentId", "provider", "findingType", "severity", "confidence",
    "findingTitle", "rationale", "evidenceExcerpt", "suggestedAction",
    "humanClassification", "humanUsefulness", "humanNotes", "reviewerName"
  ];
  
  const escapeCsv = (str: any) => {
    if (str === null || str === undefined) return "";
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  let csvContent = csvHeaders.join(",") + "\n";
  for (const item of queue) {
    const row = [
      item.reviewItemId,
      item.documentId,
      item.provider,
      item.findingType,
      item.severity,
      item.confidence,
      item.findingTitle,
      item.rationale,
      item.evidenceExcerpt,
      item.suggestedAction,
      item.humanClassification,
      item.humanUsefulness,
      item.humanNotes,
      item.reviewerName
    ].map(escapeCsv).join(",");
    csvContent += row + "\n";
  }

  await fs.writeFile(CSV_FILE, csvContent);

  // 3. Guide
  const guideContent = `# HUMAN REVIEW SMOKE 10 - GUIDE

## Objetivo
Avaliar a utilidade prática dos ${queue.length} findings reais gerados pelo JudiCore (DeepSeek e Gemini) sobre o corpus de documentos judiciais.

## Classificação Humana (\`humanClassification\`)

Classificar como **CORRETO** quando:
- O finding aponta um problema real e fundamentado.
- O advogado provavelmente aproveitaria a sugestão.
- Há base objetiva no documento para a crítica.

Classificar como **PARCIALMENTE_CORRETO** quando:
- Há algum fundamento jurídico ou factual.
- MAS o finding exagera no rigor.
- OU a relevância prática é limitada (detalhe irrelevante).
- OU a redação precisa ser ajustada para gerar valor prático.

Classificar como **INCORRETO** quando:
- O finding "inventa" um problema (alucinação).
- Ignora o contexto global da peça.
- Aponta exigência inaplicável ao caso.
- Atrapalharia o advogado (ruído total).

Classificar como **NAO_SEI** quando:
- Exige análise especializada muito profunda que foge ao conhecimento atual.
- O trecho disponível é insuficiente para validar a afirmação.
- O contexto do processo (anexos não visíveis) não permite conclusão firme.

## Utilidade Humana (\`humanUsefulness\`)
- **ALTA:** Dica de ouro. Salvou o processo ou o advogado de um grande erro.
- **MEDIA:** Boa dica. Melhorou a clareza ou a força da peça.
- **BAIXA:** Apenas uma sugestão estilística ou pedantismo irrelevante.
- **NENHUMA:** Lixo, ruído ou erro. Não serve para nada.

## Arquivos para Avaliação
1. Você pode avaliar utilizando a planilha: \`human-review-smoke10-sheet.csv\`
2. Ou editando diretamente o JSON: \`human-review-smoke10-queue.json\`

Não altere as colunas originais geradas pelas IAs, apenas preencha as lacunas humanas.
`;

  await fs.writeFile(GUIDE_FILE, guideContent);

  console.log(`Processados ${queue.length} findings para Human Review Challenge.`);
}

function createReviewItem(idNum: number, docId: string, filename: string, provider: string, finding: any) {
  return {
    reviewItemId: `HR-${String(idNum).padStart(3, "0")}`,
    documentId: docId,
    documentFilename: filename,
    provider: provider,
    findingId: finding.id,
    findingTitle: finding.title,
    findingType: finding.type,
    severity: finding.severity || finding.opportunity, // Gemini gives 'opportunity', DeepSeek gives 'severity' in some variants, we normalize here visually
    confidence: finding.confidence,
    summary: finding.rationale || finding.explanation,
    rationale: finding.rationale || finding.explanation,
    evidenceExcerpt: Array.isArray(finding.evidenceFromText) ? finding.evidenceFromText.join(" | ") : finding.evidenceFromText,
    suggestedAction: finding.suggestion || finding.suggestedReview,
    sourceContextExcerpt: finding.availableSource || "",
    originalDocumentPath: `.real-corpus/text/${docId}.txt`,
    rawProviderResponseRef: `Ver real-findings-smoke10-results.json para payload completo`,
    
    // Campos Humanos
    humanClassification: "",
    humanUsefulness: "",
    humanNotes: "",
    reviewerName: "",
    reviewedAt: ""
  };
}

run().catch(console.error);

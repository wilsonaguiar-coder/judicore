import { createRequire } from "node:module";
import type { DocumentType } from "@judicore/db";

// docx é CJS sem suporte a NodeNext — any é necessário aqui
const _req = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const {
  Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer,
  BorderStyle, Table, TableRow, TableCell, WidthType, PageOrientation,
} = _req("docx") as any;

interface ExportParams {
  type: DocumentType;
  content: string;
  caseTitle: string;
  processNum?: string | null;
  sources: Array<{ tribunal: string; numero: string; dataJulgamento: string }>;
  generatedAt: Date;
}

const TYPE_LABEL: Record<DocumentType, string> = {
  DESPACHO: "DESPACHO",
  DECISAO:  "DECISÃO INTERLOCUTÓRIA",
  SENTENCA: "SENTENÇA",
};

function makeHeader(params: ExportParams) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "JUSTIÇA FEDERAL", bold: true, size: 28, font: "Times New Roman" }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({ text: TYPE_LABEL[params.type], bold: true, size: 26, font: "Times New Roman" }),
      ],
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({ text: "Processo: ", bold: true, font: "Times New Roman", size: 24 }),
        new TextRun({ text: params.processNum ?? "Não informado", font: "Times New Roman", size: 24 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 400 },
      children: [
        new TextRun({ text: "Assunto: ", bold: true, font: "Times New Roman", size: 24 }),
        new TextRun({ text: params.caseTitle, font: "Times New Roman", size: 24 }),
      ],
    }),
  ];
}

function makeBody(content: string) {
  return content.split("\n").map((line) => {
    const trimmed = line.trim();
    const isSection = /^[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s]{4,}$/.test(trimmed) && trimmed.length < 50;

    if (isSection && trimmed.length > 0) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
        children: [new TextRun({ text: trimmed, bold: true, font: "Times New Roman", size: 24 })],
      });
    }

    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: 720 },
      spacing: { line: 360 },
      children: [new TextRun({ text: line, font: "Times New Roman", size: 24 })],
    });
  });
}

function makeSourcesTable(sources: ExportParams["sources"]) {
  if (sources.length === 0) return [];

  const headerRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tribunal", bold: true, font: "Times New Roman", size: 20 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Processo", bold: true, font: "Times New Roman", size: 20 })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Julgamento", bold: true, font: "Times New Roman", size: 20 })] })] }),
    ],
  });

  const dataRows = sources.map((s) =>
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.tribunal, font: "Times New Roman", size: 20 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.numero, font: "Times New Roman", size: 20 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.dataJulgamento, font: "Times New Roman", size: 20 })] })] }),
      ],
    })
  );

  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return [
    new Paragraph({
      spacing: { before: 600, after: 200 },
      children: [new TextRun({ text: "DECISÕES UTILIZADAS COMO FUNDAMENTO", bold: true, font: "Times New Roman", size: 22 })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
      borders: {
        top:     { style: BorderStyle.SINGLE, size: 1 },
        bottom:  { style: BorderStyle.SINGLE, size: 1 },
        left:    { style: BorderStyle.SINGLE, size: 1 },
        right:   { style: BorderStyle.SINGLE, size: 1 },
        insideH: { style: BorderStyle.SINGLE, size: 1 },
        insideV: { style: BorderStyle.SINGLE, size: 1 },
      },
    }),
    new Paragraph({
      spacing: { before: 200, after: 200 },
      children: [
        new TextRun({
          text: `Documento gerado em ${dateStr} por Judicore. As citações acima foram recuperadas de fontes públicas e utilizadas como contexto para a geração desta minuta.`,
          italics: true,
          font: "Times New Roman",
          size: 18,
          color: "666666",
        }),
      ],
    }),
  ];
}

export async function generateDocx(params: ExportParams): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT, width: 11906, height: 16838 },
            margin: { top: 1701, bottom: 1134, left: 1701, right: 1134 },
          },
        },
        children: [
          ...makeHeader(params),
          ...makeBody(params.content),
          ...makeSourcesTable(params.sources),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

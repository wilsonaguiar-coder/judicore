import { exec } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile, readFile, rm, mkdir, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

function runExec(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (err, _stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(_stdout);
    });
  });
}

async function extractDigital(buffer: Buffer): Promise<{ text: string; pages: number }> {
  // pdf-parse é CJS — importação dinâmica necessária em ESM
  const mod = await import("pdf-parse");
  const pdfParse = (mod as any).default ?? mod;
  const data = await pdfParse(buffer);
  return { text: data.text as string, pages: data.numpages as number };
}

async function extractOcr(buffer: Buffer): Promise<string> {
  const id = randomUUID();
  const dir = join(tmpdir(), `judicore-ocr-${id}`);
  const pdfPath = join(dir, "input.pdf");

  await mkdir(dir, { recursive: true });
  await writeFile(pdfPath, buffer);

  try {
    await runExec(`pdftoppm -r 200 -png "${pdfPath}" "${join(dir, "page")}"`);
    const files = (await readdir(dir)).filter((f) => f.endsWith(".png")).sort();

    const texts: string[] = [];
    for (const file of files) {
      const imgPath = join(dir, file);
      const outBase = imgPath.replace(".png", "");
      await runExec(`tesseract "${imgPath}" "${outBase}" -l por --psm 1`);
      const text = await readFile(`${outBase}.txt`, "utf-8").catch(() => "");
      texts.push(text.trim());
    }
    return texts.join("\n\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function extractPdfText(buffer: Buffer, filename: string): Promise<string> {
  try {
    const { text, pages } = await extractDigital(buffer);
    const avgCharsPerPage = pages > 0 ? text.length / pages : text.length;

    if (avgCharsPerPage > 100) {
      return `[Documento: ${filename}]\n${text.trim()}`;
    }

    console.log(`[pdf-extract] ${filename}: esparso (${avgCharsPerPage.toFixed(0)} chars/pág), tentando OCR`);
  } catch {
    console.log(`[pdf-extract] ${filename}: falha na extração digital, tentando OCR`);
  }

  try {
    const text = await extractOcr(buffer);
    return `[Documento: ${filename}]\n${text.trim()}`;
  } catch (err: any) {
    console.error(`[pdf-extract] OCR falhou para ${filename}:`, err.message);
    return `[Documento: ${filename}]\n[Não foi possível extrair o texto — PDF possivelmente escaneado sem suporte OCR no servidor]`;
  }
}

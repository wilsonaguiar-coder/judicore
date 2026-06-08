import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';

async function test() {
  // dummy pdf or just use a buffer
  const buffer = Buffer.from("fake-pdf");
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    console.log(result.text);
    await parser.destroy();
  } catch (e) {
    console.error("Erro fake pdf:", e.message);
  }
}
test();

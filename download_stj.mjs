import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const START = 780;
const END = 900;
const OUT_DIR = "stj_pdfs";
const BASE_URL = "https://processo.stj.jus.br/SCON/GetPDFINFJ?edicao=";

mkdirSync(OUT_DIR, { recursive: true });

console.log(`Baixando informativos STJ edições ${START}–${END}...\n`);

let baixados = 0;

for (let edition = START; edition <= END; edition++) {
  const num = String(edition).padStart(4, "0");
  const pdf_path = join(OUT_DIR, `Informativo_${num}.pdf`);

  if (existsSync(pdf_path)) {
    console.log(`[ok] Edição ${num} já existe, pulando.`);
    baixados++;
    continue;
  }

  const url = `${BASE_URL}${num}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.slice(0, 4).toString() === "%PDF") {
        writeFileSync(pdf_path, buf);
        console.log(`[ok] Edição ${num} baixada (${Math.round(buf.length / 1024)} KB)`);
        baixados++;
      } else {
        console.log(`[--] Edição ${num} não é PDF (HTTP ${res.status})`);
      }
    } else {
      console.log(`[--] Edição ${num} não encontrada (HTTP ${res.status})`);
    }
  } catch (e) {
    console.log(`[!!] Edição ${num} erro: ${e.message}`);
  }

  await new Promise((r) => setTimeout(r, 1000));
}

console.log(`\nConcluído: ${baixados} PDFs em ${OUT_DIR}/`);
console.log("\nPara enviar ao servidor:");
console.log(`  scp ${OUT_DIR}/*.pdf root@2.24.75.193:/opt/judicore/_internal/data/stj_informativos/docs/`);

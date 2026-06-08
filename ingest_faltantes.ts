import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface LawTarget {
  nome: string;
  url: string;
}

const targets: LawTarget[] = [
  { nome: "Lei 8.036/1990 (FGTS)", url: "http://www.planalto.gov.br/ccivil_03/leis/l8036compilada.htm" },
  { nome: "Lei 11.340/2006 (Maria da Penha)", url: "http://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm" },
];

async function ingestLaw(target: LawTarget) {
  console.log(`\\n--- Inciando ingestão: ${target.nome} ---`);
  
  const response = await fetch(target.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let html = "";

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    const decoder = new TextDecoder("utf-16le");
    html = decoder.decode(buffer);
  } else {
    const decoder = new TextDecoder("iso-8859-1"); 
    html = decoder.decode(buffer);
  }

  const $ = cheerio.load(html);
  $('strike, s, del, span[style*="line-through"]').remove();
  $('br').replaceWith('\\n');
  $('p').append('\\n');
  $('div').append('\\n');

  let text = $.text();
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/\\(Redação dada pel[^\\)]+\\)/g, "");
  text = text.replace(/\\(Incluído pel[^\\)]+\\)/g, "");
  text = text.replace(/\\(Vide[^\\)]+\\)/g, "");
  
  const lines = text.split('\\n').map(l => l.trim().replace(/\\s+/g, ' ')).filter(l => l.length > 0);

  const articles = [];
  let currentArticle = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.toLowerCase().startsWith("art.")) {
      if (currentArticle !== "") {
        articles.push({ normaNome: target.nome, dispositivo: currentArticle, texto: currentLines.join('\\n') });
      }
      
      const parts = line.split(" ");
      if (parts.length > 1) {
        currentArticle = parts[0] + " " + parts[1]; // Ex: "Art. 1º"
      } else {
        currentArticle = line;
      }
      
      currentLines = [line];
    } else if (currentArticle) {
      if (/^(LIVRO|TÍTULO|CAPÍTULO|SEÇÃO)/i.test(line)) {
        articles.push({ normaNome: target.nome, dispositivo: currentArticle, texto: currentLines.join('\\n') });
        currentArticle = ""; 
        currentLines = [];
        continue;
      }
      currentLines.push(line);
    }
  }
  if (currentArticle !== "") {
    articles.push({ normaNome: target.nome, dispositivo: currentArticle, texto: currentLines.join('\\n') });
  }

  console.log(`Encontrados ${articles.length} artigos válidos.`);
  return articles;
}

async function main() {
  const allData = [];
  for (const target of targets) {
    try {
      const data = await ingestLaw(target);
      allData.push(...data);
    } catch (e) {
      console.error(`Erro ao ingerir ${target.nome}:`, e);
    }
  }
  
  const outPath = path.join(process.cwd(), "legis_data_faltantes.json");
  fs.writeFileSync(outPath, JSON.stringify(allData, null, 2), "utf-8");
  console.log(`\\nArquivo salvo em: ${outPath} com ${allData.length} dispositivos totais.`);
}

main().catch(console.error);

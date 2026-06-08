import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

interface LawTarget {
  nome: string;
  url: string;
}

const targets: LawTarget[] = [
  // 1. Constitucional
  { nome: "Constituição Federal de 1988", url: "http://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm" },
  { nome: "Emenda Constitucional 103/2019", url: "http://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm" },
  // 2. Processo Civil
  { nome: "Lei 13.105/2015 (CPC)", url: "http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm" },
  { nome: "Lei 12.016/2009 (Mandado de Segurança)", url: "http://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12016.htm" },
  // 3. Civil, Família e Empresarial
  { nome: "Lei 10.406/2002 (Código Civil)", url: "http://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm" },
  { nome: "Lei 8.069/1990 (ECA)", url: "http://www.planalto.gov.br/ccivil_03/leis/l8069.htm" },
  { nome: "Lei 8.245/1991 (Lei do Inquilinato)", url: "http://www.planalto.gov.br/ccivil_03/leis/l8245.htm" },
  { nome: "Lei 11.101/2005 (Recuperação Judicial)", url: "http://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11101.htm" },
  // 4. Consumidor
  { nome: "Lei 8.078/1990 (CDC)", url: "http://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" },
  { nome: "Lei 9.656/1998 (Planos de Saúde)", url: "http://www.planalto.gov.br/ccivil_03/leis/l9656.htm" },
  // 5. Previdenciário (RGPS e LOAS)
  { nome: "Lei 8.213/1991 (Planos de Benefícios)", url: "http://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm" },
  { nome: "Lei 8.212/1991 (Custeio)", url: "http://www.planalto.gov.br/ccivil_03/leis/l8212cons.htm" },
  { nome: "Decreto 3.048/1999 (RPS)", url: "http://www.planalto.gov.br/ccivil_03/decreto/d3048.htm" },
  { nome: "Lei 8.742/1993 (LOAS)", url: "http://www.planalto.gov.br/ccivil_03/leis/l8742.htm" },
  // 6. Trabalhista
  { nome: "Decreto-Lei 5.452/1943 (CLT)", url: "http://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm" },
  { nome: "Lei 8.036/1990 (FGTS)", url: "http://www.planalto.gov.br/ccivil_03/leis/l8036compilada.htm" },
  // 7. Administrativo e Tributário
  { nome: "Lei 8.112/1990 (Servidores Federais)", url: "http://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm" },
  { nome: "Lei 14.133/2021 (Licitações)", url: "http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm" },
  { nome: "Lei 8.429/1992 (Improbidade)", url: "http://www.planalto.gov.br/ccivil_03/leis/l8429.htm" },
  { nome: "Lei 5.172/1966 (CTN)", url: "http://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm" },
  { nome: "Lei 6.830/1980 (LEF)", url: "http://www.planalto.gov.br/ccivil_03/leis/l6830.htm" },
  // 8. Penal e Processual Penal
  { nome: "Decreto-Lei 2.848/1940 (Código Penal)", url: "http://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm" },
  { nome: "Decreto-Lei 3.689/1941 (CPP)", url: "http://www.planalto.gov.br/ccivil_03/decreto-lei/del3689.htm" },
  { nome: "Lei 7.210/1984 (LEP)", url: "http://www.planalto.gov.br/ccivil_03/leis/l7210.htm" },
  { nome: "Lei 11.343/2006 (Drogas)", url: "http://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11343.htm" },
  { nome: "Lei 11.340/2006 (Maria da Penha)", url: "http://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm" },
  // 9. Juizados
  { nome: "Lei 9.099/1995 (JEC e JECRIM)", url: "http://www.planalto.gov.br/ccivil_03/leis/l9099.htm" },
  { nome: "Lei 10.259/2001 (JEF)", url: "http://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10259.htm" },
  { nome: "Lei 12.153/2009 (JEC Fazenda Pública)", url: "http://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12153.htm" }
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
  text = text.replace(/\\(Redação dada pel[^\\)]+\\)/g, "");
  text = text.replace(/\\(Incluído pel[^\\)]+\\)/g, "");
  text = text.replace(/\\(Vide[^\\)]+\\)/g, "");
  
  const lines = text.split('\\n').map(l => l.trim().replace(/\\s+/g, ' ')).filter(l => l.length > 0);

  const articles = [];
  let currentArticle = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.startsWith("art.") || lowerLine.startsWith("súmula") || lowerLine.startsWith("sumula")) {
      if (currentArticle !== "") {
        articles.push({ normaNome: target.nome, dispositivo: currentArticle, texto: currentLines.join('\\n') });
      }
      
      const parts = line.split(" ");
      if (lowerLine.startsWith("súmula vinculante") || lowerLine.startsWith("sumula vinculante")) {
         currentArticle = parts[0] + " " + parts[1] + " " + (parts[2] ?? ""); // Ex: "Súmula Vinculante 1"
      } else if (parts.length > 1) {
        currentArticle = parts[0] + " " + parts[1]; // Ex: "Art. 1º" ou "Súmula 1"
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
  
  const outPath = path.join(process.cwd(), "legis_data.json");
  fs.writeFileSync(outPath, JSON.stringify(allData, null, 2), "utf-8");
  console.log(`\\nArquivo salvo em: ${outPath} com ${allData.length} dispositivos totais.`);
}

main().catch(console.error);

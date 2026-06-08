import * as cheerio from "cheerio";
import { PrismaClient } from "@judicore/db";

const prisma = new PrismaClient();

interface LawTarget {
  nome: string;
  url: string;
}

const targets: LawTarget[] = [
  { nome: "Lei 13.105/2015 (CPC)", url: "http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm" },
  { nome: "Lei 8.213/1991 (Planos de Benefícios)", url: "http://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm" },
  // Podemos adicionar todas as outras depois do primeiro teste.
];

async function ingestLaw(target: LawTarget) {
  console.log(`\\n--- Inciando ingestão: ${target.nome} ---`);
  console.log(`Fazendo download de: ${target.url}`);
  
  const response = await fetch(target.url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar ${target.url}: ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder("iso-8859-1"); // Planalto usa iso-8859-1
  const html = decoder.decode(buffer);

  console.log("Processando HTML...");
  const $ = cheerio.load(html);

  // 1. Remover textos revogados explicitamente marcados com tag de tachado
  $('strike, s, del, span[style*="line-through"]').remove();

  // 2. Extrair texto substituindo quebras de bloco por \\n
  $('br').replaceWith('\\n');
  $('p').append('\\n');
  $('div').append('\\n');

  let text = $('body').text();

  // 3. Limpeza de texto
  // Remove menções de "Redação dada pela Lei..."
  text = text.replace(/\\(Redação dada pel[^\\)]+\\)/g, "");
  // Remove menções de "Incluído pela Lei..."
  text = text.replace(/\\(Incluído pel[^\\)]+\\)/g, "");
  // Remove menções de "Vide..."
  text = text.replace(/\\(Vide[^\\)]+\\)/g, "");
  
  // Normalizar quebras de linha múltiplas
  const lines = text.split('\\n').map(l => l.trim().replace(/\\s+/g, ' ')).filter(l => l.length > 0);

  const articles = new Map<string, string[]>();
  let currentArticle = "";

  for (const line of lines) {
    // Identifica inicio de um Artigo. Ex: "Art. 1º", "Art. 2o", "Art. 15."
    const artMatch = line.match(/^Art\\.\\s*(\\d+)[ºo\\.]?/i);
    
    if (artMatch) {
      currentArticle = `Art. ${artMatch[1]}`;
      articles.set(currentArticle, [line]);
    } else if (currentArticle) {
      // Se não é o começo de um novo artigo, mas já estamos num artigo, 
      // pode ser um parágrafo, inciso, ou continuação do texto.
      // Se for Livro, Título, Capítulo, ignoramos como parte do artigo atual, a menos que seja relevante.
      if (/^(LIVRO|TÍTULO|CAPÍTULO|SEÇÃO)/i.test(line)) {
        currentArticle = ""; // Quebra o artigo, é um cabeçalho
        continue;
      }
      
      articles.get(currentArticle)!.push(line);
    }
  }

  console.log(`Encontrados ${articles.size} artigos válidos.`);

  let inserted = 0;
  for (const [artName, artLines] of articles.entries()) {
    const fullText = artLines.join('\\n');
    
    // Insere ou atualiza no banco
    await prisma.legisDevice.upsert({
      where: {
        normaNome_dispositivo: {
          normaNome: target.nome,
          dispositivo: artName
        }
      },
      update: {
        texto: fullText
      },
      create: {
        normaNome: target.nome,
        dispositivo: artName,
        texto: fullText
      }
    });
    inserted++;
  }
  
  console.log(`Sucesso! ${inserted} artigos de ${target.nome} inseridos no banco.`);
}

async function main() {
  for (const target of targets) {
    try {
      await ingestLaw(target);
    } catch (e) {
      console.error(`Erro ao ingerir ${target.nome}:`, e);
    }
  }
  await prisma.$disconnect();
}

main().catch(console.error);

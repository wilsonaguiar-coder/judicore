import * as cheerio from "cheerio";

async function main() {
  const url = "http://www.planalto.gov.br/ccivil_03/LEIS/L8036cons.htm";
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  
  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder("iso-8859-1"); 
  const html = decoder.decode(buffer);

  const $ = cheerio.load(html);
  $('strike, s, del, span[style*="line-through"]').remove();
  $('br').replaceWith('\\n');
  $('p').append('\\n');
  $('div').append('\\n');

  let text = $('body').text();
  const lines = text.split('\\n').map(l => l.trim().replace(/\\s+/g, ' ')).filter(l => l.length > 0);
  
  for(let i=0; i<150; i++) {
    console.log(`Linha ${i}: ${lines[i]}`);
  }
}

main().catch(console.error);

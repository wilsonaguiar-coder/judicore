import { readFileSync } from "node:fs";

const txt = readFileSync("docs/validation/VALIDATION_CORPUS_V1.txt", "utf-8");

function parseCorpus(txt) {
  const cases = [];
  const blocks = txt.split(/^---\s*$/m);
  for (const block of blocks) {
    const idMatch = block.match(/\[CASE-(\d+)\]/);
    if (!idMatch) continue;
    const domain = block.match(/^DOMINIO:\s*\n(.+)$/m)?.[1].trim();
    const type = block.match(/^TIPO:\s*\n(.+)$/m)?.[1].trim();
    const exp = block.match(/^EXPECTATIVA:\s*\n(.+)$/m)?.[1].trim();
    const desc = block.match(/^DESCRICAO:\s*\n(.+)$/m)?.[1].trim();
    cases.push({ id: idMatch[1], domain, type, exp, desc });
  }
  return cases;
}

const cases = parseCorpus(txt);
console.log("Total Cases:", cases.length);
const domains = {};
const types = {};
for (const c of cases) {
  domains[c.domain] = (domains[c.domain] || 0) + 1;
  types[c.type] = (types[c.type] || 0) + 1;
}
console.log("Domains:", domains);
console.log("Types:", types);

const difficults = cases.filter(c => c.type === 'DIFÍCIL');
console.log("Difficults:", difficults.map(c => `CASE-${c.id.padStart(3, '0')}`).join(", "));

import { readFileSync } from "node:fs";

const txt = readFileSync("docs/validation/VALIDATION_CORPUS_V1.txt", "utf-8");
function parseCorpus(txt) {
  const cases = [];
  const blocks = txt.split(/^---\s*$/m);
  for (const block of blocks) {
    const idMatch = block.match(/\[CASE-(\d+)\]/);
    if (!idMatch) continue;
    const exp = block.match(/^EXPECTATIVA:\s*\n(.+)$/m)?.[1].trim();
    if (exp && exp !== "NENHUM_ALERTA" && exp !== "REVIEW_HUMAN") {
       cases.push(exp);
    }
  }
  return cases;
}
const exps = parseCorpus(txt);
console.log("Regras:", [...new Set(exps)].join("\n"));

// Runner cross-platform: invoca o Node test runner via tsx para um conjunto
// de diretórios. Evita problemas com expansão de glob no PowerShell.

import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

function findTestFiles(rootDir: string): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith(".test.ts")) out.push(full);
    }
  }
  walk(rootDir);
  return out;
}

const mode = process.argv[2] ?? "legal";
const dirs: string[] =
  mode === "legal"
    ? [join(__dirname, "validators"), join(__dirname, "pipeline")]
    : mode === "legal-ai"
      ? [join(__dirname, "legal-ai")]
      : [];

if (dirs.length === 0) {
  console.error(`Modo desconhecido: ${mode}. Use "legal" ou "legal-ai".`);
  process.exit(1);
}

const files = dirs.flatMap(findTestFiles);
if (files.length === 0) {
  console.error("Nenhum arquivo de teste encontrado.");
  process.exit(1);
}

console.log(`[run] Modo: ${mode} | Arquivos: ${files.length}`);

const child = spawn(
  process.execPath,
  ["--import", "tsx", "--test", ...files],
  { stdio: "inherit", env: process.env },
);

child.on("exit", (code) => process.exit(code ?? 1));

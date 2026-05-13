/**
 * stj_indexar.mjs — baixa informativos STJ novos, envia ao servidor e dispara indexação.
 *
 * Uso:
 *   node stj_indexar.mjs
 *
 * Requer as variáveis de ambiente (ou arquivo .env na raiz):
 *   STJ_API_URL   — URL base da API  (padrão: https://www.judicore.com.br/api)
 *   STJ_API_TOKEN — Bearer token de um usuário ADMIN
 *
 * Ou edite as constantes abaixo diretamente.
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Configuração ────────────────────────────────────────────────────────────
const API_URL   = process.env.STJ_API_URL   ?? "https://www.judicore.com.br/api";
const API_TOKEN = process.env.STJ_API_TOKEN ?? "";
const STJ_PDF   = "https://processo.stj.jus.br/SCON/GetPDFINFJ?edicao=";
const MAX_MISSES = 3;   // para após N edições consecutivas não encontradas

if (!API_TOKEN) {
  console.error("❌  Defina STJ_API_TOKEN com o token de um admin.");
  console.error("    Exemplo: STJ_API_TOKEN=xxx node stj_indexar.mjs");
  process.exit(1);
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`POST ${path} → HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

async function uploadPdf(edition, buf) {
  const form = new FormData();
  const num = String(edition).padStart(4, "0");
  form.append("files", new Blob([buf], { type: "application/pdf" }), `Informativo_${num}.pdf`);
  const res = await fetch(`${API_URL}/admin/lancedb/stj/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_TOKEN}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload edição ${num} → HTTP ${res.status}`);
  return res.json();
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log("── Indexador STJ ───────────────────────────────────────");
console.log(`   API: ${API_URL}`);

// 1. Descobrir última edição indexada
let lastEdition = 0;
try {
  const info = await apiGet("/admin/lancedb/info");
  lastEdition = info.stj_last_edition ?? 0;
  console.log(`   Última edição indexada no servidor: #${lastEdition}`);
} catch (e) {
  console.error(`❌  Erro ao consultar servidor: ${e.message}`);
  process.exit(1);
}

const start = lastEdition + 1;
console.log(`   Buscando a partir da edição #${start}...\n`);

// 2. Baixar e enviar PDFs novos
let uploaded = 0;
let lastUploaded = lastEdition;
let misses = 0;

for (let ed = start; misses < MAX_MISSES; ed++) {
  const num = String(ed).padStart(4, "0");
  try {
    const res = await fetch(`${STJ_PDF}${num}`, { headers: HEADERS });
    if (!res.ok) {
      console.log(`[--] Edição ${num} não encontrada (HTTP ${res.status})`);
      misses++;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.slice(0, 4).toString() !== "%PDF") {
      console.log(`[--] Edição ${num} — resposta não é PDF`);
      misses++;
      continue;
    }
    misses = 0;
    process.stdout.write(`[dl] Edição ${num} (${Math.round(buf.length / 1024)} KB) — enviando...`);
    await uploadPdf(ed, buf);
    lastUploaded = ed;
    uploaded++;
    console.log(" ✓");
  } catch (e) {
    console.log(`[!!] Edição ${num}: ${e.message}`);
    misses++;
  }
  await new Promise((r) => setTimeout(r, 800));
}

if (uploaded === 0) {
  console.log("\n✅  Nenhuma edição nova encontrada. Base já está atualizada.");
  process.exit(0);
}

console.log(`\n${uploaded} edição(ões) enviada(s) ao servidor.`);

// 3. Disparar embedding no servidor
console.log("   Iniciando embedding STJ no servidor...");
try {
  const job = await apiPost("/admin/lancedb/update", { sources: ["stj"], skip_browser: true });
  console.log(`   Job iniciado: #${job.id}`);

  // 4. Aguardar conclusão
  let dots = 0;
  while (true) {
    await new Promise((r) => setTimeout(r, 6000));
    const status = await apiGet(`/admin/lancedb/update/${job.id}`);
    process.stdout.write(".");
    dots++;
    if (status.status === "completed") {
      console.log(`\n\n✅  Base STJ atualizada até a edição #${lastUploaded}.`);
      if (status.latest_dates?.stj) console.log(`   Data mais recente indexada: ${status.latest_dates.stj}`);
      break;
    }
    if (status.status === "failed") {
      console.log(`\n❌  Embedding falhou: ${status.error}`);
      process.exit(1);
    }
    if (dots > 120) {
      console.log("\n⚠️   Timeout aguardando embedding. Verifique o servidor.");
      process.exit(1);
    }
  }
} catch (e) {
  console.error(`❌  Erro ao disparar embedding: ${e.message}`);
  process.exit(1);
}

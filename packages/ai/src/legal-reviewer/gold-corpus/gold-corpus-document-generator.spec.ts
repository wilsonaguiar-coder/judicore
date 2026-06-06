/**
 * FASE 9.0.5B — Testes de Validação do Gerador de Documentos Sintéticos
 *
 * 22 testes que verificam a correção, determinismo e conformidade dos documentos gerados.
 */

import { GoldCorpusDocumentGeneratorService } from "./gold-corpus-document-generator.service.js";
import { goldCorpusV1 } from "./gold-corpus-v1.spec.js";
import { goldCorpusGeneratedDocuments } from "./gold-corpus-generated-documents.js";

// ─── Harness ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n      ${msg}`);
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const service = new GoldCorpusDocumentGeneratorService();
const docs = goldCorpusGeneratedDocuments;
const FORBIDDEN_PHRASES = [
  "defeito planejado",
  "finding esperado",
  "score esperado",
  "erro inserido",
  "teste sintético",
];
const FIXED_GENERATED_AT = "2026-06-06T00:00:00.000Z";

// ─── Suite 1 — Contagem e cobertura ──────────────────────────────────────────

console.log("\nSuite 1 — Contagem e cobertura");

test("Gera exatamente 100 documentos para o corpus v1", () => {
  assert(docs.length === 100, `Esperado 100, obtido ${docs.length}`);
});

test("generateAll retorna o mesmo número que goldCorpusV1", () => {
  const generated = service.generateAll(goldCorpusV1);
  assert(
    generated.length === goldCorpusV1.length,
    `generateAll retornou ${generated.length}, esperado ${goldCorpusV1.length}`,
  );
});

test("Todos os 11 domínios estão representados nos documentos", () => {
  const domains = new Set(docs.map((d) => d.domain));
  const expected = ["RGPS", "RPPS", "TRABALHISTA", "TRIBUTARIO", "FAMILIA", "CONSUMIDOR", "CRIMINAL", "FAZENDA_PUBLICA", "AMBIENTAL", "CIVEL", "JUIZADO_ESPECIAL"];
  for (const dom of expected) {
    assert(domains.has(dom), `Domínio ${dom} ausente nos documentos gerados`);
  }
});

// ─── Suite 2 — Campos obrigatórios ───────────────────────────────────────────

console.log("\nSuite 2 — Campos obrigatórios presentes");

test("Todos os documentos têm caseId não vazio", () => {
  const missing = docs.filter((d) => !d.caseId || d.caseId.trim() === "");
  assert(missing.length === 0, `${missing.length} documentos sem caseId`);
});

test("Todos os documentos têm title não vazio", () => {
  const missing = docs.filter((d) => !d.title || d.title.trim() === "");
  assert(missing.length === 0, `${missing.length} documentos sem title`);
});

test("Todos os documentos têm text com pelo menos 500 caracteres", () => {
  const short = docs.filter((d) => !d.text || d.text.length < 500);
  assert(
    short.length === 0,
    `${short.length} documentos com text < 500 chars: ${short.map((d) => d.caseId).join(", ")}`,
  );
});

test("Todos os documentos têm metadata.synthetic === true", () => {
  const bad = docs.filter((d) => d.metadata.synthetic !== true);
  assert(bad.length === 0, `${bad.length} documentos com synthetic !== true`);
});

test("Todos os documentos têm metadata.generatorVersion === 'v1'", () => {
  const bad = docs.filter((d) => d.metadata.generatorVersion !== "v1");
  assert(bad.length === 0, `${bad.length} documentos com generatorVersion incorreto`);
});

test("Todos os documentos têm metadata.generatedAt fixo", () => {
  const bad = docs.filter((d) => d.metadata.generatedAt !== FIXED_GENERATED_AT);
  assert(
    bad.length === 0,
    `${bad.length} documentos com generatedAt incorreto (esperado ${FIXED_GENERATED_AT})`,
  );
});

// ─── Suite 3 — Determinismo ───────────────────────────────────────────────────

console.log("\nSuite 3 — Determinismo");

test("Gerar o mesmo caso duas vezes produz texto idêntico", () => {
  const case1 = goldCorpusV1[0];
  const doc1 = service.generate(case1);
  const doc2 = service.generate(case1);
  assert(doc1.text === doc2.text, "Texto diferente na segunda geração do mesmo caso");
});

test("Gerar todos os casos duas vezes produz textos idênticos", () => {
  const first = service.generateAll(goldCorpusV1);
  const second = service.generateAll(goldCorpusV1);
  for (let i = 0; i < first.length; i++) {
    assert(
      first[i].text === second[i].text,
      `Texto diferente na segunda geração para caseId ${first[i].caseId}`,
    );
  }
});

// ─── Suite 4 — Frases proibidas ───────────────────────────────────────────────

console.log("\nSuite 4 — Frases proibidas nos documentos");

test("Nenhum documento contém 'defeito planejado' no texto", () => {
  const bad = docs.filter((d) => d.text.toLowerCase().includes("defeito planejado"));
  assert(bad.length === 0, `${bad.length} documentos contêm 'defeito planejado': ${bad.map((d) => d.caseId).join(", ")}`);
});

test("Nenhum documento contém 'finding esperado' no texto", () => {
  const bad = docs.filter((d) => d.text.toLowerCase().includes("finding esperado"));
  assert(bad.length === 0, `${bad.length} documentos contêm 'finding esperado': ${bad.map((d) => d.caseId).join(", ")}`);
});

test("Nenhum documento contém 'score esperado', 'erro inserido' ou 'teste sintético'", () => {
  const phrases = ["score esperado", "erro inserido", "teste sintético"];
  const bad = docs.filter((d) => phrases.some((p) => d.text.toLowerCase().includes(p)));
  assert(bad.length === 0, `${bad.length} documentos contêm frases proibidas: ${bad.map((d) => d.caseId).join(", ")}`);
});

// ─── Suite 5 — Fidelidade ao corpus ──────────────────────────────────────────

console.log("\nSuite 5 — Fidelidade ao corpus");

test("caseId corresponde ao id do GoldCorpusCase original", () => {
  for (let i = 0; i < goldCorpusV1.length; i++) {
    assert(
      docs[i].caseId === goldCorpusV1[i].id,
      `docs[${i}].caseId=${docs[i].caseId} ≠ ${goldCorpusV1[i].id}`,
    );
  }
});

test("domain corresponde ao domínio do GoldCorpusCase original", () => {
  for (let i = 0; i < goldCorpusV1.length; i++) {
    assert(
      docs[i].domain === goldCorpusV1[i].domain,
      `docs[${i}].domain=${docs[i].domain} ≠ ${goldCorpusV1[i].domain}`,
    );
  }
});

test("documentType corresponde ao do GoldCorpusCase original", () => {
  for (let i = 0; i < goldCorpusV1.length; i++) {
    assert(
      docs[i].documentType === goldCorpusV1[i].documentType,
      `docs[${i}].documentType=${docs[i].documentType} ≠ ${goldCorpusV1[i].documentType}`,
    );
  }
});

test("subtype está presente quando GoldCorpusCase tem subtype", () => {
  const casesWithSubtype = goldCorpusV1.filter((c) => c.subtype !== undefined);
  for (const c of casesWithSubtype) {
    const doc = docs.find((d) => d.caseId === c.id);
    assert(doc !== undefined, `Documento não encontrado para ${c.id}`);
    assert(
      doc!.subtype === c.subtype,
      `${c.id}: subtype esperado ${c.subtype}, obtido ${doc!.subtype}`,
    );
  }
});

test("plantedIssues e expectedFindings são copiados corretamente", () => {
  for (let i = 0; i < goldCorpusV1.length; i++) {
    assert(
      JSON.stringify(docs[i].plantedIssues) === JSON.stringify(goldCorpusV1[i].plantedIssues),
      `${goldCorpusV1[i].id}: plantedIssues diverge`,
    );
    assert(
      JSON.stringify(docs[i].expectedFindings) === JSON.stringify(goldCorpusV1[i].expectedFindings),
      `${goldCorpusV1[i].id}: expectedFindings diverge`,
    );
  }
});

test("expectedScoreRange é copiado corretamente", () => {
  for (let i = 0; i < goldCorpusV1.length; i++) {
    assert(
      docs[i].expectedScoreRange.min === goldCorpusV1[i].expectedScoreRange.min &&
        docs[i].expectedScoreRange.max === goldCorpusV1[i].expectedScoreRange.max,
      `${goldCorpusV1[i].id}: expectedScoreRange diverge`,
    );
  }
});

// ─── Suite 6 — Estrutura do texto ────────────────────────────────────────────

console.log("\nSuite 6 — Estrutura do texto");

test("Documentos de petição inicial contêm endereçamento judicial", () => {
  const peticoes = docs.filter((d) => d.documentType === "PETICAO_INICIAL");
  const sem = peticoes.filter((d) => !d.text.includes("EXCELENTÍSSIMO"));
  assert(sem.length === 0, `${sem.length} petições sem endereçamento: ${sem.map((d) => d.caseId).join(", ")}`);
});

test("Documentos GOOD têm texto mais completo que SEVERE_ISSUES do mesmo domínio", () => {
  const domains = ["RGPS", "TRABALHISTA", "TRIBUTARIO"];
  for (const domain of domains) {
    const good = docs.filter((d) => d.domain === domain && d.metadata.quality === "GOOD");
    const severe = docs.filter((d) => d.domain === domain && d.metadata.quality === "SEVERE_ISSUES");
    if (good.length > 0 && severe.length > 0) {
      const avgGood = good.reduce((s, d) => s + d.text.length, 0) / good.length;
      const avgSevere = severe.reduce((s, d) => s + d.text.length, 0) / severe.length;
      assert(avgGood >= avgSevere, `${domain}: média GOOD (${avgGood.toFixed(0)}) < SEVERE (${avgSevere.toFixed(0)})`);
    }
  }
});

// ─── Resultado final ──────────────────────────────────────────────────────────

console.log(`\nTotal: ${passed + failed} | ✓ ${passed} | ✗ ${failed}`);
if (failed > 0) {
  console.error(`\n${failed} testes falharam.`);
  process.exit(1);
} else {
  console.log("Todos os testes passaram.");
}

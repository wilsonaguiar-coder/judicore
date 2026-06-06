/**
 * FASE 9.0.5A — Validação Estrutural do Gold Corpus V1
 *
 * Verifica as invariantes do corpus sem conectar ao reviewer real.
 *
 * Checks:
 *  1. Total de 100 casos
 *  2. IDs únicos
 *  3. Distribuição por domínio correta
 *  4. Todos possuem expectedScoreRange válido (números, 0–100)
 *  5. score min < score max
 *  6. Casos GOOD não possuem plantedIssues
 *  7. Casos com issues possuem expectedFindings e plantedIssues
 *  8. Todos os domínios têm ao menos uma peça GOOD e uma com problema
 *  9. Nenhum expectedScoreRange fora de 0–100
 * 10. IDs correspondem ao prefixo do domínio esperado
 * 11. documentType é sempre um valor canônico
 * 12. Casos com subtype têm notes explicativas
 * 13. Casos SEVERE_ISSUES têm score máximo ≤ 75 (consistência calibração)
 * 14. Casos GOOD têm score mínimo ≥ 80 (consistência calibração)
 * 15. Casos com unexpectedFindings são GOOD (semântica correta)
 *
 * Executa com: pnpm dlx tsx packages/ai/src/legal-reviewer/gold-corpus/gold-corpus-v1.validation.spec.ts
 */

import { goldCorpusV1 } from "./gold-corpus-v1.spec.js";
import { CORPUS_V1_DISTRIBUTION, CORPUS_V1_TOTAL } from "./gold-corpus.types.js";
import type { GoldCorpusCase, DocumentType, Quality } from "./gold-corpus.types.js";

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${(err as Error).message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}\n    Expected: ${String(expected)}\n    Actual:   ${String(actual)}`);
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_DOCUMENT_TYPES: Set<DocumentType> = new Set([
  "PETICAO_INICIAL",
  "CONTESTACAO",
  "RECURSO",
  "SENTENCA",
  "DECISAO",
  "DESPACHO",
  "CUMPRIMENTO_SENTENCA",
]);

const VALID_QUALITIES: Set<Quality> = new Set([
  "GOOD",
  "LIGHT_ISSUES",
  "MODERATE_ISSUES",
  "SEVERE_ISSUES",
]);

const VALID_DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD"]);

/** Prefixo de ID esperado por domínio canônico. */
const DOMAIN_TO_ID_PREFIX: Record<string, string> = {
  RGPS: "RGPS-",
  RPPS: "RPPS-",
  TRABALHISTA: "TRAB-",
  TRIBUTARIO: "TRIB-",
  FAMILIA: "FAM-",
  CONSUMIDOR: "CONS-",
  CRIMINAL: "CRIM-",
  FAZENDA_PUBLICA: "FAZ-",
  AMBIENTAL: "AMB-",
  CIVEL: "CIV-",
  JUIZADO_ESPECIAL: "JEC-",
};

// ── Suite 1: Contagem e unicidade ─────────────────────────────────────────────

console.log("\n1. Contagem e unicidade");

test(`corpus tem exatamente ${CORPUS_V1_TOTAL} casos`, () => {
  assertEqual(goldCorpusV1.length, CORPUS_V1_TOTAL, `Total de casos incorreto`);
});

test("todos os IDs são únicos", () => {
  const ids = goldCorpusV1.map(c => c.id);
  const unique = new Set(ids);
  assert(unique.size === ids.length, `IDs duplicados: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(", ")}`);
});

test("todos os IDs são strings não vazias", () => {
  const empty = goldCorpusV1.filter(c => !c.id || typeof c.id !== "string" || c.id.trim() === "");
  assert(empty.length === 0, `${empty.length} casos com ID inválido`);
});

// ── Suite 2: Distribuição por domínio ─────────────────────────────────────────

console.log("\n2. Distribuição por domínio");

for (const [domain, expectedCount] of Object.entries(CORPUS_V1_DISTRIBUTION)) {
  test(`${domain}: ${expectedCount} caso${expectedCount !== 1 ? "s" : ""}`, () => {
    const actual = goldCorpusV1.filter(c => c.domain === domain).length;
    assertEqual(actual, expectedCount, `${domain} tem ${actual} caso(s), esperado ${expectedCount}`);
  });
}

test("nenhum caso tem domínio fora do conjunto canônico", () => {
  const knownDomains = new Set(Object.keys(CORPUS_V1_DISTRIBUTION));
  const unknown = goldCorpusV1.filter(c => !knownDomains.has(c.domain));
  assert(
    unknown.length === 0,
    `Casos com domínio desconhecido: ${unknown.map(c => `${c.id}(${c.domain})`).join(", ")}`,
  );
});

// ── Suite 3: ScoreRange válido ────────────────────────────────────────────────

console.log("\n3. expectedScoreRange válido (0–100, min < max)");

test("todos os casos têm expectedScoreRange com min e max numéricos", () => {
  const invalid = goldCorpusV1.filter(
    c =>
      typeof c.expectedScoreRange?.min !== "number" ||
      typeof c.expectedScoreRange?.max !== "number",
  );
  assert(invalid.length === 0, `${invalid.length} caso(s) sem expectedScoreRange numérico: ${invalid.map(c => c.id).join(", ")}`);
});

test("score min < score max em todos os casos", () => {
  const invalid = goldCorpusV1.filter(c => c.expectedScoreRange.min >= c.expectedScoreRange.max);
  assert(
    invalid.length === 0,
    `${invalid.length} caso(s) com min >= max: ${invalid.map(c => `${c.id}(${c.expectedScoreRange.min}-${c.expectedScoreRange.max})`).join(", ")}`,
  );
});

test("score min >= 0 em todos os casos", () => {
  const invalid = goldCorpusV1.filter(c => c.expectedScoreRange.min < 0);
  assert(
    invalid.length === 0,
    `${invalid.length} caso(s) com min < 0: ${invalid.map(c => c.id).join(", ")}`,
  );
});

test("score max <= 100 em todos os casos", () => {
  const invalid = goldCorpusV1.filter(c => c.expectedScoreRange.max > 100);
  assert(
    invalid.length === 0,
    `${invalid.length} caso(s) com max > 100: ${invalid.map(c => c.id).join(", ")}`,
  );
});

// ── Suite 4: Invariantes de quality ───────────────────────────────────────────

console.log("\n4. Invariantes de quality");

test("todos têm quality válido", () => {
  const invalid = goldCorpusV1.filter(c => !VALID_QUALITIES.has(c.quality));
  assert(
    invalid.length === 0,
    `${invalid.length} caso(s) com quality inválido: ${invalid.map(c => `${c.id}(${c.quality})`).join(", ")}`,
  );
});

test("casos GOOD não possuem plantedIssues", () => {
  const bad = goldCorpusV1.filter(c => c.quality === "GOOD" && c.plantedIssues.length > 0);
  assert(
    bad.length === 0,
    `${bad.length} caso(s) GOOD com plantedIssues: ${bad.map(c => c.id).join(", ")}`,
  );
});

test("casos GOOD não possuem expectedFindings", () => {
  const bad = goldCorpusV1.filter(c => c.quality === "GOOD" && c.expectedFindings.length > 0);
  assert(
    bad.length === 0,
    `${bad.length} caso(s) GOOD com expectedFindings: ${bad.map(c => c.id).join(", ")}`,
  );
});

test("casos com issues possuem expectedFindings", () => {
  const bad = goldCorpusV1.filter(c => c.quality !== "GOOD" && c.expectedFindings.length === 0);
  assert(
    bad.length === 0,
    `${bad.length} caso(s) com issues sem expectedFindings: ${bad.map(c => `${c.id}(${c.quality})`).join(", ")}`,
  );
});

test("casos com issues possuem plantedIssues", () => {
  const bad = goldCorpusV1.filter(c => c.quality !== "GOOD" && c.plantedIssues.length === 0);
  assert(
    bad.length === 0,
    `${bad.length} caso(s) com quality != GOOD mas plantedIssues vazio: ${bad.map(c => `${c.id}(${c.quality})`).join(", ")}`,
  );
});

// ── Suite 5: Cobertura mínima por domínio ──────────────────────────────────────

console.log("\n5. Cobertura mínima — ao menos 1 GOOD e 1 não-GOOD por domínio");

for (const domain of Object.keys(CORPUS_V1_DISTRIBUTION)) {
  test(`${domain}: ao menos 1 caso GOOD`, () => {
    const hasGood = goldCorpusV1.some(c => c.domain === domain && c.quality === "GOOD");
    assert(hasGood, `Domínio ${domain} não tem nenhum caso GOOD`);
  });

  test(`${domain}: ao menos 1 caso com problemas`, () => {
    const hasIssues = goldCorpusV1.some(c => c.domain === domain && c.quality !== "GOOD");
    assert(hasIssues, `Domínio ${domain} não tem nenhum caso com problemas`);
  });
}

// ── Suite 6: DocumentType canônico ─────────────────────────────────────────────

console.log("\n6. documentType canônico e subtype");

test("todos os casos têm documentType canônico", () => {
  const invalid = goldCorpusV1.filter(c => !VALID_DOCUMENT_TYPES.has(c.documentType));
  assert(
    invalid.length === 0,
    `${invalid.length} caso(s) com documentType inválido: ${invalid.map(c => `${c.id}(${c.documentType})`).join(", ")}`,
  );
});

test("todos os casos com subtype têm notes explicativas", () => {
  const subtypedWithoutNotes = goldCorpusV1.filter(c => c.subtype && !c.notes);
  assert(
    subtypedWithoutNotes.length === 0,
    `${subtypedWithoutNotes.length} caso(s) com subtype mas sem notes: ${subtypedWithoutNotes.map(c => c.id).join(", ")}`,
  );
});

test("EMBARGOS mapeado para RECURSO", () => {
  const embargos = goldCorpusV1.filter(c => c.subtype === "EMBARGOS");
  assert(embargos.length > 0, "Nenhum caso com subtype EMBARGOS encontrado");
  const wrongType = embargos.filter(c => c.documentType !== "RECURSO");
  assert(
    wrongType.length === 0,
    `EMBARGOS mapeado para tipo errado em: ${wrongType.map(c => `${c.id}(${c.documentType})`).join(", ")}`,
  );
});

test("EXCECAO_PRE_EXECUTIVIDADE mapeado para PETICAO_INICIAL", () => {
  const excecao = goldCorpusV1.filter(c => c.subtype === "EXCECAO_PRE_EXECUTIVIDADE");
  assert(excecao.length > 0, "Nenhum caso com subtype EXCECAO_PRE_EXECUTIVIDADE encontrado");
  const wrongType = excecao.filter(c => c.documentType !== "PETICAO_INICIAL");
  assert(
    wrongType.length === 0,
    `EXCECAO_PRE_EXECUTIVIDADE mapeado para tipo errado em: ${wrongType.map(c => `${c.id}(${c.documentType})`).join(", ")}`,
  );
});

// ── Suite 7: Difficulty ────────────────────────────────────────────────────────

console.log("\n7. Difficulty válido");

test("todos têm difficulty válido", () => {
  const invalid = goldCorpusV1.filter(c => !VALID_DIFFICULTIES.has(c.difficulty));
  assert(
    invalid.length === 0,
    `${invalid.length} caso(s) com difficulty inválido: ${invalid.map(c => `${c.id}(${c.difficulty})`).join(", ")}`,
  );
});

// ── Suite 8: Prefixo de ID por domínio ────────────────────────────────────────

console.log("\n8. Prefixo de ID corresponde ao domínio");

for (const [domain, prefix] of Object.entries(DOMAIN_TO_ID_PREFIX)) {
  test(`Casos ${domain} têm IDs com prefixo "${prefix}"`, () => {
    const wrongPrefix = goldCorpusV1.filter(c => c.domain === domain && !c.id.startsWith(prefix));
    assert(
      wrongPrefix.length === 0,
      `${wrongPrefix.length} caso(s) ${domain} com prefixo errado: ${wrongPrefix.map(c => c.id).join(", ")}`,
    );
  });
}

// ── Suite 9: Calibração de score por quality ───────────────────────────────────

console.log("\n9. Consistência de calibração: score por quality");

test("casos SEVERE_ISSUES têm score máximo ≤ 75", () => {
  const bad = goldCorpusV1.filter(c => c.quality === "SEVERE_ISSUES" && c.expectedScoreRange.max > 75);
  assert(
    bad.length === 0,
    `${bad.length} caso(s) SEVERE_ISSUES com max > 75: ${bad.map(c => `${c.id}(max=${c.expectedScoreRange.max})`).join(", ")}`,
  );
});

test("casos GOOD têm score mínimo ≥ 80", () => {
  const bad = goldCorpusV1.filter(c => c.quality === "GOOD" && c.expectedScoreRange.min < 80);
  assert(
    bad.length === 0,
    `${bad.length} caso(s) GOOD com min < 80: ${bad.map(c => `${c.id}(min=${c.expectedScoreRange.min})`).join(", ")}`,
  );
});

test("casos MODERATE_ISSUES têm score máximo ≤ 85", () => {
  const bad = goldCorpusV1.filter(c => c.quality === "MODERATE_ISSUES" && c.expectedScoreRange.max > 85);
  assert(
    bad.length === 0,
    `${bad.length} caso(s) MODERATE_ISSUES com max > 85: ${bad.map(c => `${c.id}(max=${c.expectedScoreRange.max})`).join(", ")}`,
  );
});

// ── Suite 10: unexpectedFindings semântica ─────────────────────────────────────

console.log("\n10. unexpectedFindings — semântica correta");

test("casos com unexpectedFindings não-vazio são GOOD", () => {
  const bad = goldCorpusV1.filter(
    c =>
      Array.isArray(c.unexpectedFindings) &&
      c.unexpectedFindings.length > 0 &&
      c.quality !== "GOOD",
  );
  assert(
    bad.length === 0,
    `${bad.length} caso(s) não-GOOD com unexpectedFindings: ${bad.map(c => `${c.id}(${c.quality})`).join(", ")}`,
  );
});

test("ao menos 1 caso tem unexpectedFindings para testar falsos positivos", () => {
  const withUnexpected = goldCorpusV1.filter(
    c => Array.isArray(c.unexpectedFindings) && c.unexpectedFindings.length > 0,
  );
  assert(withUnexpected.length >= 1, "Nenhum caso com unexpectedFindings — corpus não testa falsos positivos");
});

// ── Suite 11: Scenario não vazio ───────────────────────────────────────────────

console.log("\n11. Campos obrigatórios de texto não vazios");

test("todos os casos têm scenario não vazio", () => {
  const empty = goldCorpusV1.filter(c => !c.scenario || c.scenario.trim() === "");
  assert(empty.length === 0, `${empty.length} caso(s) sem scenario: ${empty.map(c => c.id).join(", ")}`);
});

test("todos os casos têm arrays (plantedIssues, expectedFindings) definidos", () => {
  const invalid = goldCorpusV1.filter(
    c => !Array.isArray(c.plantedIssues) || !Array.isArray(c.expectedFindings),
  );
  assert(
    invalid.length === 0,
    `${invalid.length} caso(s) com arrays inválidos: ${invalid.map(c => c.id).join(", ")}`,
  );
});

// ── Suite 12: Cobertura de difficulty por domínio ──────────────────────────────

console.log("\n12. Cobertura de difficulty — ao menos EASY e HARD por domínio com >= 10 casos");

const LARGE_DOMAINS = Object.entries(CORPUS_V1_DISTRIBUTION)
  .filter(([, count]) => count >= 10)
  .map(([domain]) => domain);

for (const domain of LARGE_DOMAINS) {
  test(`${domain}: tem casos EASY`, () => {
    const hasEasy = goldCorpusV1.some(c => c.domain === domain && c.difficulty === "EASY");
    assert(hasEasy, `Domínio ${domain} (${CORPUS_V1_DISTRIBUTION[domain]} casos) não tem nenhum caso EASY`);
  });

  test(`${domain}: tem casos HARD`, () => {
    const hasHard = goldCorpusV1.some(c => c.domain === domain && c.difficulty === "HARD");
    assert(hasHard, `Domínio ${domain} (${CORPUS_V1_DISTRIBUTION[domain]} casos) não tem nenhum caso HARD`);
  });
}

// ── Suite 13: Ordem e numeração ────────────────────────────────────────────────

console.log("\n13. Numeração sequencial dentro de cada domínio");

for (const [domain, prefix] of Object.entries(DOMAIN_TO_ID_PREFIX)) {
  test(`Casos ${domain} estão numerados sequencialmente a partir de 001`, () => {
    const domainCases = goldCorpusV1.filter(c => c.domain === domain);
    const numbers = domainCases
      .map(c => c.id.replace(prefix, ""))
      .map(n => parseInt(n, 10))
      .sort((a, b) => a - b);
    for (let i = 0; i < numbers.length; i++) {
      assert(
        numbers[i] === i + 1,
        `${domain}: numeração interrompida em ${prefix}${String(i + 1).padStart(3, "0")} — encontrado ${prefix}${String(numbers[i]).padStart(3, "0")}`,
      );
    }
  });
}

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`Total: ${passed + failed} | ✓ ${passed} | ✗ ${failed}`);

if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam`);
  process.exit(1);
} else {
  console.log(`\nTodos os ${passed} testes passaram`);
}

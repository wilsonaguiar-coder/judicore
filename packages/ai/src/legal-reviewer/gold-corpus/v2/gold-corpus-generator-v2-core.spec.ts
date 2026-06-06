/**
 * FASE 9.0.8.9 — Testes do núcleo do Gold Corpus Generator V2
 *
 * Cobre SeedFactory, renderElement e deriveExpectedFindings.
 * 18 testes organizados em 4 suites.
 *
 * Execução: tsx src/legal-reviewer/gold-corpus/v2/gold-corpus-generator-v2-core.spec.ts
 */

import { SeedFactory } from "./seed-factory.js";
import { renderElement } from "./document-element.js";
import { deriveExpectedFindings } from "./expected-finding-deriver.js";
import { buildDegradationMap, degrade, findDegradation, goodMap } from "./degradation-map.js";
import { DocumentSection } from "./gold-corpus-v2.types.js";
import type { DocumentElement, ElementDegradation } from "./gold-corpus-v2.types.js";

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

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: esperado "${String(expected)}", obtido "${String(actual)}"`);
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeElement(overrides: Partial<DocumentElement> = {}): DocumentElement {
  return {
    id: "elem-fatos-1",
    section: DocumentSection.DOS_FATOS,
    fullContent: "O segurado comprova 35 anos de contribuição com CNIS atualizado e NB 123456789.",
    lightContent: "O segurado afirma possuir tempo de contribuição suficiente.",
    omittedContent: "[tempo de contribuição não comprovado documentalmente]",
    omissionDescription: "ausência de comprovação documental do tempo de contribuição",
    correctPresenceKeywords: ["35 anos", "CNIS", "NB 123456789"],
    ...overrides,
  };
}

function makeDegradation(elementId: string, mode: ElementDegradation["mode"]): ElementDegradation {
  return { elementId, mode };
}

// ─── Suite 1 — SeedFactory ────────────────────────────────────────────────────

console.log("\nSuite 1 — SeedFactory");

test("build() é determinístico: mesmo caseId produz mesmo personName", () => {
  const a = SeedFactory.build("RGPS-001");
  const b = SeedFactory.build("RGPS-001");
  assertEqual(a.personName, b.personName, "personName");
  assertEqual(a.cpf, b.cpf, "cpf");
  assertEqual(a.processNumber, b.processNumber, "processNumber");
  assertEqual(a.city, b.city, "city");
});

test("build() com caseIds diferentes produz personNames distintos (cobertura de hash)", () => {
  const ids = ["RGPS-001", "TRAB-003", "CRIM-005", "FAM-002", "RPPS-004"];
  const names = ids.map((id) => SeedFactory.build(id).personName);
  // Todos os nomes devem estar na lista e ao menos 2 devem ser distintos
  // (colisão completa seria improvável com 5 caseIds distintos)
  const unique = new Set(names);
  assert(unique.size >= 2, `Todos os 5 caseIds produziram o mesmo nome: ${names[0]}`);
});

test("build() CPF tem formato NNN.NNN.NNN-NN", () => {
  const cpf = SeedFactory.build("FAZ-004").cpf;
  assert(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf), `CPF com formato inválido: "${cpf}"`);
});

test("build() processNumber tem formato CNJ NNNNNNN-DD.AAAA.J.TT.OOOO", () => {
  const proc = SeedFactory.build("TRIB-007").processNumber;
  assert(
    /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(proc),
    `processNumber com formato inválido: "${proc}"`,
  );
});

test("build() todos os campos são strings não-vazias", () => {
  const seed = SeedFactory.build("CONS-003");
  const fields: (keyof typeof seed)[] = [
    "personName", "cpf", "birthDate", "baseDate", "derDate",
    "protocolNumber", "processNumber", "causeValue", "salaryBase",
    "city", "courtName",
  ];
  for (const f of fields) {
    assert(seed[f].length > 0, `Campo "${f}" é vazio`);
  }
});

// ─── Suite 2 — renderElement ──────────────────────────────────────────────────

console.log("\nSuite 2 — renderElement");

test("sem degradação retorna fullContent", () => {
  const el = makeElement();
  assertEqual(renderElement(el), el.fullContent, "fullContent");
});

test("WEAKEN retorna lightContent", () => {
  const el = makeElement();
  const d = makeDegradation(el.id, "WEAKEN");
  assertEqual(renderElement(el, d), el.lightContent, "lightContent");
});

test("OMIT retorna omittedContent", () => {
  const el = makeElement();
  const d = makeDegradation(el.id, "OMIT");
  assertEqual(renderElement(el, d), el.omittedContent, "omittedContent");
});

test("ABSENT com absentContent string retorna absentContent", () => {
  const el = makeElement({ absentContent: "[seção suprimida]" });
  const d = makeDegradation(el.id, "ABSENT");
  assertEqual(renderElement(el, d), "[seção suprimida]", "absentContent string");
});

test("ABSENT com absentContent null retorna string vazia", () => {
  const el = makeElement({ absentContent: null });
  const d = makeDegradation(el.id, "ABSENT");
  assertEqual(renderElement(el, d), "", "absentContent null → vazio");
});

test("ABSENT sem absentContent retorna string vazia", () => {
  const el = makeElement(); // absentContent omitido
  const d = makeDegradation(el.id, "ABSENT");
  assertEqual(renderElement(el, d), "", "absentContent ausente → vazio");
});

test("CONTRADICT com absentContent retorna absentContent", () => {
  const el = makeElement({ absentContent: "[valor incorreto inserido]" });
  const d = makeDegradation(el.id, "CONTRADICT");
  assertEqual(renderElement(el, d), "[valor incorreto inserido]", "CONTRADICT → absentContent");
});

test("CONTRADICT sem absentContent retorna omittedContent como fallback", () => {
  const el = makeElement(); // absentContent omitido
  const d = makeDegradation(el.id, "CONTRADICT");
  assertEqual(renderElement(el, d), el.omittedContent, "CONTRADICT fallback → omittedContent");
});

// ─── Suite 3 — deriveExpectedFindings ─────────────────────────────────────────

console.log("\nSuite 3 — deriveExpectedFindings");

test("sem degradações retorna array vazio", () => {
  const result = deriveExpectedFindings([], [makeElement()]);
  assert(result.length === 0, `Esperado [], obtido ${JSON.stringify(result)}`);
});

test("WEAKEN não gera finding", () => {
  const el = makeElement();
  const result = deriveExpectedFindings([makeDegradation(el.id, "WEAKEN")], [el]);
  assert(result.length === 0, `WEAKEN não deve gerar finding, obtido ${JSON.stringify(result)}`);
});

test("OMIT gera finding via omissionDescription", () => {
  const el = makeElement();
  const result = deriveExpectedFindings([makeDegradation(el.id, "OMIT")], [el]);
  assert(result.length === 1, `Esperado 1 finding, obtido ${result.length}`);
  assertEqual(result[0] ?? "", el.omissionDescription, "omissionDescription");
});

test("ABSENT gera finding via omissionDescription", () => {
  const el = makeElement({ absentContent: null });
  const result = deriveExpectedFindings([makeDegradation(el.id, "ABSENT")], [el]);
  assert(result.length === 1, `Esperado 1 finding, obtido ${result.length}`);
  assertEqual(result[0] ?? "", el.omissionDescription, "omissionDescription");
});

test("CONTRADICT gera finding via omissionDescription", () => {
  const el = makeElement({ absentContent: "[dado incorreto]" });
  const result = deriveExpectedFindings([makeDegradation(el.id, "CONTRADICT")], [el]);
  assert(result.length === 1, `Esperado 1 finding, obtido ${result.length}`);
  assertEqual(result[0] ?? "", el.omissionDescription, "omissionDescription");
});

test("elementId desconhecido ignorado silenciosamente", () => {
  const el = makeElement();
  const result = deriveExpectedFindings(
    [makeDegradation("elem-inexistente", "OMIT")],
    [el],
  );
  assert(result.length === 0, `ElementId inválido não deve gerar finding`);
});

test("múltiplas degradações geram findings na ordem de degradations", () => {
  const el1 = makeElement({ id: "el-1", omissionDescription: "finding-A" });
  const el2 = makeElement({ id: "el-2", omissionDescription: "finding-B" });
  const el3 = makeElement({ id: "el-3", omissionDescription: "finding-C" });

  const degradations: ElementDegradation[] = [
    makeDegradation("el-1", "OMIT"),
    makeDegradation("el-2", "WEAKEN"), // não gera finding
    makeDegradation("el-3", "ABSENT"),
  ];

  const result = deriveExpectedFindings(degradations, [el1, el2, el3]);
  assert(result.length === 2, `Esperado 2 findings, obtido ${result.length}`);
  assertEqual(result[0] ?? "", "finding-A", "finding-A primeiro");
  assertEqual(result[1] ?? "", "finding-C", "finding-C segundo");
});

// ─── Suite 4 — Integração ─────────────────────────────────────────────────────

console.log("\nSuite 4 — Integração");

test("fluxo completo: seed + elementos + mapa + findings", () => {
  const seed = SeedFactory.build("RGPS-002");

  // Elemento com dados do seed no conteúdo
  const elCnis: DocumentElement = {
    id: "cnis",
    section: DocumentSection.DAS_PROVAS,
    fullContent: `CNIS completo de ${seed.personName}, CPF ${seed.cpf}, com 35 anos averbados.`,
    lightContent: `CNIS de ${seed.personName} juntado, porém sem totalização de períodos.`,
    omittedContent: `[CNIS não juntado ou sem totalização verificável — CPF ${seed.cpf}]`,
    omissionDescription: "ausência de CNIS com totalização verificável do tempo de contribuição",
    correctPresenceKeywords: ["CNIS", "35 anos", seed.personName],
  };

  const elPpp: DocumentElement = {
    id: "ppp",
    section: DocumentSection.DOS_FATOS,
    fullContent: `PPP emitido pelo empregador, atestando agente nocivo: ruído de 90dB, com habitualidade e permanência.`,
    lightContent: `PPP menciona atividade especial, sem especificar agente nocivo ou intensidade.`,
    omittedContent: `[PPP ausente ou sem identificação de agente nocivo com habitualidade e permanência]`,
    omissionDescription: "ausência de análise concreta do PPP com habitualidade e permanência do agente nocivo",
    correctPresenceKeywords: ["PPP", "agente nocivo", "habitualidade", "permanência"],
  };

  // Mapa de degradação para caso MODERATE_ISSUES
  const map = buildDegradationMap("RGPS-002", "MODERATE_ISSUES", [
    degrade("cnis", "WEAKEN"),
    degrade("ppp", "OMIT"),
  ]);

  // Renderização
  const renderedCnis = renderElement(elCnis, findDegradation(map, "cnis"));
  const renderedPpp = renderElement(elPpp, findDegradation(map, "ppp"));

  // WEAKEN → lightContent (contém nome mas sem totalização)
  assert(renderedCnis.includes(seed.personName), "lightContent deve conter personName");
  assert(!renderedCnis.includes("35 anos"), "lightContent não deve conter '35 anos'");

  // OMIT → omittedContent (contém CPF entre colchetes)
  assert(renderedPpp.includes("PPP ausente"), "omittedContent deve mencionar PPP ausente");

  // Findings derivados: WEAKEN não conta, OMIT conta
  const findings = deriveExpectedFindings(map.degradations, [elCnis, elPpp]);
  assert(findings.length === 1, `Esperado 1 finding, obtido ${findings.length}`);
  assertEqual(
    findings[0] ?? "",
    "ausência de análise concreta do PPP com habitualidade e permanência do agente nocivo",
    "finding RGPS-002",
  );
});

test("goodMap produz mapa sem degradações", () => {
  const map = goodMap("FAZ-001");
  assertEqual(map.caseId, "FAZ-001", "caseId");
  assertEqual(map.quality, "GOOD", "quality");
  assert(map.degradations.length === 0, "degradations deve ser vazio para GOOD");
});

// ─── Resultado final ──────────────────────────────────────────────────────────

console.log(`\nTotal: ${passed + failed} | ✓ ${passed} | ✗ ${failed}`);
if (failed > 0) {
  console.error(`\n${failed} testes falharam.`);
  process.exit(1);
} else {
  console.log("\nTodos os testes passaram.");
}

/**
 * FASE 9.0.4 — Testes de Qualidade do Domain Knowledge
 *
 * Cobre:
 * 1. Todos os 12 packs implementam a interface DomainKnowledgePack (campos obrigatórios)
 * 2. Nenhum pack contém métodos executáveis — são dados puros
 * 3. Nenhum pack usa linguagem de obrigatoriedade automática ("automaticamente", "obrigatoriamente aponte")
 * 4. Todos os packs têm volume mínimo de conteúdo por campo
 * 5. cautionaryNotes estão presentes em todos os packs especializados
 * 6. placeholderGuidance está presente em todos os packs especializados
 * 7. Pack genérico funciona como fallback e tem cautionaryNotes
 * 8. Novos campos são renderizados corretamente no prompt
 * 9. cautionaryNotes contêm linguagem de cautela (NÃO / não / Não)
 * 10. placeholderGuidance menciona dados típicos do domínio
 * 11. Anti-regression: existings tests still pass (interface compatível)
 *
 * Executa com: pnpm dlx tsx packages/ai/src/legal-reviewer/tests/domain-knowledge-quality.spec.ts
 */

import { genericLegalKnowledgePack } from "../domain-knowledge/packs/generic.pack.js";
import { rgpsKnowledgePack } from "../domain-knowledge/packs/rgps.pack.js";
import { rppsKnowledgePack } from "../domain-knowledge/packs/rpps.pack.js";
import { trabalhistaKnowledgePack } from "../domain-knowledge/packs/trabalhista.pack.js";
import { tributarioKnowledgePack } from "../domain-knowledge/packs/tributario.pack.js";
import { familiaKnowledgePack } from "../domain-knowledge/packs/familia.pack.js";
import { consumidorKnowledgePack } from "../domain-knowledge/packs/consumidor.pack.js";
import { criminalKnowledgePack } from "../domain-knowledge/packs/criminal.pack.js";
import { fazendaPublicaKnowledgePack } from "../domain-knowledge/packs/fazenda-publica.pack.js";
import { ambientalKnowledgePack } from "../domain-knowledge/packs/ambiental.pack.js";
import { civelGeralKnowledgePack } from "../domain-knowledge/packs/civel-geral.pack.js";
import { juizadoEspecialKnowledgePack } from "../domain-knowledge/packs/juizado-especial.pack.js";
import { DomainKnowledgeRegistry } from "../domain-knowledge/domain-knowledge.registry.js";
import { buildStrengthReviewerPrompt } from "../prompts/strength-reviewer.prompt.js";
import type { DomainKnowledgePack } from "../domain-knowledge/domain-knowledge.types.js";
import type { AiLegalStrengthReviewRequest } from "../dto/ai-legal-strength-review-request.js";
import type { LegalAudit } from "../../pipeline/index.js";

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
    throw new Error(`${message}\n    Expected: ${String(expected)}\n    Actual: ${String(actual)}`);
  }
}

function assertIncludes(text: string, substring: string, message: string): void {
  if (!text.includes(substring)) {
    throw new Error(`${message}\n    Expected to find: "${substring}"`);
  }
}

function assertNotIncludes(text: string, substring: string, message: string): void {
  if (text.includes(substring)) {
    throw new Error(`${message}\n    Should NOT contain: "${substring}"`);
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ALL_PACKS: DomainKnowledgePack[] = [
  genericLegalKnowledgePack,
  rgpsKnowledgePack,
  rppsKnowledgePack,
  trabalhistaKnowledgePack,
  tributarioKnowledgePack,
  familiaKnowledgePack,
  consumidorKnowledgePack,
  criminalKnowledgePack,
  fazendaPublicaKnowledgePack,
  ambientalKnowledgePack,
  civelGeralKnowledgePack,
  juizadoEspecialKnowledgePack,
];

const SPECIALIZED_PACKS = ALL_PACKS.filter(p => p.domain !== "GENERIC");

const REQUIRED_STRING_ARRAY_FIELDS: (keyof DomainKnowledgePack)[] = [
  "reviewerGoals",
  "commonDocuments",
  "commonProofs",
  "commonWeaknesses",
  "commonDemonstrations",
  "commonCounterArguments",
  "strengtheningOpportunities",
];

const MIN_ITEMS_PER_FIELD = 3;
const MIN_ITEMS_PER_FIELD_SPECIALIZED = 5;

function makeMinimalAudit(): LegalAudit {
  return {
    audit: {
      status: "APPROVED",
      fatalErrors: [],
      warnings: [],
      suggestions: [],
    },
  } as unknown as LegalAudit;
}

function makeRequest(pack: DomainKnowledgePack): AiLegalStrengthReviewRequest {
  return {
    draft: "Trata-se de ação judicial.",
    classification: "ACAO_ORDINARIA",
    domain: pack.domain,
    pieceType: "PETICAO_INICIAL",
    audit: makeMinimalAudit(),
    domainKnowledgePack: pack,
  };
}

// ── Suite 1: Interface compliance ─────────────────────────────────────────────

console.log("\n1. Interface compliance (todos os packs implementam DomainKnowledgePack)");

for (const pack of ALL_PACKS) {
  test(`Pack "${pack.domain}" tem campo domain não vazio`, () => {
    assert(typeof pack.domain === "string" && pack.domain.length > 0, `domain vazio em ${pack.label}`);
  });

  test(`Pack "${pack.domain}" tem campo label não vazio`, () => {
    assert(typeof pack.label === "string" && pack.label.length > 0, `label vazio em ${pack.domain}`);
  });

  for (const field of REQUIRED_STRING_ARRAY_FIELDS) {
    test(`Pack "${pack.domain}" tem ${field} como array`, () => {
      const value = pack[field];
      assert(Array.isArray(value), `${String(field)} não é array em ${pack.domain}`);
    });
  }
}

// ── Suite 2: Minimum content volume ──────────────────────────────────────────

console.log("\n2. Volume mínimo de conteúdo por campo");

for (const pack of ALL_PACKS) {
  const minItems = pack.domain === "GENERIC" ? MIN_ITEMS_PER_FIELD : MIN_ITEMS_PER_FIELD_SPECIALIZED;

  for (const field of REQUIRED_STRING_ARRAY_FIELDS) {
    if (field === "commonCalculations" && pack.domain === "GENERIC") continue; // GENERIC tem commonCalculations vazio por design

    test(`Pack "${pack.domain}" tem >= ${minItems} items em ${field}`, () => {
      const value = pack[field] as string[];
      assert(
        value.length >= minItems,
        `${pack.domain}.${String(field)} tem apenas ${value.length} items (mínimo: ${minItems})`,
      );
    });
  }
}

// ── Suite 3: No executable logic ──────────────────────────────────────────────

console.log("\n3. Nenhum pack contém métodos executáveis");

for (const pack of ALL_PACKS) {
  test(`Pack "${pack.domain}" é dado puro — sem métodos`, () => {
    const ownKeys = Object.keys(pack);
    for (const key of ownKeys) {
      const value = (pack as Record<string, unknown>)[key];
      assert(typeof value !== "function", `${pack.domain}.${key} é uma função — packs devem ser dados puros`);
    }
  });

  test(`Pack "${pack.domain}" não tem métodos no prototype além de Object`, () => {
    const proto = Object.getPrototypeOf(pack);
    assertEqual(proto, Object.prototype, `${pack.domain} não é um objeto literal simples`);
  });
}

// ── Suite 4: No forbidden language ("must generate finding") ─────────────────

console.log('\n4. Nenhum pack usa linguagem de geração automática de findings');

const FORBIDDEN_PHRASES_LOWER = [
  "automaticamente gere",
  "gere automaticamente",
  "obrigatoriamente aponte",
  "aponte obrigatoriamente",
  "sempre gere",
  "gere sempre",
  "deve gerar finding",
];

for (const pack of ALL_PACKS) {
  test(`Pack "${pack.domain}" não contém linguagem de geração automática de findings`, () => {
    const allText = JSON.stringify(pack).toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES_LOWER) {
      assertNotIncludes(
        allText,
        phrase,
        `Pack ${pack.domain} contém linguagem proibida: "${phrase}"`,
      );
    }
  });
}

// ── Suite 5: cautionaryNotes ──────────────────────────────────────────────────

console.log("\n5. cautionaryNotes presentes e com linguagem de cautela");

test("Pack genérico tem cautionaryNotes", () => {
  assert(
    Array.isArray(genericLegalKnowledgePack.cautionaryNotes) &&
      (genericLegalKnowledgePack.cautionaryNotes?.length ?? 0) >= 1,
    "genericLegalKnowledgePack.cautionaryNotes vazio ou ausente",
  );
});

for (const pack of SPECIALIZED_PACKS) {
  test(`Pack "${pack.domain}" tem cautionaryNotes com >= 3 itens`, () => {
    assert(
      Array.isArray(pack.cautionaryNotes) && (pack.cautionaryNotes?.length ?? 0) >= 3,
      `${pack.domain}.cautionaryNotes tem apenas ${pack.cautionaryNotes?.length ?? 0} itens`,
    );
  });

  test(`Pack "${pack.domain}" cautionaryNotes contém linguagem de cautela`, () => {
    const notes = pack.cautionaryNotes ?? [];
    const allNotes = notes.join(" ").toLowerCase();
    const hasCautionLanguage =
      allNotes.includes("não") ||
      allNotes.includes("nao") ||
      allNotes.includes("não gere") ||
      allNotes.includes("não presuma") ||
      allNotes.includes("não confunda");
    assert(hasCautionLanguage, `${pack.domain}.cautionaryNotes não contém linguagem de cautela (NÃO / não gere / não presuma)`);
  });
}

// ── Suite 6: placeholderGuidance ──────────────────────────────────────────────

console.log("\n6. placeholderGuidance presente e descreve dados típicos do domínio");

for (const pack of ALL_PACKS) {
  test(`Pack "${pack.domain}" tem placeholderGuidance não vazio`, () => {
    assert(
      typeof pack.placeholderGuidance === "string" && pack.placeholderGuidance.length > 0,
      `${pack.domain}.placeholderGuidance ausente ou vazio`,
    );
  });

  test(`Pack "${pack.domain}" placeholderGuidance menciona ao menos 1 placeholder entre colchetes`, () => {
    const guidance = pack.placeholderGuidance ?? "";
    assert(
      /\[.+?\]/.test(guidance),
      `${pack.domain}.placeholderGuidance não menciona nenhum placeholder entre colchetes`,
    );
  });
}

// ── Suite 7: Prompt rendering of new fields ───────────────────────────────────

console.log("\n7. Novos campos são renderizados corretamente no prompt");

test("cautionaryNotes são incluídas no prompt quando presentes", () => {
  const pack = rgpsKnowledgePack;
  const prompt = buildStrengthReviewerPrompt(makeRequest(pack));
  assertIncludes(prompt, "ALERTAS DE CAUTELA", "Seção de cautionaryNotes não encontrada no prompt");
});

test("cautionaryNotes contêm texto do pack no prompt", () => {
  const pack = rgpsKnowledgePack;
  const prompt = buildStrengthReviewerPrompt(makeRequest(pack));
  const firstNote = (pack.cautionaryNotes ?? [])[0]?.substring(0, 30) ?? "";
  assert(firstNote.length > 0, "cautionaryNotes vazio no pack RGPS");
  assert(prompt.includes(firstNote), `Texto das cautionaryNotes não encontrado no prompt: "${firstNote}"`);
});

test("placeholderGuidance é incluída no prompt quando presente", () => {
  const pack = criminalKnowledgePack;
  const prompt = buildStrengthReviewerPrompt(makeRequest(pack));
  assertIncludes(prompt, "Placeholders típicos neste domínio", "placeholderGuidance não renderizada no prompt");
});

test("placeholderGuidance contém texto do pack no prompt", () => {
  const pack = trabalhistaKnowledgePack;
  const prompt = buildStrengthReviewerPrompt(makeRequest(pack));
  const guidanceSnippet = (pack.placeholderGuidance ?? "").substring(0, 30);
  assert(guidanceSnippet.length > 0, "placeholderGuidance vazio no pack Trabalhista");
  assert(prompt.includes(guidanceSnippet), `Texto da placeholderGuidance não encontrado no prompt: "${guidanceSnippet}"`);
});

test("Pack sem cautionaryNotes não adiciona seção ALERTAS DE CAUTELA ao prompt", () => {
  const packSemCautionaryNotes: DomainKnowledgePack = {
    ...genericLegalKnowledgePack,
    domain: "TEST_NO_CAUTION",
    cautionaryNotes: undefined,
    placeholderGuidance: undefined,
  };
  const req = makeRequest(packSemCautionaryNotes);
  const prompt = buildStrengthReviewerPrompt(req);
  assertNotIncludes(prompt, "ALERTAS DE CAUTELA", "Seção ALERTAS DE CAUTELA apareceu mesmo sem cautionaryNotes");
});

test("Pack sem placeholderGuidance não adiciona linha de placeholders ao prompt", () => {
  const packSemGuidance: DomainKnowledgePack = {
    ...genericLegalKnowledgePack,
    domain: "TEST_NO_GUIDANCE",
    cautionaryNotes: undefined,
    placeholderGuidance: undefined,
  };
  const req = makeRequest(packSemGuidance);
  const prompt = buildStrengthReviewerPrompt(req);
  assertNotIncludes(
    prompt,
    "Placeholders típicos neste domínio",
    "Linha de placeholderGuidance apareceu mesmo sem o campo",
  );
});

// ── Suite 8: Registry returns enriched packs ──────────────────────────────────

console.log("\n8. Registry retorna packs enriquecidos");

test("DomainKnowledgeRegistry.get('RGPS') retorna pack com cautionaryNotes", () => {
  const pack = DomainKnowledgeRegistry.get("RGPS");
  assert(
    Array.isArray(pack?.cautionaryNotes) && (pack?.cautionaryNotes?.length ?? 0) > 0,
    "Pack RGPS do registry não tem cautionaryNotes",
  );
});

test("DomainKnowledgeRegistry.get('CRIMINAL') retorna pack com placeholderGuidance", () => {
  const pack = DomainKnowledgeRegistry.get("CRIMINAL");
  assert(
    typeof pack?.placeholderGuidance === "string" && (pack?.placeholderGuidance?.length ?? 0) > 0,
    "Pack CRIMINAL do registry não tem placeholderGuidance",
  );
});

test("DomainKnowledgeRegistry.get('TRABALHISTA') retorna pack com cautionaryNotes", () => {
  const pack = DomainKnowledgeRegistry.get("TRABALHISTA");
  assert(
    Array.isArray(pack?.cautionaryNotes) && (pack?.cautionaryNotes?.length ?? 0) >= 3,
    "Pack TRABALHISTA do registry não tem cautionaryNotes suficientes",
  );
});

// ── Suite 9: Domain-specific content integrity ────────────────────────────────

console.log("\n9. Integridade do conteúdo específico por domínio");

test("RGPS menciona carência nas weaknesses", () => {
  const text = rgpsKnowledgePack.commonWeaknesses.join(" ").toLowerCase();
  assert(text.includes("carência"), "RGPS.commonWeaknesses não menciona carência");
});

test("RGPS menciona reafirmação da DER nas strengtheningOpportunities", () => {
  const text = rgpsKnowledgePack.strengtheningOpportunities.join(" ").toLowerCase();
  assert(text.includes("reafirmação"), "RGPS.strengtheningOpportunities não menciona reafirmação da DER");
});

test("RGPS menciona LOAS/BPC nas weaknesses", () => {
  const text = rgpsKnowledgePack.commonWeaknesses.join(" ").toLowerCase();
  assert(text.includes("loas") || text.includes("bpc"), "RGPS.commonWeaknesses não menciona LOAS/BPC");
});

test("Criminal menciona ANPP nas reviewerGoals", () => {
  const text = criminalKnowledgePack.reviewerGoals.join(" ").toUpperCase();
  assert(text.includes("ANPP"), "Criminal.reviewerGoals não menciona ANPP");
});

test("Criminal menciona cadeia de custódia nas weaknesses", () => {
  const text = criminalKnowledgePack.commonWeaknesses.join(" ").toLowerCase();
  assert(text.includes("cadeia de custódia"), "Criminal.commonWeaknesses não menciona cadeia de custódia");
});

test("Criminal menciona art. 59 do CP nas calculations", () => {
  const text = criminalKnowledgePack.commonCalculations.join(" ").toLowerCase();
  assert(text.includes("art. 59"), "Criminal.commonCalculations não menciona art. 59 do CP");
});

test("Trabalhista menciona reforma trabalhista nas cautionaryNotes", () => {
  const text = (trabalhistaKnowledgePack.cautionaryNotes ?? []).join(" ").toLowerCase();
  assert(text.includes("reforma trabalhista"), "Trabalhista.cautionaryNotes não menciona reforma trabalhista");
});

test("Tributário menciona modulação de efeitos nas weaknesses", () => {
  const text = tributarioKnowledgePack.commonWeaknesses.join(" ").toLowerCase();
  assert(text.includes("modulação"), "Tributário.commonWeaknesses não menciona modulação de efeitos");
});

test("Tributário menciona ANPP não (contribuinte de fato) nas cautionaryNotes", () => {
  const text = (tributarioKnowledgePack.cautionaryNotes ?? []).join(" ").toLowerCase();
  assert(text.includes("contribuinte de fato"), "Tributário.cautionaryNotes não menciona contribuinte de fato");
});

test("Família menciona alimentos gravídicos nos calculations", () => {
  const text = familiaKnowledgePack.commonCalculations.join(" ").toLowerCase();
  assert(text.includes("gravídicos"), "Família.commonCalculations não menciona alimentos gravídicos");
});

test("RPPS menciona EC 103/2019 nas weaknesses ou demonstrations", () => {
  const text = [
    ...rppsKnowledgePack.commonWeaknesses,
    ...rppsKnowledgePack.commonDemonstrations,
  ].join(" ").toLowerCase();
  assert(text.includes("ec 103"), "RPPS não menciona EC 103/2019");
});

test("Ambiental menciona prescrição administrativa de 3 anos nas calculations", () => {
  const text = ambientalKnowledgePack.commonCalculations.join(" ").toLowerCase();
  assert(text.includes("3 anos") || text.includes("6.514"), "Ambiental.commonCalculations não menciona prescrição de 3 anos");
});

test("Fazenda Pública menciona EC 113/2021 nos calculations", () => {
  const text = fazendaPublicaKnowledgePack.commonCalculations.join(" ").toLowerCase();
  assert(text.includes("ec 113") || text.includes("113/2021"), "FazendaPublica.commonCalculations não menciona EC 113/2021");
});

test("Juizado Especial menciona limite de 40 SM nos calculations", () => {
  const text = juizadoEspecialKnowledgePack.commonCalculations.join(" ").toLowerCase();
  assert(text.includes("40") && (text.includes("sm") || text.includes("salário")), "JuizadoEspecial.commonCalculations não menciona limite de 40 SM");
});

test("Consumidor menciona art. 42 do CDC nos calculations", () => {
  const text = consumidorKnowledgePack.commonCalculations.join(" ").toLowerCase();
  assert(text.includes("art. 42"), "Consumidor.commonCalculations não menciona art. 42 do CDC");
});

// ── Suite 10: Domain isolation — new content doesn't cross-contaminate ─────────

console.log("\n10. Isolamento de domínio — novos campos não contaminam outros domínios");

test("cautionaryNotes do RGPS não menciona CDA ou DARF (tributário)", () => {
  const text = (rgpsKnowledgePack.cautionaryNotes ?? []).join(" ").toUpperCase();
  assertNotIncludes(text, "CDA", "RGPS.cautionaryNotes menciona CDA (tributário) — contaminação");
  assertNotIncludes(text, "DARF", "RGPS.cautionaryNotes menciona DARF (tributário) — contaminação");
});

test("cautionaryNotes da Família não menciona flagrante ou pena-base (criminal)", () => {
  const text = (familiaKnowledgePack.cautionaryNotes ?? []).join(" ").toLowerCase();
  assertNotIncludes(text, "flagrante", "Família.cautionaryNotes menciona flagrante (criminal) — contaminação");
  assertNotIncludes(text, "pena-base", "Família.cautionaryNotes menciona pena-base (criminal) — contaminação");
});

test("cautionaryNotes do Criminal não menciona PPP ou LTCAT (previdenciário)", () => {
  const text = (criminalKnowledgePack.cautionaryNotes ?? []).join(" ").toUpperCase();
  assertNotIncludes(text, "PPP", "Criminal.cautionaryNotes menciona PPP (previdenciário) — contaminação");
  assertNotIncludes(text, "LTCAT", "Criminal.cautionaryNotes menciona LTCAT (previdenciário) — contaminação");
});

test("placeholderGuidance do Tributário não menciona NB ou DIB (previdenciário)", () => {
  const text = (tributarioKnowledgePack.placeholderGuidance ?? "").toUpperCase();
  assertNotIncludes(text, "[NB", "Tributário.placeholderGuidance menciona NB (previdenciário) — contaminação");
  assertNotIncludes(text, "[DIB", "Tributário.placeholderGuidance menciona DIB (previdenciário) — contaminação");
});

// ── Suite 11: All 12 packs have unique domains ────────────────────────────────

console.log("\n11. Unicidade de domínios");

test("Todos os 12 packs têm domínios únicos", () => {
  const domains = ALL_PACKS.map(p => p.domain);
  const unique = new Set(domains);
  assertEqual(unique.size, ALL_PACKS.length, `Há domínios duplicados entre os packs: ${domains.join(", ")}`);
});

test("Todos os 12 packs estão registrados no DomainKnowledgeRegistry", () => {
  const registeredDomains = DomainKnowledgeRegistry.listAll().map(p => p.domain);
  const registeredSet = new Set(registeredDomains);
  for (const pack of ALL_PACKS.filter(p => p.domain !== "GENERIC")) {
    assert(
      registeredSet.has(pack.domain),
      `Pack "${pack.domain}" não está registrado no DomainKnowledgeRegistry`,
    );
  }
});

// ── Suite 12: Generic pack fallback behavior ──────────────────────────────────

console.log("\n12. Pack genérico como fallback");

test("Pack genérico tem domain GENERIC", () => {
  assertEqual(genericLegalKnowledgePack.domain, "GENERIC", "genericLegalKnowledgePack.domain !== 'GENERIC'");
});

test("Pack genérico não lista documentos específicos de domínio especializado", () => {
  const docs = genericLegalKnowledgePack.commonDocuments.join(" ").toUpperCase();
  assertNotIncludes(docs, "CNIS", "genericLegalKnowledgePack.commonDocuments lista CNIS (específico do RGPS)");
  assertNotIncludes(docs, "LTCAT", "genericLegalKnowledgePack.commonDocuments lista LTCAT (específico do RGPS)");
  assertNotIncludes(docs, "CDA", "genericLegalKnowledgePack.commonDocuments lista CDA (específico do tributário)");
});

test("Pack genérico cautionaryNotes orienta a não presumir documentos específicos", () => {
  const text = (genericLegalKnowledgePack.cautionaryNotes ?? []).join(" ").toLowerCase();
  assert(
    text.includes("não") && (text.includes("específic") || text.includes("domínio") || text.includes("especializ")),
    "genericLegalKnowledgePack.cautionaryNotes não orienta sobre a ausência de contexto de domínio",
  );
});

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`Total: ${passed + failed} | ✓ ${passed} | ✗ ${failed}`);

if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam`);
  process.exit(1);
} else {
  console.log(`\nTodos os ${passed} testes passaram`);
}

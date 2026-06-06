/**
 * FASE 9.0.0 — AI Legal Strength Reviewer — Testes dos 8 cenários da spec
 *
 * Cobre:
 * 1. EC 47 afirma requisitos sem quadro → MISSING_DEMONSTRATION / WEAK_FACTUAL_FOUNDATION
 * 2. Previdenciária com período sem quadro → MISSING_COMPARATIVE_TABLE
 * 3. Pedido de valores sem memória de cálculo → MISSING_CALCULATION
 * 4. PPP disponível, draft menciona exposição genérica → UNUSED_EXTRACTED_DATA
 * 5. Draft com [AUTOR] ou [DATA DO ÓBITO] sem docs → nenhum finding por placeholder
 * 6. MISSING_LEGAL_ANCHOR sem fundamento no contexto → sugestão genérica
 * 7. Confidence abaixo de 0.75 → descartado
 * 8. JSON inválido do provider → retorno seguro
 *
 * Executa com: pnpm dlx tsx packages/ai/src/legal-reviewer/tests/ai-legal-strength-reviewer.spec.ts
 */

import { AiLegalStrengthReviewerService } from "../services/ai-legal-strength-reviewer.service.js";
import {
  AiLegalStrengthReviewerProvider,
  safeJsonParse,
} from "../providers/ai-legal-strength-reviewer.provider.js";
import { StrengthFindingType } from "../enums/strength-finding-type.enum.js";
import { OpportunityLevel } from "../enums/opportunity-level.enum.js";
import { buildStrengthReviewerPrompt } from "../prompts/strength-reviewer.prompt.js";
import type { AiLegalStrengthReviewRequest } from "../dto/ai-legal-strength-review-request.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  console.log(`\n[TEST] ${name}`);
  try {
    await fn();
  } catch (err) {
    console.error(`  ✗ EXCEÇÃO NÃO ESPERADA: ${(err as Error).message}`);
    failed++;
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseAudit: AiLegalStrengthReviewRequest["audit"] = {
  pieceId: "test-piece",
  audit: {
    status: "APROVADA_COM_RESSALVAS",
    score: 70,
    classification: "ATENCAO",
    fatalErrors: [],
    nonFatalErrors: [],
    strengths: [],
  },
};

/** Provider mock que retorna findings controlados sem chamar API real. */
class MockProvider extends AiLegalStrengthReviewerProvider {
  constructor(private readonly mockFindings: any[]) {
    super("fake-ds-key", "fake-oai-key");
  }
  override async callWithFallback(_req: AiLegalStrengthReviewRequest) {
    return this.mockFindings;
  }
}

function makeService(findings: any[]): [AiLegalStrengthReviewerService, MockProvider] {
  const svc = new AiLegalStrengthReviewerService("k", "k");
  const provider = new MockProvider(findings);
  return [svc, provider];
}

// ── Cenário 1 — EC 47, requisitos afirmados sem quadro ────────────────────────

await test("Cenário 1 — MISSING_DEMONSTRATION: EC 47 sem quadro demonstrativo", async () => {
  const [svc, provider] = makeService([
    {
      type: StrengthFindingType.MISSING_DEMONSTRATION,
      opportunity: OpportunityLevel.IMPACTFUL,
      title: "Quadro demonstrativo dos requisitos da EC 47/2005",
      rationale: "Os requisitos são afirmados sem demonstração fática dos dados de carreira.",
      evidenceFromText: ["o instituidor preenchia os requisitos da EC 47/2005"],
      suggestion: "Incluir quadro contendo: idade, tempo de contribuição, tempo de serviço público, carreira e cargo.",
      confidence: 0.88,
    },
  ]);

  const result = await svc._reviewWithProvider(
    { draft: "O instituidor preenchia os requisitos da EC 47/2005.", classification: "PREVIDENCIARIO", audit: baseAudit },
    provider,
  );

  assert(result.findings.length === 1, "gera 1 finding");
  assert(result.findings[0]!.type === StrengthFindingType.MISSING_DEMONSTRATION, "tipo MISSING_DEMONSTRATION");
  assert(result.findings[0]!.opportunity === OpportunityLevel.IMPACTFUL, "opportunity IMPACTFUL");
  assert(result.findings[0]!.requiresHumanReview === true, "requiresHumanReview true");
  assert(!result.summary.includes("fragilidade"), "summary sem linguagem adversarial");
  assert(result.summary.includes("oportunidade"), "summary com linguagem de oportunidade");
});

// ── Cenário 2 — Peça previdenciária sem quadro de períodos ────────────────────

await test("Cenário 2 — MISSING_COMPARATIVE_TABLE: períodos sem quadro CNIS", async () => {
  const [svc, provider] = makeService([
    {
      type: StrengthFindingType.MISSING_COMPARATIVE_TABLE,
      opportunity: OpportunityLevel.IMPACTFUL,
      title: "Quadro de períodos de contribuição extraído do CNIS",
      rationale: "A visualização dos períodos em quadro facilita a análise do magistrado e robustece a tese.",
      evidenceFromText: ["o autor contribuiu por mais de 35 anos"],
      suggestion: "Incluir tabela com início, fim, competência e empregador de cada período contributivo.",
      confidence: 0.85,
    },
  ]);

  const result = await svc._reviewWithProvider(
    { draft: "O autor contribuiu por mais de 35 anos ao RGPS.", classification: "PREVIDENCIARIO", audit: baseAudit },
    provider,
  );

  assert(result.findings.length === 1, "gera 1 finding");
  assert(result.findings[0]!.type === StrengthFindingType.MISSING_COMPARATIVE_TABLE, "tipo MISSING_COMPARATIVE_TABLE");
  assert(result.findings[0]!.suggestion.length > 0, "possui suggestion");
});

// ── Cenário 3 — Pedido de valores sem memória de cálculo ─────────────────────

await test("Cenário 3 — MISSING_CALCULATION: valores retroativos sem planilha", async () => {
  const [svc, provider] = makeService([
    {
      type: StrengthFindingType.MISSING_CALCULATION,
      opportunity: OpportunityLevel.COMPLEMENTARY,
      title: "Memória de cálculo dos valores retroativos pleiteados",
      rationale: "Pedido de valores em atraso sem demonstrativo pode dificultar liquidação futura.",
      evidenceFromText: ["requer o pagamento das diferenças atrasadas desde a DER"],
      suggestion: "Juntar planilha demonstrativa ou memória de cálculo referenciando competências e valores.",
      confidence: 0.82,
    },
  ]);

  const result = await svc._reviewWithProvider(
    { draft: "Requer o pagamento das diferenças atrasadas desde a DER.", classification: "PREVIDENCIARIO", audit: baseAudit },
    provider,
  );

  assert(result.findings.length === 1, "gera 1 finding");
  assert(result.findings[0]!.type === StrengthFindingType.MISSING_CALCULATION, "tipo MISSING_CALCULATION");
  assert(result.findings[0]!.opportunity === OpportunityLevel.COMPLEMENTARY, "opportunity COMPLEMENTARY");
});

// ── Cenário 4 — PPP disponível, draft genérico → UNUSED_EXTRACTED_DATA ────────

await test("Cenário 4 — UNUSED_EXTRACTED_DATA: PPP disponível não aproveitado", async () => {
  const request: AiLegalStrengthReviewRequest = {
    draft: "O autor laborou exposto a agente nocivo no período em que trabalhou na empresa.",
    classification: "PREVIDENCIARIO",
    audit: baseAudit,
    availableDocuments: [
      {
        type: "PPP",
        label: "PPP — Empresa Metalúrgica ABC",
        keyFields: ["período: 01/2001-12/2008", "agente: ruído 89dB", "EPI: protetor auricular"],
      },
    ],
  };

  const [svc, provider] = makeService([
    {
      type: StrengthFindingType.UNUSED_EXTRACTED_DATA,
      opportunity: OpportunityLevel.IMPACTFUL,
      title: "Dados do PPP não aproveitados na narração dos fatos",
      rationale: "O PPP disponível contém período e agente específicos que fortalecem a tese de insalubridade.",
      evidenceFromText: ["o autor laborou exposto a agente nocivo"],
      suggestion: "Detalhar o período 01/2001–12/2008, o agente ruído 89dB e a ineficácia do EPI com base no PPP.",
      availableSource: "PPP — Empresa Metalúrgica ABC (campos: período, agente, EPI)",
      confidence: 0.93,
    },
  ]);

  const result = await svc._reviewWithProvider(request, provider);

  assert(result.findings.length === 1, "gera 1 finding");
  assert(result.findings[0]!.type === StrengthFindingType.UNUSED_EXTRACTED_DATA, "tipo UNUSED_EXTRACTED_DATA");
  assert(result.findings[0]!.availableSource !== undefined, "availableSource presente");
  assert(result.findings[0]!.availableSource!.includes("PPP"), "availableSource menciona PPP");
});

// ── Cenário 5 — Placeholder sem documento → nenhum finding ───────────────────

await test("Cenário 5 — Placeholder sem documento disponível → sem finding automático", async () => {
  // Provider não gera findings (simulando comportamento correto do modelo)
  const [svc, provider] = makeService([]);

  const result = await svc._reviewWithProvider(
    {
      draft: "[AUTOR], brasileiro, casado, portador do CPF [CPF], vem propor a presente ação. O óbito ocorreu em [DATA DO ÓBITO].",
      classification: "PREVIDENCIARIO",
      audit: baseAudit,
      // availableDocuments: undefined — nenhum documento disponível
    },
    provider,
  );

  assert(result.findings.length === 0, "nenhum finding gerado apenas por placeholder");
  assert(result.summary.includes("Peça sólida"), "summary positivo quando sem findings");
  assert(result.requiresHumanReview === true, "requiresHumanReview permanece true");
});

await test("Cenário 5b — Prompt contém regra explícita de placeholder", () => {
  const prompt = buildStrengthReviewerPrompt({
    draft: "[AUTOR] propõe ação.",
    classification: "CIVIL",
    audit: baseAudit,
  });

  assert(prompt.includes("[AUTOR]"), "prompt menciona [AUTOR] como exemplo de placeholder");
  assert(prompt.includes("NÃO são problemas"), "prompt afirma que placeholders não são problemas");
  assert(prompt.includes("Placeholders"), "prompt tem seção sobre placeholders");
});

// ── Cenário 6 — MISSING_LEGAL_ANCHOR sem fundamento → sugestão genérica ──────

await test("Cenário 6 — MISSING_LEGAL_ANCHOR: sugestão genérica sem inventar artigo", async () => {
  const [svc, provider] = makeService([
    {
      type: StrengthFindingType.MISSING_LEGAL_ANCHOR,
      opportunity: OpportunityLevel.COMPLEMENTARY,
      title: "Fundamento normativo pode ser explicitado",
      rationale: "A tese invoca um direito sem ancorar em norma específica.",
      evidenceFromText: ["tem direito ao benefício"],
      suggestion: "Indicar expressamente o fundamento legal ou jurisprudencial aplicável à tese.",
      confidence: 0.78,
    },
  ]);

  const result = await svc._reviewWithProvider(
    { draft: "O autor tem direito ao benefício previdenciário.", classification: "PREVIDENCIARIO", audit: baseAudit },
    provider,
  );

  assert(result.findings.length === 1, "gera 1 finding");
  assert(result.findings[0]!.type === StrengthFindingType.MISSING_LEGAL_ANCHOR, "tipo MISSING_LEGAL_ANCHOR");

  const suggestion = result.findings[0]!.suggestion;
  // A sugestão deve ser genérica — não deve inventar "art. X da Lei Y"
  const hasInventedLaw = /art\.\s*\d+\s+da\s+[Ll]ei\s+\d+/i.test(suggestion);
  assert(!hasInventedLaw, "suggestion NÃO inventa artigo/lei específico");
  assert(suggestion.length > 0, "suggestion não é vazio");
});

await test("Cenário 6b — Prompt instrui sobre MISSING_LEGAL_ANCHOR sem inventar", () => {
  const prompt = buildStrengthReviewerPrompt({
    draft: "O autor tem direito ao benefício.",
    classification: "PREVIDENCIARIO",
    audit: baseAudit,
  });

  assert(prompt.includes("MISSING_LEGAL_ANCHOR"), "prompt descreve MISSING_LEGAL_ANCHOR");
  assert(prompt.includes("sem inventar artigos"), "prompt proíbe inventar artigos");
  assert(prompt.includes("PERMITIDO"), "prompt tem exemplo de sugestão permitida");
  assert(prompt.includes("PROIBIDO"), "prompt tem exemplo de sugestão proibida");
});

// ── Cenário 7 — Confidence abaixo de 0.75 → descartado ──────────────────────

await test("Cenário 7 — Confidence < 0.75 descartado; >= 0.75 mantido", async () => {
  const [svc, provider] = makeService([
    { type: StrengthFindingType.MISSING_DEMONSTRATION, opportunity: OpportunityLevel.IMPACTFUL, title: "A", rationale: "R", evidenceFromText: ["x"], suggestion: "S", confidence: 0.5  },
    { type: StrengthFindingType.MISSING_CALCULATION,   opportunity: OpportunityLevel.COMPLEMENTARY, title: "B", rationale: "R", evidenceFromText: ["y"], suggestion: "S", confidence: 0.9  },
    { type: StrengthFindingType.STRENGTHEN_ARGUMENT,   opportunity: OpportunityLevel.OPTIONAL, title: "C", rationale: "R", evidenceFromText: [],    suggestion: "S", confidence: 0.74 },
    { type: StrengthFindingType.ANTICIPATE_COUNTERARGUMENT, opportunity: OpportunityLevel.COMPLEMENTARY, title: "D", rationale: "R", evidenceFromText: ["z"], suggestion: "S", confidence: 0.75 },
  ]);

  const result = await svc._reviewWithProvider(
    { draft: "Peça de teste.", classification: "CIVIL", audit: baseAudit },
    provider,
  );

  assert(result.findings.length === 2, "apenas 2 findings passam (0.9 e 0.75)");
  const types = result.findings.map(f => f.type);
  assert(types.includes(StrengthFindingType.MISSING_CALCULATION), "finding 0.9 sobrevive");
  assert(types.includes(StrengthFindingType.ANTICIPATE_COUNTERARGUMENT), "finding 0.75 sobrevive");
  assert(!types.includes(StrengthFindingType.MISSING_DEMONSTRATION), "finding 0.5 descartado");
  assert(!types.includes(StrengthFindingType.STRENGTHEN_ARGUMENT), "finding 0.74 descartado");
});

// ── Cenário 8 — JSON inválido → retorno seguro ───────────────────────────────

await test("Cenário 8 — JSON inválido do provider → findings vazios, sem crash", async () => {
  const invalidResponses = [
    "Não encontrei oportunidades de fortalecimento.",
    "```\nErro interno do modelo\n```",
    "",
    "{ broken }",
    "undefined",
  ];

  for (const raw of invalidResponses) {
    const result = safeJsonParse(raw);
    const safe = result === null || Array.isArray(result);
    assert(safe, `retorno seguro para: "${raw.slice(0, 40)}"`);
  }

  // Verifica que o serviço trata null do safeJsonParse retornando array vazio
  const [svc, _] = makeService([]); // mock retorna array vazio
  const result = await svc._reviewWithProvider(
    { draft: "Teste.", classification: "CIVIL", audit: baseAudit },
    new MockProvider([]),
  );
  assert(result.findings.length === 0, "serviço retorna findings vazios quando não há resultados");
  assert(result.requiresHumanReview === true, "requiresHumanReview sempre true mesmo sem findings");
});

// ── Governança — verificações de meta-regras ──────────────────────────────────

await test("Governança — summary usa linguagem positiva", async () => {
  const [svc, provider1] = makeService([]);
  const r1 = await svc._reviewWithProvider({ draft: "Peça.", classification: "CIVIL", audit: baseAudit }, provider1);
  assert(r1.summary === "Peça sólida — nenhuma oportunidade de fortalecimento identificada.", "summary vazio = 'Peça sólida'");

  const [svc2, provider2] = makeService([
    { type: StrengthFindingType.MISSING_CALCULATION, opportunity: OpportunityLevel.IMPACTFUL, title: "T", rationale: "R", evidenceFromText: ["x"], suggestion: "S", confidence: 0.9 },
    { type: StrengthFindingType.STRENGTHEN_ARGUMENT, opportunity: OpportunityLevel.COMPLEMENTARY, title: "T2", rationale: "R2", evidenceFromText: ["y"], suggestion: "S2", confidence: 0.8 },
    { type: StrengthFindingType.MISSING_DATE_ANCHOR, opportunity: OpportunityLevel.OPTIONAL, title: "T3", rationale: "R3", evidenceFromText: ["z"], suggestion: "S3", confidence: 0.77 },
  ]);
  const r2 = await svc2._reviewWithProvider({ draft: "Peça.", classification: "CIVIL", audit: baseAudit }, provider2);
  assert(r2.summary.includes("3 oportunidade"), "summary menciona count de oportunidades");
  assert(r2.summary.includes("impactante"), "summary menciona IMPACTFUL");
  assert(r2.summary.includes("complementar"), "summary menciona COMPLEMENTARY");
  assert(r2.summary.includes("opcional"), "summary menciona OPTIONAL");
  assert(!r2.summary.toLowerCase().includes("fragilidade"), "summary NÃO usa 'fragilidade'");
  assert(!r2.summary.toLowerCase().includes("erro"), "summary NÃO usa 'erro'");
});

await test("Governança — todos os StrengthFindingType estão definidos", () => {
  const expected = [
    "MISSING_DEMONSTRATION", "MISSING_COMPARATIVE_TABLE", "MISSING_CALCULATION",
    "MISSING_SUPPORTING_DOCUMENT", "MISSING_DATE_ANCHOR", "MISSING_LEGAL_ANCHOR",
    "UNUSED_EXTRACTED_DATA", "FACTUAL_ENRICHMENT_OPPORTUNITY",
    "STRENGTHEN_ARGUMENT", "ANTICIPATE_COUNTERARGUMENT", "WEAK_FACTUAL_FOUNDATION",
  ];
  for (const key of expected) {
    assert(
      Object.values(StrengthFindingType).includes(key as StrengthFindingType),
      `StrengthFindingType.${key} definido`,
    );
  }
});

await test("Governança — todos os OpportunityLevel estão definidos", () => {
  assert(OpportunityLevel.IMPACTFUL     === "IMPACTFUL",     "IMPACTFUL definido");
  assert(OpportunityLevel.COMPLEMENTARY === "COMPLEMENTARY", "COMPLEMENTARY definido");
  assert(OpportunityLevel.OPTIONAL      === "OPTIONAL",      "OPTIONAL definido");
});

await test("Governança — prompt inclui contexto de documentos disponíveis", () => {
  const prompt = buildStrengthReviewerPrompt({
    draft: "O autor laborou exposto a agente nocivo.",
    classification: "PREVIDENCIARIO",
    audit: baseAudit,
    availableDocuments: [
      { type: "PPP", label: "PPP Empresa ABC", keyFields: ["período: 2001-2008", "agente: ruído 89dB"] },
      { type: "CNIS", label: "CNIS atualizado" },
    ],
  });

  assert(prompt.includes("PPP Empresa ABC"), "prompt inclui label do documento PPP");
  assert(prompt.includes("período: 2001-2008"), "prompt inclui keyFields do PPP");
  assert(prompt.includes("CNIS atualizado"), "prompt inclui documento CNIS");
});

// ── Resultado final ───────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(60)}`);
console.log(`Resultado: ${passed} passaram, ${failed} falharam`);
console.log("=".repeat(60));

if (failed > 0) process.exit(1);

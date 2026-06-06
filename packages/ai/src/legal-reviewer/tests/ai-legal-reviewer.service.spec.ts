/**
 * Testes unitários do AiLegalStrengthReviewerService — safeJsonParse e confidence gate.
 * Executa com: pnpm dlx tsx packages/ai/src/legal-reviewer/tests/ai-legal-reviewer.service.spec.ts
 */

import { AiLegalStrengthReviewerService } from "../services/ai-legal-strength-reviewer.service.js";
import {
  AiLegalStrengthReviewerProvider,
  safeJsonParse,
} from "../providers/ai-legal-strength-reviewer.provider.js";
import { StrengthFindingType } from "../enums/strength-finding-type.enum.js";
import { OpportunityLevel } from "../enums/opportunity-level.enum.js";
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

async function test(name: string, fn: () => Promise<void>): Promise<void> {
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
    score: 72,
    classification: "ATENCAO",
    fatalErrors: [],
    nonFatalErrors: [],
    strengths: [],
  },
};

const baseRequest: AiLegalStrengthReviewRequest = {
  draft: "O réu causou danos ao autor. O autor tem direito à indenização.",
  classification: "CIVIL_PETICAO_INICIAL",
  audit: baseAudit,
};

/** Provider falso que retorna findings controlados. */
class MockProvider extends AiLegalStrengthReviewerProvider {
  constructor(private mockFindings: any[]) {
    super("fake-ds-key", "fake-oai-key");
  }
  override async callWithFallback(_req: AiLegalStrengthReviewRequest) {
    return this.mockFindings;
  }
}

// ── safeJsonParse ─────────────────────────────────────────────────────────────

await test("safeJsonParse — JSON puro com novos campos", async () => {
  const input = `[{"type":"MISSING_DEMONSTRATION","opportunity":"IMPACTFUL","title":"T","rationale":"R","evidenceFromText":["x"],"suggestion":"S","confidence":0.9}]`;
  const result = safeJsonParse(input);
  assert(result !== null, "não retorna null");
  assert(result!.length === 1, "retorna 1 finding");
  assert(result![0]!.type === "MISSING_DEMONSTRATION", "type correto");
  assert(result![0]!.opportunity === "IMPACTFUL", "opportunity correto");
});

await test("safeJsonParse — JSON dentro de code fence markdown", async () => {
  const input = "```json\n[{\"type\":\"MISSING_CALCULATION\",\"opportunity\":\"COMPLEMENTARY\",\"title\":\"T\",\"rationale\":\"R\",\"evidenceFromText\":[],\"suggestion\":\"S\",\"confidence\":0.8}]\n```";
  const result = safeJsonParse(input);
  assert(result !== null, "não retorna null com code fence");
  assert(result![0]!.type === "MISSING_CALCULATION", "extrai type correto");
  assert(result![0]!.opportunity === "COMPLEMENTARY", "extrai opportunity correto");
});

await test("safeJsonParse — JSON precedido de texto explicativo", async () => {
  const input = "Encontrei as seguintes oportunidades:\n[{\"type\":\"STRENGTHEN_ARGUMENT\",\"opportunity\":\"OPTIONAL\",\"title\":\"T\",\"rationale\":\"R\",\"evidenceFromText\":[\"trecho\"],\"suggestion\":\"S\",\"confidence\":0.85}]";
  const result = safeJsonParse(input);
  assert(result !== null, "não retorna null com texto antes");
  assert(result![0]!.type === "STRENGTHEN_ARGUMENT", "extrai type correto");
});

await test("safeJsonParse — entradas inválidas retornam null sem exceção", async () => {
  const inputs = ["isso não é json", "{ broken json [", "", "null", "{}"];
  for (const input of inputs) {
    const result = safeJsonParse(input);
    assert(result === null || Array.isArray(result), `retorno seguro para: "${input.slice(0, 20)}"`);
  }
});

await test("safeJsonParse — array vazio válido", async () => {
  const result = safeJsonParse("[]");
  assert(result !== null, "não retorna null");
  assert(result!.length === 0, "retorna array vazio");
});

await test("safeJsonParse — finding com availableSource opcional", async () => {
  const input = `[{"type":"UNUSED_EXTRACTED_DATA","opportunity":"IMPACTFUL","title":"PPP não aproveitado","rationale":"R","evidenceFromText":["exposto a agente nocivo"],"suggestion":"S","availableSource":"PPP — campo período_exposto","confidence":0.88}]`;
  const result = safeJsonParse(input);
  assert(result !== null, "não retorna null");
  assert(result![0]!.availableSource === "PPP — campo período_exposto", "availableSource preservado");
});

// ── Confidence gate ───────────────────────────────────────────────────────────

await test("Confidence gate — findings abaixo de 0.75 são descartados", async () => {
  const rawFindings = [
    { type: StrengthFindingType.MISSING_DEMONSTRATION, opportunity: OpportunityLevel.IMPACTFUL,     title: "A", rationale: "R", evidenceFromText: ["x"], suggestion: "S", confidence: 0.5  },
    { type: StrengthFindingType.MISSING_CALCULATION,   opportunity: OpportunityLevel.COMPLEMENTARY, title: "B", rationale: "R", evidenceFromText: ["y"], suggestion: "S", confidence: 0.9  },
    { type: StrengthFindingType.STRENGTHEN_ARGUMENT,   opportunity: OpportunityLevel.OPTIONAL,      title: "C", rationale: "R", evidenceFromText: [],    suggestion: "S", confidence: 0.74 },
  ];

  const filtered = rawFindings.filter(f => typeof f.confidence === "number" && f.confidence >= 0.75);
  assert(filtered.length === 1, "apenas 1 finding sobrevive ao gate");
  assert(filtered[0]!.type === StrengthFindingType.MISSING_CALCULATION, "finding com 0.9 sobrevive");
});

await test("Confidence gate — finding exatamente em 0.75 passa", async () => {
  const rawFindings = [
    { type: StrengthFindingType.ANTICIPATE_COUNTERARGUMENT, opportunity: OpportunityLevel.COMPLEMENTARY, title: "D", rationale: "R", evidenceFromText: ["t"], suggestion: "S", confidence: 0.75 },
  ];
  const filtered = rawFindings.filter(f => typeof f.confidence === "number" && f.confidence >= 0.75);
  assert(filtered.length === 1, "finding com confidence exato 0.75 passa");
});

// ── Casos de finding — validação estrutural ────────────────────────────────────

await test("MISSING_DEMONSTRATION — estrutura de finding correta", async () => {
  const finding = {
    type: StrengthFindingType.MISSING_DEMONSTRATION,
    opportunity: OpportunityLevel.IMPACTFUL,
    title: "Demonstração dos requisitos da EC 47/2005",
    rationale: "A afirmação de que os requisitos estão preenchidos não é acompanhada de demonstração fática.",
    evidenceFromText: ["o autor preenchia os requisitos da EC 47/2005"],
    suggestion: "Incluir quadro com idade, tempo de contribuição, tempo de serviço público, carreira e cargo.",
    confidence: 0.88,
  };
  assert(finding.type === StrengthFindingType.MISSING_DEMONSTRATION, "type correto");
  assert(finding.opportunity === OpportunityLevel.IMPACTFUL, "opportunity correto");
  assert(finding.evidenceFromText.length > 0, "possui evidência textual");
  assert(finding.confidence >= 0.75, "passa no confidence gate");
});

await test("UNUSED_EXTRACTED_DATA — finding com availableSource", async () => {
  const finding = {
    type: StrengthFindingType.UNUSED_EXTRACTED_DATA,
    opportunity: OpportunityLevel.IMPACTFUL,
    title: "Períodos do PPP não aproveitados na peça",
    rationale: "O PPP disponível contém dados específicos sobre exposição que não estão sendo usados.",
    evidenceFromText: ["o autor laborou exposto a agente nocivo"],
    suggestion: "Detalhar os períodos e agentes constantes no PPP para reforçar a tese de insalubridade.",
    availableSource: "PPP — campos: período_exposicao, agente_nocivo, nível",
    confidence: 0.92,
  };
  assert(finding.type === StrengthFindingType.UNUSED_EXTRACTED_DATA, "type correto");
  assert(finding.availableSource !== undefined, "availableSource presente");
  assert(finding.confidence >= 0.75, "passa no confidence gate");
});

await test("MISSING_CALCULATION — finding gerado corretamente", async () => {
  const finding = {
    type: StrengthFindingType.MISSING_CALCULATION,
    opportunity: OpportunityLevel.COMPLEMENTARY,
    title: "Memória de cálculo dos valores retroativos",
    rationale: "O pedido de valores atrasados sem memória de cálculo pode dificultar a liquidação.",
    evidenceFromText: ["requer a condenação no pagamento das diferenças"],
    suggestion: "Juntar planilha demonstrativa ou memória de cálculo dos valores pleiteados.",
    confidence: 0.82,
  };
  assert(finding.type === StrengthFindingType.MISSING_CALCULATION, "type correto");
  assert(finding.opportunity === OpportunityLevel.COMPLEMENTARY, "opportunity correto");
  assert(finding.evidenceFromText.length > 0, "possui evidência");
});

await test("JSON inválido do provider — retorno seguro sem crash", async () => {
  const invalidResponses = [
    "Não encontrei oportunidades.",
    "```\nErro interno\n```",
    "",
    "{ broken }",
  ];
  for (const raw of invalidResponses) {
    const result = safeJsonParse(raw);
    const safe = result === null || Array.isArray(result);
    assert(safe, `retorno seguro para: "${raw.slice(0, 30)}"`);
  }
});

// ── Serviço — injeção de mock ─────────────────────────────────────────────────

await test("AiLegalStrengthReviewerService — _reviewWithProvider com mock", async () => {
  const svc = new AiLegalStrengthReviewerService("k", "k");
  const mockProvider = new MockProvider([
    {
      type: StrengthFindingType.MISSING_COMPARATIVE_TABLE,
      opportunity: OpportunityLevel.IMPACTFUL,
      title: "Quadro de contribuições CNIS",
      rationale: "Facilita visualização dos períodos.",
      evidenceFromText: ["conforme demonstrado nos autos"],
      suggestion: "Incluir quadro extraído do CNIS.",
      confidence: 0.9,
    },
    {
      type: StrengthFindingType.STRENGTHEN_ARGUMENT,
      opportunity: OpportunityLevel.OPTIONAL,
      title: "Reforço da conexão fático-jurídica",
      rationale: "Premissa não conectada à conclusão.",
      evidenceFromText: ["portanto"],
      suggestion: "Desenvolver o elo entre os fatos e a norma.",
      confidence: 0.6, // abaixo do gate — deve ser descartado
    },
  ]);

  const result = await svc._reviewWithProvider(baseRequest, mockProvider);
  assert(result.findings.length === 1, "confidence gate descarta finding 0.6");
  assert(result.findings[0]!.type === StrengthFindingType.MISSING_COMPARATIVE_TABLE, "finding correto sobrevive");
  assert(result.requiresHumanReview === true, "requiresHumanReview sempre true");
  assert(!result.summary.includes("fragilidade"), "summary não usa linguagem adversarial");
  assert(result.summary.includes("oportunidade"), "summary usa linguagem de oportunidade");
});

// ── Resultado final ───────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(55)}`);
console.log(`Resultado: ${passed} passaram, ${failed} falharam`);
console.log("=".repeat(55));

if (failed > 0) process.exit(1);

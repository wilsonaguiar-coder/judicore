/**
 * FASE 9.0.2 — Testes do Domain Knowledge Framework
 *
 * Cobre:
 * 1. Registry retorna pack correto por domínio
 * 2. Registry retorna fallback quando domínio desconhecido
 * 3. Reviewer recebe o pack no prompt
 * 4. Pack não altera score
 * 5. Pack não gera finding sozinho
 * 6. Placeholder continua não sendo erro
 * 7. RGPS injeta documentos comuns no prompt
 * 8. Trabalhista injeta demonstrações comuns no prompt
 * 9. Tributário injeta cálculos comuns no prompt
 * 10. Domínio desconhecido usa GenericLegalKnowledgePack
 *
 * Executa com: pnpm dlx tsx packages/ai/src/legal-reviewer/tests/domain-knowledge.spec.ts
 */

import { DomainKnowledgeRegistry } from "../domain-knowledge/domain-knowledge.registry.js";
import { genericLegalKnowledgePack } from "../domain-knowledge/packs/generic.pack.js";
import { rgpsKnowledgePack } from "../domain-knowledge/packs/rgps.pack.js";
import { trabalhistaKnowledgePack } from "../domain-knowledge/packs/trabalhista.pack.js";
import { tributarioKnowledgePack } from "../domain-knowledge/packs/tributario.pack.js";
import { buildStrengthReviewerPrompt } from "../prompts/strength-reviewer.prompt.js";
import type { AiLegalStrengthReviewRequest } from "../dto/ai-legal-strength-review-request.js";
import type { DomainKnowledgePack } from "../domain-knowledge/domain-knowledge.types.js";
import { AiLegalStrengthReviewerService } from "../services/ai-legal-strength-reviewer.service.js";
import type { AiLegalStrengthReviewerProvider } from "../providers/ai-legal-strength-reviewer.provider.js";

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

function test(name: string, fn: () => void | Promise<void>): void {
  console.log(`\n[TEST] ${name}`);
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.catch(err => {
        console.error(`  ✗ EXCEÇÃO ASSÍNCRONA: ${(err as Error).message}`);
        failed++;
      });
    }
  } catch (err) {
    console.error(`  ✗ EXCEÇÃO NÃO ESPERADA: ${(err as Error).message}`);
    failed++;
  }
}

// ── Fixture mínimo de request ─────────────────────────────────────────────────

function makeRequest(overrides: Partial<AiLegalStrengthReviewRequest> = {}): AiLegalStrengthReviewRequest {
  return {
    draft: "O requerente [AUTOR] preenchia os requisitos legais.",
    classification: "PETICAO_INICIAL",
    audit: {
      audit: {
        status: "APROVADO",
        fatalErrors: [],
        warnings: [],
        score: 85,
      },
    } as unknown as AiLegalStrengthReviewRequest["audit"],
    ...overrides,
  };
}

// ── Cenário 1 — Registry retorna pack correto ─────────────────────────────────

test("Registry — retorna pack RGPS para domain='RGPS'", () => {
  const pack = DomainKnowledgeRegistry.get("RGPS");
  assert(pack.domain === "RGPS", `domain='RGPS' (foi '${pack.domain}')`);
  assert(pack.label.includes("RGPS"), `label contém 'RGPS' (foi '${pack.label}')`);
});

test("Registry — retorna pack Trabalhista para domain='TRABALHISTA'", () => {
  const pack = DomainKnowledgeRegistry.get("TRABALHISTA");
  assert(pack.domain === "TRABALHISTA", `domain='TRABALHISTA' (foi '${pack.domain}')`);
});

test("Registry — retorna pack Tributário para domain='TRIBUTARIO'", () => {
  const pack = DomainKnowledgeRegistry.get("TRIBUTARIO");
  assert(pack.domain === "TRIBUTARIO", `domain='TRIBUTARIO' (foi '${pack.domain}')`);
});

test("Registry — aliases funcionam (PREVIDENCIARIO → RGPS, PENAL → CRIMINAL)", () => {
  const prev = DomainKnowledgeRegistry.get("PREVIDENCIARIO");
  assert(prev.domain === "RGPS", `PREVIDENCIARIO → RGPS (foi '${prev.domain}')`);

  const penal = DomainKnowledgeRegistry.get("PENAL");
  assert(penal.domain === "CRIMINAL", `PENAL → CRIMINAL (foi '${penal.domain}')`);
});

test("Registry — normaliza caixa e espaços ('trabalhista' → TRABALHISTA)", () => {
  const pack = DomainKnowledgeRegistry.get("trabalhista");
  assert(pack.domain === "TRABALHISTA", `normalização case-insensitive (foi '${pack.domain}')`);
});

// ── Cenário 2 — Fallback genérico ────────────────────────────────────────────

test("Registry — retorna fallback genérico para domain desconhecido", () => {
  const pack = DomainKnowledgeRegistry.get("DOMINIO_INEXISTENTE_XYZ");
  assert(pack.domain === "GENERIC", `domain='GENERIC' (foi '${pack.domain}')`);
  assert(pack === genericLegalKnowledgePack, "retorna exatamente o genericLegalKnowledgePack");
});

test("Registry — retorna fallback genérico quando domain é undefined", () => {
  const pack = DomainKnowledgeRegistry.get(undefined);
  assert(pack.domain === "GENERIC", "domain='GENERIC' para undefined");
});

test("Registry — has() correto", () => {
  assert(DomainKnowledgeRegistry.has("RGPS"), "has('RGPS') = true");
  assert(DomainKnowledgeRegistry.has("TRABALHISTA"), "has('TRABALHISTA') = true");
  assert(!DomainKnowledgeRegistry.has("DOMINIO_XYZ"), "has('DOMINIO_XYZ') = false");
  assert(!DomainKnowledgeRegistry.has(undefined), "has(undefined) = false");
});

// ── Cenário 3 — Prompt recebe o pack ─────────────────────────────────────────

test("Prompt — contém seção CONTEXTO ESPECIALIZADO quando pack fornecido", () => {
  const request = makeRequest({ domainKnowledgePack: rgpsKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(request);
  assert(prompt.includes("CONTEXTO ESPECIALIZADO"), "seção CONTEXTO ESPECIALIZADO presente");
  assert(prompt.includes("RGPS"), "nome do domínio presente no prompt");
});

test("Prompt — NÃO contém seção CONTEXTO ESPECIALIZADO sem pack", () => {
  const request = makeRequest();
  const prompt = buildStrengthReviewerPrompt(request);
  assert(!prompt.includes("CONTEXTO ESPECIALIZADO"), "sem pack → sem seção especializada");
});

// ── Cenário 4 e 5 — Pack não altera score nem gera findings ──────────────────

test("Pack — não possui método de geração de findings", () => {
  const pack = rgpsKnowledgePack;
  assert(!("generateFindings" in pack), "sem generateFindings");
  assert(!("score" in pack), "sem campo score");
  assert(!("evaluate" in pack), "sem evaluate");
  assert(typeof pack.commonDocuments === "object" && Array.isArray(pack.commonDocuments), "commonDocuments é array (somente orientação)");
});

test("Pack — contém apenas dados de orientação, sem lógica executável", () => {
  const packs = [
    rgpsKnowledgePack,
    trabalhistaKnowledgePack,
    tributarioKnowledgePack,
    genericLegalKnowledgePack,
  ];
  for (const pack of packs) {
    assert(typeof pack.domain === "string", `${pack.domain}: domain é string`);
    assert(Array.isArray(pack.reviewerGoals), `${pack.domain}: reviewerGoals é array`);
    assert(Array.isArray(pack.commonDocuments), `${pack.domain}: commonDocuments é array`);
    assert(Array.isArray(pack.commonWeaknesses), `${pack.domain}: commonWeaknesses é array`);
    assert(Array.isArray(pack.commonDemonstrations), `${pack.domain}: commonDemonstrations é array`);
    assert(Array.isArray(pack.commonCalculations), `${pack.domain}: commonCalculations é array`);
    assert(Array.isArray(pack.commonCounterArguments), `${pack.domain}: commonCounterArguments é array`);
    assert(Array.isArray(pack.strengtheningOpportunities), `${pack.domain}: strengtheningOpportunities é array`);
  }
});

// ── Cenário 6 — Placeholder continua não sendo erro ──────────────────────────

test("Prompt — regra de placeholder mantida mesmo com pack RGPS ativo", () => {
  const request = makeRequest({
    domain: "RGPS",
    domainKnowledgePack: rgpsKnowledgePack,
  });
  const prompt = buildStrengthReviewerPrompt(request);

  assert(prompt.includes("REGRA SOBRE PLACEHOLDERS"), "seção de placeholders presente");
  assert(prompt.includes("NÃO gere finding apenas porque existe um placeholder"), "regra de placeholder presente");
  assert(prompt.includes("MERAMENTE ORIENTATIVO"), "aviso meramente orientativo no contexto especializado");
  assert(prompt.includes("Placeholders continuam NÃO sendo problemas mesmo com este contexto ativo"), "regra de placeholder reforçada no contexto");
});

// ── Cenário 7 — RGPS injeta documentos no prompt ─────────────────────────────

test("Prompt RGPS — documentos comuns injetados (CNIS, PPP, LTCAT)", () => {
  const request = makeRequest({ domainKnowledgePack: rgpsKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(request);

  assert(prompt.includes("CNIS"), "CNIS presente no prompt RGPS");
  assert(prompt.includes("PPP"), "PPP presente no prompt RGPS");
  assert(prompt.includes("LTCAT"), "LTCAT presente no prompt RGPS");
  assert(prompt.includes("oriente MISSING_SUPPORTING_DOCUMENT"), "instrução de uso dos documentos presente");
});

test("Prompt RGPS — demonstrações comuns injetadas (quadro de tempo de contribuição)", () => {
  const request = makeRequest({ domainKnowledgePack: rgpsKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(request);

  assert(prompt.toLowerCase().includes("quadro de tempo de contribuição"), "quadro de contribuição presente");
  assert(prompt.includes("carência"), "carência presente no prompt RGPS");
  assert(prompt.includes("oriente MISSING_DEMONSTRATION"), "instrução de uso das demonstrações presente");
});

test("Prompt RGPS — cálculos comuns injetados (RMI, atrasados, conversão)", () => {
  const request = makeRequest({ domainKnowledgePack: rgpsKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(request);

  assert(prompt.includes("RMI"), "RMI presente no prompt RGPS");
  assert(prompt.includes("Atrasados") || prompt.includes("atrasados"), "atrasados presente no prompt RGPS");
  assert(prompt.includes("oriente MISSING_CALCULATION"), "instrução de uso dos cálculos presente");
});

// ── Cenário 8 — Trabalhista injeta demonstrações ──────────────────────────────

test("Prompt Trabalhista — demonstrações injetadas (jornada, verbas rescisórias)", () => {
  const request = makeRequest({ domainKnowledgePack: trabalhistaKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(request);

  assert(prompt.includes("jornada"), "jornada presente no prompt Trabalhista");
  assert(prompt.includes("verbas rescisórias") || prompt.includes("verbas"), "verbas rescisórias presente");
  assert(prompt.includes("CTPS"), "CTPS presente no prompt Trabalhista");
});

// ── Cenário 9 — Tributário injeta cálculos ────────────────────────────────────

test("Prompt Tributário — cálculos injetados (decadência, prescrição, indébito)", () => {
  const request = makeRequest({ domainKnowledgePack: tributarioKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(request);

  assert(prompt.includes("decadência") || prompt.includes("Decadência"), "decadência presente no prompt Tributário");
  assert(prompt.includes("prescrição") || prompt.includes("Prescrição"), "prescrição presente");
  assert(prompt.includes("indébito") || prompt.includes("Indébito"), "indébito presente");
});

// ── Cenário 10 — Domínio desconhecido usa GenericLegalKnowledgePack ──────────

test("Service — usa GenericLegalKnowledgePack para domínio desconhecido via registry", () => {
  const svc = new AiLegalStrengthReviewerService("fake-key", "fake-key");

  let capturedRequest: AiLegalStrengthReviewRequest | undefined;

  // Stub do provider que captura o request e retorna []
  const mockProvider = {
    callWithFallback: async (req: AiLegalStrengthReviewRequest) => {
      capturedRequest = req;
      return [];
    },
    usedProvider: "DEEPSEEK",
    usedModel: "deepseek-chat",
  } as unknown as AiLegalStrengthReviewerProvider;

  const request = makeRequest({ domain: "DOMINIO_NAO_CADASTRADO_ABC" });

  svc._reviewWithProvider(request, mockProvider).then(() => {
    assert(capturedRequest !== undefined, "request chegou ao provider");
    assert(
      capturedRequest!.domainKnowledgePack?.domain === "GENERIC",
      `domínio desconhecido → pack GENERIC (foi '${capturedRequest!.domainKnowledgePack?.domain}')`,
    );
  });
});

test("Service — usa pack RGPS automaticamente para domain='RGPS'", () => {
  const svc = new AiLegalStrengthReviewerService("fake-key", "fake-key");

  let capturedRequest: AiLegalStrengthReviewRequest | undefined;
  const mockProvider = {
    callWithFallback: async (req: AiLegalStrengthReviewRequest) => {
      capturedRequest = req;
      return [];
    },
    usedProvider: "DEEPSEEK",
    usedModel: "deepseek-chat",
  } as unknown as AiLegalStrengthReviewerProvider;

  const request = makeRequest({ domain: "RGPS" });

  svc._reviewWithProvider(request, mockProvider).then(() => {
    assert(capturedRequest !== undefined, "request chegou ao provider");
    assert(
      capturedRequest!.domainKnowledgePack?.domain === "RGPS",
      `domain='RGPS' → pack RGPS (foi '${capturedRequest!.domainKnowledgePack?.domain}')`,
    );
  });
});

test("Service — respeita pack explícito na request (não sobrescreve)", () => {
  const svc = new AiLegalStrengthReviewerService("fake-key", "fake-key");

  const customPack: DomainKnowledgePack = {
    domain: "CUSTOM",
    label: "Pack Customizado",
    reviewerGoals: ["objetivo customizado"],
    commonDocuments: [],
    commonProofs: [],
    commonWeaknesses: [],
    commonDemonstrations: [],
    commonCalculations: [],
    commonCounterArguments: [],
    strengtheningOpportunities: [],
  };

  let capturedRequest: AiLegalStrengthReviewRequest | undefined;
  const mockProvider = {
    callWithFallback: async (req: AiLegalStrengthReviewRequest) => {
      capturedRequest = req;
      return [];
    },
    usedProvider: "DEEPSEEK",
    usedModel: "deepseek-chat",
  } as unknown as AiLegalStrengthReviewerProvider;

  const request = makeRequest({ domain: "RGPS", domainKnowledgePack: customPack });

  svc._reviewWithProvider(request, mockProvider).then(() => {
    assert(
      capturedRequest!.domainKnowledgePack?.domain === "CUSTOM",
      `pack explícito 'CUSTOM' não foi sobrescrito pelo registry (foi '${capturedRequest!.domainKnowledgePack?.domain}')`,
    );
  });
});

// ── Registry.register() — extensibilidade ────────────────────────────────────

test("Registry.register() — novo pack pode ser adicionado sem alterar o núcleo", () => {
  const novoPack: DomainKnowledgePack = {
    domain: "MARITIMO",
    label: "Direito Marítimo",
    reviewerGoals: ["demonstrar responsabilidade do armador"],
    commonDocuments: ["Conhecimento de embarque (Bill of Lading)", "Manifesto de carga"],
    commonProofs: ["Laudo de vistoria do navio"],
    commonWeaknesses: ["Ausência de protesto marítimo"],
    commonDemonstrations: ["Quadro de avarias"],
    commonCalculations: ["Indenização por avaria grossa"],
    commonCounterArguments: ["Perigo de mar como excludente"],
    strengtheningOpportunities: ["Incluir vistoria prévia de carga"],
  };

  DomainKnowledgeRegistry.register(novoPack, ["MARITIMO", "MARÍTIMO"]);

  const pack = DomainKnowledgeRegistry.get("MARITIMO");
  assert(pack.domain === "MARITIMO", `pack MARITIMO registrado (foi '${pack.domain}')`);
  assert(DomainKnowledgeRegistry.has("MARITIMO"), "has('MARITIMO') = true após registro");

  const packAcc = DomainKnowledgeRegistry.get("MARÍTIMO");
  assert(packAcc.domain === "MARITIMO", "alias acentuado funciona");
});

// ── Resultado final ───────────────────────────────────────────────────────────

// Aguarda um tick para os testes assíncronos completarem
setTimeout(() => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Resultado: ${passed} passaram, ${failed} falharam`);
  console.log("=".repeat(60));
  if (failed > 0) process.exit(1);
}, 200);

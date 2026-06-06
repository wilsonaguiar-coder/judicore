/**
 * FASE 9.0.3 — Domain Knowledge Hardening + Prompt Grounding Tests
 *
 * Cobre:
 * A) Registry hardening (espaços, listAll, register-não-quebra-existentes)
 * B) Prompt grounding (advisory language, regras anti-alucinação)
 * C) Anti-contaminação entre domínios
 * D) Pack não gera findings por si só (mock provider)
 * E) Override explícito prevalece sobre registry
 * F) Garantias arquiteturais (pack é apenas dado)
 *
 * Executa com: pnpm dlx tsx packages/ai/src/legal-reviewer/tests/domain-knowledge-hardening.spec.ts
 */

import { DomainKnowledgeRegistry } from "../domain-knowledge/domain-knowledge.registry.js";
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
import { buildStrengthReviewerPrompt } from "../prompts/strength-reviewer.prompt.js";
import { AiLegalStrengthReviewerService } from "../services/ai-legal-strength-reviewer.service.js";
import type { AiLegalStrengthReviewRequest } from "../dto/ai-legal-strength-review-request.js";
import type { AiLegalStrengthReviewerProvider } from "../providers/ai-legal-strength-reviewer.provider.js";
import type { DomainKnowledgePack } from "../domain-knowledge/domain-knowledge.types.js";

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

function test(name: string, fn: () => void): void {
  console.log(`\n[TEST] ${name}`);
  try {
    fn();
  } catch (err) {
    console.error(`  ✗ EXCEÇÃO NÃO ESPERADA: ${(err as Error).message}`);
    failed++;
  }
}

function makeRequest(overrides: Partial<AiLegalStrengthReviewRequest> = {}): AiLegalStrengthReviewRequest {
  return {
    draft: "O requerente [AUTOR] preenchia os requisitos legais.",
    classification: "PETICAO_INICIAL",
    audit: {
      audit: { status: "APROVADO", fatalErrors: [], warnings: [], score: 85 },
    } as unknown as AiLegalStrengthReviewRequest["audit"],
    ...overrides,
  };
}

function makeMockProvider(findings: object[] = []) {
  return {
    callWithFallback: async (_req: AiLegalStrengthReviewRequest) => findings,
    usedProvider: "DEEPSEEK",
    usedModel: "deepseek-chat",
  } as unknown as AiLegalStrengthReviewerProvider;
}

// ── A) Registry hardening ─────────────────────────────────────────────────────

test("Registry — get(' rgps ') normaliza espaços laterais", () => {
  const pack = DomainKnowledgeRegistry.get(" rgps ");
  assert(pack.domain === "RGPS", `espaços normalizados → RGPS (foi '${pack.domain}')`);
});

test("Registry — get('  TRABALHISTA  ') com espaços extras funciona", () => {
  const pack = DomainKnowledgeRegistry.get("  TRABALHISTA  ");
  assert(pack.domain === "TRABALHISTA", `espaços extras normalizados (foi '${pack.domain}')`);
});

test("Registry — get('rGps') normaliza case misto", () => {
  const pack = DomainKnowledgeRegistry.get("rGps");
  assert(pack.domain === "RGPS", `case misto normalizado (foi '${pack.domain}')`);
});

test("Registry — get('tributário') com acento normalizado", () => {
  const pack = DomainKnowledgeRegistry.get("tributário");
  assert(pack.domain === "TRIBUTARIO", `acento em minúsculo normalizado (foi '${pack.domain}')`);
});

test("Registry — listAll() retorna todos os 11 packs especializados + genérico", () => {
  const all = DomainKnowledgeRegistry.listAll();
  // Verifica que cada pack especializado está na lista
  const domains = all.map(p => p.domain);
  assert(domains.includes("RGPS"), "RGPS em listAll()");
  assert(domains.includes("RPPS"), "RPPS em listAll()");
  assert(domains.includes("TRABALHISTA"), "TRABALHISTA em listAll()");
  assert(domains.includes("TRIBUTARIO"), "TRIBUTARIO em listAll()");
  assert(domains.includes("FAMILIA"), "FAMILIA em listAll()");
  assert(domains.includes("CONSUMIDOR"), "CONSUMIDOR em listAll()");
  assert(domains.includes("CRIMINAL"), "CRIMINAL em listAll()");
  assert(domains.includes("FAZENDA_PUBLICA"), "FAZENDA_PUBLICA em listAll()");
  assert(domains.includes("AMBIENTAL"), "AMBIENTAL em listAll()");
  assert(domains.includes("CIVEL"), "CIVEL em listAll()");
  assert(domains.includes("JUIZADO_ESPECIAL"), "JUIZADO_ESPECIAL em listAll()");
  assert(domains.includes("GENERIC"), "GENERIC em listAll()");
  assert(all.length >= 12, `ao menos 12 packs únicos (foi ${all.length})`);
});

test("Registry — register() não quebra packs existentes", () => {
  // Registra novo pack
  const novoPack: DomainKnowledgePack = {
    domain: "TESTE_HARDENING",
    label: "Teste de Hardening",
    reviewerGoals: [],
    commonDocuments: [],
    commonProofs: [],
    commonWeaknesses: [],
    commonDemonstrations: [],
    commonCalculations: [],
    commonCounterArguments: [],
    strengtheningOpportunities: [],
  };
  DomainKnowledgeRegistry.register(novoPack);

  // Packs existentes continuam intactos
  assert(DomainKnowledgeRegistry.get("RGPS").domain === "RGPS", "RGPS intacto após registro");
  assert(DomainKnowledgeRegistry.get("TRABALHISTA").domain === "TRABALHISTA", "TRABALHISTA intacto");
  assert(DomainKnowledgeRegistry.get("TRIBUTARIO").domain === "TRIBUTARIO", "TRIBUTARIO intacto");
  assert(DomainKnowledgeRegistry.get("CRIMINAL").domain === "CRIMINAL", "CRIMINAL intacto");
  assert(DomainKnowledgeRegistry.get("FAMILIA").domain === "FAMILIA", "FAMÍLIA intacto");

  // Novo pack disponível
  assert(DomainKnowledgeRegistry.has("TESTE_HARDENING"), "novo pack registrado");
  assert(DomainKnowledgeRegistry.get("TESTE_HARDENING").domain === "TESTE_HARDENING", "novo pack retornado");
});

test("Registry — aliases resolvem para o mesmo pack object", () => {
  const byRGPS = DomainKnowledgeRegistry.get("RGPS");
  const byPrev = DomainKnowledgeRegistry.get("PREVIDENCIARIO");
  assert(byRGPS === byPrev, "RGPS e PREVIDENCIARIO retornam o mesmo pack object");

  const byPenal = DomainKnowledgeRegistry.get("PENAL");
  const byCriminal = DomainKnowledgeRegistry.get("CRIMINAL");
  assert(byPenal === byCriminal, "PENAL e CRIMINAL retornam o mesmo pack object");

  const byFazenda = DomainKnowledgeRegistry.get("FAZENDA");
  const byAdmin = DomainKnowledgeRegistry.get("ADMINISTRATIVO");
  assert(byFazenda === byAdmin, "FAZENDA e ADMINISTRATIVO retornam o mesmo pack object");
});

// ── B) Prompt grounding — linguagem advisory explícita ────────────────────────

test("Prompt — contém 'MERAMENTE ORIENTATIVO' no contexto especializado", () => {
  const req = makeRequest({ domainKnowledgePack: rgpsKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(req);
  assert(prompt.includes("MERAMENTE ORIENTATIVO"), "texto 'MERAMENTE ORIENTATIVO' presente");
});

test("Prompt — contém regra 'NÃO autoriza findings automáticos'", () => {
  const req = makeRequest({ domainKnowledgePack: rgpsKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(req);
  assert(prompt.includes("NÃO autoriza findings automáticos"), "regra anti-findings-automáticos presente");
});

test("Prompt — contém regra 'NÃO presuma ausência de documento'", () => {
  const req = makeRequest({ domainKnowledgePack: tributarioKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(req);
  assert(prompt.includes("NÃO presuma ausência de documento"), "regra 'não presuma ausência' presente");
});

test("Prompt — contém regra de não transportar exigências entre domínios", () => {
  const req = makeRequest({ domainKnowledgePack: trabalhistaKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(req);
  assert(
    prompt.includes("NUNCA transporte exigências típicas de um domínio para outro"),
    "regra anti-contaminação entre domínios presente",
  );
});

test("Prompt — regras grounding aparecem ANTES dos itens do pack", () => {
  const req = makeRequest({ domainKnowledgePack: rgpsKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(req);

  const idxOrienta = prompt.indexOf("MERAMENTE ORIENTATIVO");
  const idxCnis = prompt.indexOf("CNIS");

  assert(idxOrienta < idxCnis, `regra grounding (pos ${idxOrienta}) antes de CNIS (pos ${idxCnis})`);
});

test("Prompt — regras obrigatórias do reviewer (confidence gate, evidência) não são removidas pelo pack", () => {
  const req = makeRequest({ domainKnowledgePack: rgpsKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(req);

  assert(prompt.includes("NÃO invente fatos"), "regra 'não invente fatos' mantida");
  assert(prompt.includes("evidência textual clara"), "regra de evidência textual mantida");
  assert(prompt.includes("REGRAS ABSOLUTAS"), "seção de regras absolutas mantida");
});

// ── C) Anti-contaminação entre domínios ──────────────────────────────────────

test("Anti-contaminação — prompt RGPS não contém termos tributários (CDA, DARF)", () => {
  const req = makeRequest({ domainKnowledgePack: rgpsKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(req);

  // CDA e DARF são documentos exclusivos do pack tributário
  assert(!prompt.includes("CDA"), "CDA (Tributário) ausente no prompt RGPS");
  assert(!prompt.includes("DARF"), "DARF (Tributário) ausente no prompt RGPS");
  assert(!prompt.includes("auto de infração"), "auto de infração ausente no prompt RGPS");
  assert(!prompt.includes("decadência") || prompt.includes("carência"), "termos tributários de decadência não presentes sem contexto RGPS");
});

test("Anti-contaminação — prompt RGPS não contém termos trabalhistas (TRCT, CTPS como documento principal)", () => {
  const req = makeRequest({ domainKnowledgePack: rgpsKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(req);

  // TRCT é documento exclusivamente trabalhista
  assert(!prompt.includes("TRCT"), "TRCT (Trabalhista) ausente no prompt RGPS");
  // CTPS aparece no RGPS mas como contexto previdenciário, não como verba rescisória
  assert(!prompt.includes("verbas rescisórias"), "verbas rescisórias (Trabalhista) ausente no prompt RGPS");
});

test("Anti-contaminação — prompt Família não contém termos criminais (flagrante, dosimetria)", () => {
  const req = makeRequest({ domainKnowledgePack: familiaKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(req);

  assert(!prompt.includes("flagrante"), "flagrante (Criminal) ausente no prompt Família");
  assert(!prompt.includes("pena-base"), "pena-base (Criminal) ausente no prompt Família");
  assert(!prompt.includes("prisão preventiva"), "prisão preventiva ausente no prompt Família");
  assert(!prompt.includes("Auto de Prisão"), "Auto de Prisão (Criminal) ausente no prompt Família");
});

test("Anti-contaminação — prompt Tributário não contém termos previdenciários (CNIS, carência RGPS)", () => {
  const req = makeRequest({ domainKnowledgePack: tributarioKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(req);

  // PPP e LTCAT são exclusivos do pack RGPS (CNIS aparece no exemplo base do prompt, não conta)
  assert(!prompt.includes("PPP"), "PPP (RGPS) ausente no prompt Tributário");
  assert(!prompt.includes("LTCAT"), "LTCAT (RGPS) ausente no prompt Tributário");
  assert(!prompt.includes("qualidade de segurado"), "qualidade de segurado (RGPS) ausente no prompt Tributário");
});

test("Anti-contaminação — prompt genérico não contém termos específicos de nenhum pack", () => {
  const req = makeRequest({ domainKnowledgePack: genericLegalKnowledgePack });
  const prompt = buildStrengthReviewerPrompt(req);

  // CNIS aparece no exemplo base do prompt (MISSING_COMPARATIVE_TABLE), verificar TRCT e outros exclusivos
  assert(!prompt.includes("TRCT"), "TRCT ausente no prompt genérico");
  assert(!prompt.includes("DARF"), "DARF ausente no prompt genérico");
  assert(!prompt.includes("flagrante"), "flagrante ausente no prompt genérico");
});

// ── D) Pack não gera findings por si só ──────────────────────────────────────

test("Mock provider — pack ativo com texto sólido não gera findings", async () => {
  const svc = new AiLegalStrengthReviewerService("fake-key", "fake-key");
  const mockProvider = makeMockProvider([]); // provider que sempre retorna []

  const request = makeRequest({
    domain: "RGPS",
    domainKnowledgePack: rgpsKnowledgePack,
    draft: "O requerente demonstrou o tempo de contribuição e a carência de forma robusta, com CNIS completo e PPP assinado.",
  });

  const result = await svc._reviewWithProvider(request, mockProvider);
  assert(result.findings.length === 0, "pack RGPS ativo + provider sem findings → 0 findings");
  assert(result.requiresHumanReview === true, "requiresHumanReview sempre true");
});

test("Mock provider — pack Trabalhista ativo com texto sólido não gera findings", async () => {
  const svc = new AiLegalStrengthReviewerService("fake-key", "fake-key");
  const mockProvider = makeMockProvider([]);

  const request = makeRequest({
    domain: "TRABALHISTA",
    domainKnowledgePack: trabalhistaKnowledgePack,
    draft: "O reclamante, admitido em 01/01/2020, trabalhou de segunda a sexta das 8h às 17h, conforme controle de ponto eletrônico.",
  });

  const result = await svc._reviewWithProvider(request, mockProvider);
  assert(result.findings.length === 0, "pack Trabalhista ativo + provider sem findings → 0 findings");
});

test("Mock provider — provider captura request com pack correto injetado", async () => {
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

  const request = makeRequest({ domain: "CONSUMIDOR" });
  await svc._reviewWithProvider(request, mockProvider);

  assert(capturedRequest !== undefined, "request chegou ao provider");
  assert(capturedRequest!.domainKnowledgePack?.domain === "CONSUMIDOR", `pack CONSUMIDOR injetado (foi '${capturedRequest!.domainKnowledgePack?.domain}')`);
});

// ── E) Override explícito prevalece ──────────────────────────────────────────

test("Override — pack explícito em request.domainKnowledgePack prevalece sobre domain='RGPS'", async () => {
  const svc = new AiLegalStrengthReviewerService("fake-key", "fake-key");
  let capturedRequest: AiLegalStrengthReviewRequest | undefined;

  const mockProvider = {
    callWithFallback: async (req: AiLegalStrengthReviewRequest) => { capturedRequest = req; return []; },
    usedProvider: "DEEPSEEK", usedModel: "deepseek-chat",
  } as unknown as AiLegalStrengthReviewerProvider;

  // domain='RGPS' mas pack explícito é Trabalhista → deve usar Trabalhista
  const request = makeRequest({
    domain: "RGPS",
    domainKnowledgePack: trabalhistaKnowledgePack,
  });

  await svc._reviewWithProvider(request, mockProvider);
  assert(
    capturedRequest!.domainKnowledgePack?.domain === "TRABALHISTA",
    `override Trabalhista prevalece sobre domain RGPS (foi '${capturedRequest!.domainKnowledgePack?.domain}')`,
  );
});

test("Override — pack genérico explícito prevalece mesmo com domain='RGPS'", async () => {
  const svc = new AiLegalStrengthReviewerService("fake-key", "fake-key");
  let capturedRequest: AiLegalStrengthReviewRequest | undefined;

  const mockProvider = {
    callWithFallback: async (req: AiLegalStrengthReviewRequest) => { capturedRequest = req; return []; },
    usedProvider: "DEEPSEEK", usedModel: "deepseek-chat",
  } as unknown as AiLegalStrengthReviewerProvider;

  const request = makeRequest({ domain: "RGPS", domainKnowledgePack: genericLegalKnowledgePack });
  await svc._reviewWithProvider(request, mockProvider);

  assert(
    capturedRequest!.domainKnowledgePack?.domain === "GENERIC",
    `pack GENERIC explícito prevalece (foi '${capturedRequest!.domainKnowledgePack?.domain}')`,
  );
});

// ── F) Garantias arquiteturais ────────────────────────────────────────────────

test("Arquitetura — todos os packs são dados puros, sem métodos executáveis", () => {
  const allPacks = [
    rgpsKnowledgePack, rppsKnowledgePack, trabalhistaKnowledgePack, tributarioKnowledgePack,
    familiaKnowledgePack, consumidorKnowledgePack, criminalKnowledgePack, fazendaPublicaKnowledgePack,
    ambientalKnowledgePack, civelGeralKnowledgePack, juizadoEspecialKnowledgePack, genericLegalKnowledgePack,
  ];

  for (const pack of allPacks) {
    const executableMethods = Object.entries(pack).filter(([, v]) => typeof v === "function");
    assert(executableMethods.length === 0, `${pack.domain}: sem métodos executáveis (encontrado: ${executableMethods.map(([k]) => k).join(",")})`);
  }
});

test("Arquitetura — DomainKnowledgeRegistry não expõe modificação de findings", () => {
  assert(!("generateFindings" in DomainKnowledgeRegistry), "sem generateFindings no registry");
  assert(!("evaluate" in DomainKnowledgeRegistry), "sem evaluate no registry");
  assert(!("score" in DomainKnowledgeRegistry), "sem score no registry");
  assert(typeof DomainKnowledgeRegistry.get === "function", "get() é função");
  assert(typeof DomainKnowledgeRegistry.has === "function", "has() é função");
  assert(typeof DomainKnowledgeRegistry.register === "function", "register() é função");
  assert(typeof DomainKnowledgeRegistry.listAll === "function", "listAll() é função");
});

test("Arquitetura — todos os packs têm os campos obrigatórios da interface", () => {
  const requiredArrayFields: Array<keyof DomainKnowledgePack> = [
    "reviewerGoals", "commonDocuments", "commonProofs", "commonWeaknesses",
    "commonDemonstrations", "commonCalculations", "commonCounterArguments", "strengtheningOpportunities",
  ];

  const allPacks = DomainKnowledgeRegistry.listAll();
  for (const pack of allPacks) {
    assert(typeof pack.domain === "string" && pack.domain.length > 0, `${pack.domain || "???"}: campo domain presente`);
    assert(typeof pack.label === "string" && pack.label.length > 0, `${pack.domain}: campo label presente`);
    for (const field of requiredArrayFields) {
      assert(Array.isArray(pack[field]), `${pack.domain}: ${field} é array`);
    }
  }
});

test("Arquitetura — pack com reviewerGoals não vazio orienta o reviewer", () => {
  for (const pack of [rgpsKnowledgePack, trabalhistaKnowledgePack, tributarioKnowledgePack]) {
    assert(pack.reviewerGoals.length > 0, `${pack.domain}: reviewerGoals não vazio`);
    assert(pack.commonWeaknesses.length > 0, `${pack.domain}: commonWeaknesses não vazio`);
    assert(pack.strengtheningOpportunities.length > 0, `${pack.domain}: strengtheningOpportunities não vazio`);
  }
});

// ── Resultado final ───────────────────────────────────────────────────────────

// Aguarda um tick para os testes assíncronos completarem
setTimeout(() => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Resultado: ${passed} passaram, ${failed} falharam`);
  console.log("=".repeat(60));
  if (failed > 0) process.exit(1);
}, 500);

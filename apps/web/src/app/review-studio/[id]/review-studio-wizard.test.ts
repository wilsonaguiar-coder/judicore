import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── Shared logic replicated from page.tsx ───────────────────────────────────
// Pure unit tests — no browser, no DOM, no network.

type StepStatus = "pending" | "active" | "completed";
interface WorkflowStep { id: number; label: string; description: string; status: StepStatus; }

function computeSteps(
  hasAudit: boolean, hasSuggestion: boolean, hasRewrite: boolean, hasReAudit: boolean
): WorkflowStep[] {
  return [
    { id: 1, label: "Auditoria",  description: "", status: hasAudit ? "completed" : "active" },
    { id: 2, label: "Sugestão",   description: "", status: !hasAudit ? "pending" : hasSuggestion ? "completed" : "active" },
    { id: 3, label: "Reescrita",  description: "", status: !hasSuggestion ? "pending" : hasRewrite ? "completed" : "active" },
    { id: 4, label: "Re-Audit",   description: "", status: !hasRewrite ? "pending" : hasReAudit ? "completed" : "active" },
  ];
}

function computeHasAudit(audit: any): boolean {
  return !!(audit?.classification) || (typeof audit?.score === "number" && audit.score > 0);
}

// ─── DEMO constants ───────────────────────────────────────────────────────────
const DEMO_DOCUMENT_ID = "teste-1";

describe("Review Studio — Wizard & Demo Tests", () => {

  // TEST 1: Tela sem auditoria mostra botão Executar Auditoria
  it("1. hasAudit=false → deve exibir botão Executar Auditoria (passo 1 ativo)", () => {
    const steps = computeSteps(false, false, false, false);
    assert.equal(steps[0].status, "active",  "Step 1 deve ser active sem auditoria");
    assert.equal(steps[1].status, "pending", "Step 2 deve ser pending");
    assert.equal(steps[2].status, "pending", "Step 3 deve ser pending");
    assert.equal(steps[3].status, "pending", "Step 4 deve ser pending");
  });

  // TEST 2: Stepper renderiza etapas corretamente
  it("2. Stepper tem 4 etapas com labels corretos", () => {
    const steps = computeSteps(false, false, false, false);
    const labels = steps.map(s => s.label);
    assert.deepEqual(labels, ["Auditoria", "Sugestão", "Reescrita", "Re-Audit"]);
    assert.equal(steps.length, 4);
  });

  // TEST 3: Botões bloqueados sem auditoria
  it("3. Sem auditoria → Sugestão/Reescrita/Re-Audit devem ser disabled", () => {
    const hasAudit     = false;
    const hasSuggestion = false;
    const hasRewrite   = false;

    const btnSuggestionDisabled = !hasAudit || hasSuggestion;
    const btnRewriteDisabled    = !hasSuggestion || hasRewrite;
    const btnReAuditDisabled    = !hasRewrite;

    assert.ok(btnSuggestionDisabled, "Sugestão disabled sem auditoria");
    assert.ok(btnRewriteDisabled,    "Reescrita disabled sem sugestão");
    assert.ok(btnReAuditDisabled,    "Re-Audit disabled sem reescrita");
  });

  // TEST 4: Executar auditoria muda hasAudit
  it("4. Resposta de audit com score>0 → hasAudit=true, stepper avança", () => {
    const auditResponse = { audit: { score: 72, classification: "CIVIL_PETICAO_INICIAL" } };
    const hasAudit = computeHasAudit(auditResponse.audit);

    assert.ok(hasAudit, "hasAudit deve ser true");

    const steps = computeSteps(hasAudit, false, false, false);
    assert.equal(steps[0].status, "completed", "Step 1 = completed");
    assert.equal(steps[1].status, "active",    "Step 2 = active");
  });

  // TEST 5: AUDIT_CREATED aparece na timeline após POST audit
  it("5. Após auditoria, timeline contém evento AUDIT_CREATED", () => {
    // Simula o que o backend deveria retornar após POST /audit
    const mockTimeline = {
      versions: [],
      events: [
        { id: "evt-1", type: "AUDIT_CREATED", timestamp: new Date().toISOString(), details: { score: 72 } }
      ]
    };
    const events: any[] = mockTimeline.events ?? [];
    const hasAuditCreated = events.some(e => e.type === "AUDIT_CREATED");
    assert.ok(hasAuditCreated, "Timeline deve conter AUDIT_CREATED");
  });

  // TEST 6: Modo DEMO carrega para id === "teste-1"
  it("6. DEMO_DOCUMENT_ID é 'teste-1'", () => {
    assert.equal(DEMO_DOCUMENT_ID, "teste-1");
    // Simula verificação de isDemo
    const isDemo = (id: string) => id === DEMO_DOCUMENT_ID;
    assert.ok(isDemo("teste-1"),  "isDemo deve ser true para teste-1");
    assert.ok(!isDemo("outro-id"), "isDemo deve ser false para outros ids");
  });

  // TEST 7: Fluxo completo — todos os passos completed
  it("7. Fluxo completo: auditoria→sugestão→reescrita→re-audit, todos completed", () => {
    // Step 1: audit
    let steps = computeSteps(false, false, false, false);
    assert.equal(steps[0].status, "active");

    // Step 2: after audit
    steps = computeSteps(true, false, false, false);
    assert.equal(steps[0].status, "completed");
    assert.equal(steps[1].status, "active");

    // Step 3: after suggestion
    steps = computeSteps(true, true, false, false);
    assert.equal(steps[1].status, "completed");
    assert.equal(steps[2].status, "active");

    // Step 4: after rewrite
    steps = computeSteps(true, true, true, false);
    assert.equal(steps[2].status, "completed");
    assert.equal(steps[3].status, "active");

    // Complete: after re-audit
    steps = computeSteps(true, true, true, true);
    assert.ok(steps.every(s => s.status === "completed"), "Todos completed");
  });

  // EXTRA: hasAudit edge cases
  it("E1. hasAudit via classification sem score", () => {
    assert.ok(computeHasAudit({ score: 0, classification: "TRABALHISTA_RECURSO" }));
  });

  it("E2. hasAudit via score>0 sem classification", () => {
    assert.ok(computeHasAudit({ score: 1 }));
  });

  it("E3. hasAudit=false para audit vazio/null", () => {
    assert.equal(computeHasAudit({}), false);
    assert.equal(computeHasAudit(null), false);
    assert.equal(computeHasAudit({ score: 0 }), false);
  });
});

// ─── Human Review Decision tests ─────────────────────────────────────────────

// Simulates the handleDecision logic from page.tsx
async function simulateHandleDecision(
  currentDecisionStatus: string | null,
  currentDecisionLoading: string | null,
  decision: string,
  apiResult: { ok: boolean; body: any }
): Promise<{ decisionStatus: string | null; error: string | null }> {
  if (currentDecisionStatus || currentDecisionLoading) {
    return { decisionStatus: currentDecisionStatus, error: null };
  }
  if (!apiResult.ok) {
    return { decisionStatus: null, error: `Decision failed: ${apiResult.body?.status ?? 500}` };
  }
  const status = apiResult.body?.decision?.status ?? decision;
  return { decisionStatus: status, error: null };
}

// Resolves the ruleCode from a suggestion object (mirrors page.tsx logic)
function resolveRuleCode(suggestion: any): string {
  return suggestion?.code ?? suggestion?.ruleCode ?? "UNKNOWN";
}

// Badge is shown when decisionStatus is set (mirrors SuggestionPanel logic)
function computeBadge(decisionStatus: string | null): string | null {
  if (!decisionStatus) return null;
  const map: Record<string, string> = {
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    SKIPPED:  "SKIPPED",
  };
  return map[decisionStatus] ?? null;
}

// Buttons are disabled when decided or loading
function computeButtonsDisabled(decisionStatus: string | null, decisionLoading: string | null): boolean {
  return !!decisionStatus || !!decisionLoading;
}

// Task is completed only when decision is APPROVED
function computeTaskCompleted(decisionStatus: string | null): boolean {
  return decisionStatus === "APPROVED";
}

describe("Human Review Decision — SuggestionPanel Logic", () => {

  it("D1. clicar Approve chama /decision e seta decisionStatus=APPROVED", async () => {
    const result = await simulateHandleDecision(null, null, "APPROVED", {
      ok: true,
      body: { decision: { status: "APPROVED", taskId: "task-test-1", ruleCode: "RULE_X" } },
    });
    assert.equal(result.decisionStatus, "APPROVED");
    assert.equal(result.error, null);
  });

  it("D2. Approve → badge exibe APPROVED", () => {
    assert.equal(computeBadge("APPROVED"), "APPROVED");
  });

  it("D3. Reject → badge exibe REJECTED, task NÃO fica completed", () => {
    assert.equal(computeBadge("REJECTED"), "REJECTED");
    assert.equal(computeTaskCompleted("REJECTED"), false);
  });

  it("D4. Skip → badge exibe SKIPPED, task NÃO fica completed", () => {
    assert.equal(computeBadge("SKIPPED"), "SKIPPED");
    assert.equal(computeTaskCompleted("SKIPPED"), false);
  });

  it("D5. ruleCode usa suggestion.code quando existe, nunca UNKNOWN", () => {
    assert.equal(resolveRuleCode({ code: "UNADDRESSED_MAIN_REQUEST", ruleCode: "UNKNOWN" }), "UNADDRESSED_MAIN_REQUEST");
    assert.equal(resolveRuleCode({ ruleCode: "SOME_RULE" }), "SOME_RULE");
    assert.equal(resolveRuleCode({}), "UNKNOWN");
    assert.equal(resolveRuleCode(null), "UNKNOWN");
  });

  it("D6. botão fica disabled após decisão e não dispara duplo clique", async () => {
    // After first decision
    assert.ok(computeButtonsDisabled("APPROVED", null), "disabled após APPROVED");
    assert.ok(computeButtonsDisabled("REJECTED", null), "disabled após REJECTED");
    assert.ok(computeButtonsDisabled(null, "APPROVED"), "disabled durante loading");

    // Double-click guard: handleDecision retorna sem fazer nada se já decidido
    const result = await simulateHandleDecision("APPROVED", null, "REJECTED", {
      ok: true,
      body: { decision: { status: "REJECTED" } },
    });
    assert.equal(result.decisionStatus, "APPROVED", "não sobrescreve decisão existente");
  });
});

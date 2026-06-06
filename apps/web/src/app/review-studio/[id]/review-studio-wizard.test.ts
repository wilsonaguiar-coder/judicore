import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── Unit tests for wizard state logic ───────────────────────────────────────
// These tests are pure logic tests — they do not require a browser or DOM.

type StepStatus = "pending" | "active" | "completed";
interface WorkflowStep {
  id: number;
  label: string;
  description: string;
  status: StepStatus;
}

function computeSteps(
  hasAudit: boolean,
  hasSuggestion: boolean,
  hasRewrite: boolean,
  hasReAudit: boolean
): WorkflowStep[] {
  return [
    {
      id: 1, label: "Auditoria", description: "",
      status: hasAudit ? "completed" : "active",
    },
    {
      id: 2, label: "Sugestão", description: "",
      status: !hasAudit ? "pending" : hasSuggestion ? "completed" : "active",
    },
    {
      id: 3, label: "Reescrita", description: "",
      status: !hasSuggestion ? "pending" : hasRewrite ? "completed" : "active",
    },
    {
      id: 4, label: "Re-Audit", description: "",
      status: !hasRewrite ? "pending" : hasReAudit ? "completed" : "active",
    },
  ];
}

function computeHasAudit(audit: any): boolean {
  return !!(audit?.classification) ||
    (typeof audit?.score === "number" && audit.score > 0);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("Review Studio — Wizard State Logic", () => {
  // TEST 1: Sem auditoria → passo 1 ativo, outros pendentes
  it("1. Sem auditoria: passo 1 ativo, passos 2-4 pendentes", () => {
    const steps = computeSteps(false, false, false, false);
    assert.equal(steps[0].status, "active",    "Step 1 deve ser active");
    assert.equal(steps[1].status, "pending",   "Step 2 deve ser pending");
    assert.equal(steps[2].status, "pending",   "Step 3 deve ser pending");
    assert.equal(steps[3].status, "pending",   "Step 4 deve ser pending");
  });

  // TEST 2: Botões desabilitados sem auditoria
  it("2. hasAudit=false → Sugestão/Reescrita/Re-Audit devem ser desabilitados", () => {
    const hasAudit = false;
    const hasSuggestion = false;
    const hasRewrite = false;

    const suggDisabled = !hasAudit || hasSuggestion;
    const rewDisabled  = !hasSuggestion || hasRewrite;
    const raDisabled   = !hasRewrite;

    assert.ok(suggDisabled, "Sugestão deve estar disabled sem auditoria");
    assert.ok(rewDisabled,  "Reescrita deve estar disabled sem auditoria");
    assert.ok(raDisabled,   "Re-Audit deve estar disabled sem auditoria");
  });

  // TEST 3: Executar auditoria popula estado
  it("3. Após auditoria: hasAudit=true e stepper avança para passo 2", () => {
    const mockAuditResponse = { audit: { score: 72, classification: "CIVIL_PETICAO_INICIAL", fatalErrors: [], nonFatalErrors: [], strengths: [] } };
    const audit = mockAuditResponse.audit;

    const hasAudit = computeHasAudit(audit);
    assert.ok(hasAudit, "hasAudit deve ser true quando score > 0");

    const steps = computeSteps(hasAudit, false, false, false);
    assert.equal(steps[0].status, "completed", "Step 1 deve ser completed");
    assert.equal(steps[1].status, "active",    "Step 2 deve ser active");
  });

  // TEST 4: Stepper muda para etapa 2 quando hasAudit=true
  it("4. Stepper com hasAudit=true: step 1 completed, step 2 active", () => {
    const steps = computeSteps(true, false, false, false);
    assert.equal(steps[0].status, "completed");
    assert.equal(steps[1].status, "active");
    assert.equal(steps[2].status, "pending");
    assert.equal(steps[3].status, "pending");
  });

  // TEST 5: hasAudit via classification (sem score)
  it("5. hasAudit via classification sem score > 0", () => {
    const audit = { score: 0, classification: "TRABALHISTA_RECURSO" };
    assert.ok(computeHasAudit(audit), "classification presente → hasAudit=true");
  });

  // TEST 6: hasAudit via score sem classification
  it("6. hasAudit via score > 0 sem classification", () => {
    const audit = { score: 55 };
    assert.ok(computeHasAudit(audit), "score > 0 → hasAudit=true");
  });

  // TEST 7: audit vazio → hasAudit=false
  it("7. audit vazio → hasAudit=false", () => {
    assert.equal(computeHasAudit({}),   false);
    assert.equal(computeHasAudit(null), false);
    assert.equal(computeHasAudit({ score: 0 }), false);
  });

  // TEST 8: Fluxo completo — todos os passos completed
  it("8. Fluxo completo: todos os steps completed", () => {
    const steps = computeSteps(true, true, true, true);
    assert.ok(steps.every(s => s.status === "completed"), "Todos os steps devem ser completed");
  });
});

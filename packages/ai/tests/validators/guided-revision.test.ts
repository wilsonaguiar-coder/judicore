import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GuidedRevisionService } from "../../src/audit/revision/guided-revision.service.js";
import type { CorrectionPlan } from "../../src/audit/types/correction-plan.js";

describe("GuidedRevisionService", () => {
  const service = new GuidedRevisionService();

  const mockPlan: CorrectionPlan = {
    status: "REQUIRES_REVISION",
    items: [
      { code: "WARN_LOW", priority: "LOW", area: "ESTRUTURA", instruction: "X" },
      { code: "FATAL_HIGH", priority: "HIGH", area: "M\u00C9RITO", instruction: "Y" },
      { code: "WARN_MEDIUM", priority: "MEDIUM", area: "PROVAS", instruction: "Z" },
    ]
  };

  it("1. CorrectionPlan vazio gera status SEM_TAREFAS", () => {
    const rev = service.buildGuidedRevision({ status: "APPROVED", items: [] });
    assert.equal(rev.status, "SEM_TAREFAS");
    assert.equal(rev.totalTasks, 0);
    assert.equal(rev.completionRate, 0);
  });

  it("2. Plano com tarefas inicia com status EM_REVISAO", () => {
    const rev = service.buildGuidedRevision(mockPlan);
    assert.equal(rev.status, "EM_REVISAO");
    assert.equal(rev.totalTasks, 3);
    assert.equal(rev.completedTasks, 0);
    assert.equal(rev.pendingTasks, 3);
    assert.equal(rev.completionRate, 0);
  });

  it("7. Ordena\u00E7\u00E3o preservada: HIGH -> MEDIUM -> LOW", () => {
    const rev = service.buildGuidedRevision(mockPlan);
    assert.equal(rev.tasks[0]!.priority, "HIGH");
    assert.equal(rev.tasks[1]!.priority, "MEDIUM");
    assert.equal(rev.tasks[2]!.priority, "LOW");
  });

  it("3 & 5. markTaskCompleted atualiza completed, completedAt e completionRate", () => {
    const rev = service.buildGuidedRevision(mockPlan);
    const targetTask = rev.tasks[0]!;
    
    assert.equal(targetTask.completed, false);
    assert.equal(targetTask.completedAt, undefined);

    service.markTaskCompleted(rev, targetTask.id);

    assert.equal(targetTask.completed, true);
    assert.ok(targetTask.completedAt); // ISODate
    assert.equal(rev.completedTasks, 1);
    assert.equal(rev.pendingTasks, 2);
    // completionRate = 1/3 * 100
    assert.equal(Math.round(rev.completionRate), 33);
  });

  it("4. markTaskPending remove completedAt e atualiza status", () => {
    const rev = service.buildGuidedRevision(mockPlan);
    const targetTask = rev.tasks[0]!;
    
    service.markTaskCompleted(rev, targetTask.id);
    assert.equal(rev.completedTasks, 1);

    service.markTaskPending(rev, targetTask.id);

    assert.equal(targetTask.completed, false);
    assert.equal(targetTask.completedAt, undefined);
    assert.equal(rev.completedTasks, 0);
  });

  it("6. Revis\u00E3o conclu\u00EDda muda status para REVISAO_CONCLUIDA", () => {
    const rev = service.buildGuidedRevision(mockPlan);

    // Marca todas completas
    for (const t of rev.tasks) {
      service.markTaskCompleted(rev, t.id);
    }

    assert.equal(rev.completedTasks, 3);
    assert.equal(rev.completionRate, 100);
    assert.equal(rev.status, "REVISAO_CONCLUIDA");
  });
});

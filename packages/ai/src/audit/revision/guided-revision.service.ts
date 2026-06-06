import { randomUUID } from "node:crypto";
import type { CorrectionPlan } from "../types/correction-plan.js";
import type { GuidedRevision, RevisionTask } from "./guided-revision.types.js";

export class GuidedRevisionService {
  /**
   * Constr\u00F3i a GuidedRevision a partir de um CorrectionPlan
   */
  public buildGuidedRevision(plan: CorrectionPlan): GuidedRevision {
    const tasks: RevisionTask[] = (plan.items || []).map(item => ({
      id: randomUUID(),
      code: item.code,
      priority: item.priority as "HIGH" | "MEDIUM" | "LOW",
      area: item.area,
      instruction: item.instruction,
      completed: false,
      completedAt: undefined,
    }));

    // Ordem: HIGH -> MEDIUM -> LOW (CorrectionPlanService j\u00E1 envia assim, 
    // mas for\u00E7amos a ordena\u00E7\u00E3o para manter a invari\u00E1vel de forma independente).
    const priorityWeights: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    tasks.sort((a, b) => priorityWeights[b.priority]! - priorityWeights[a.priority]!);

    const revision: GuidedRevision = {
      status: "DESCONHECIDO",
      totalTasks: tasks.length,
      completedTasks: 0,
      pendingTasks: tasks.length,
      completionRate: 0,
      tasks,
    };

    this.recalculateProgress(revision);
    return revision;
  }

  /**
   * Marca uma tarefa como conclu\u00EDda mutando a estrutura
   */
  public markTaskCompleted(revision: GuidedRevision, taskId: string): void {
    const task = revision.tasks.find(t => t.id === taskId);
    if (task && !task.completed) {
      task.completed = true;
      task.completedAt = new Date().toISOString();
      this.recalculateProgress(revision);
    }
  }

  /**
   * Marca uma tarefa como pendente (desfaz conclus\u00E3o) mutando a estrutura
   */
  public markTaskPending(revision: GuidedRevision, taskId: string): void {
    const task = revision.tasks.find(t => t.id === taskId);
    if (task && task.completed) {
      task.completed = false;
      task.completedAt = undefined;
      this.recalculateProgress(revision);
    }
  }

  /**
   * Recalcula contadores e status baseado no estado das tarefas
   */
  public recalculateProgress(revision: GuidedRevision): void {
    revision.totalTasks = revision.tasks.length;
    revision.completedTasks = revision.tasks.filter(t => t.completed).length;
    revision.pendingTasks = revision.totalTasks - revision.completedTasks;
    
    revision.completionRate = revision.totalTasks > 0 
      ? (revision.completedTasks / revision.totalTasks) * 100 
      : 0;

    if (revision.totalTasks === 0) {
      revision.status = "SEM_TAREFAS";
    } else if (revision.completedTasks === revision.totalTasks) {
      revision.status = "REVISAO_CONCLUIDA";
    } else {
      revision.status = "EM_REVISAO";
    }
  }
}

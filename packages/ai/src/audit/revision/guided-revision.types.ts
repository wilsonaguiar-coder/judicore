export interface RevisionTask {
  id: string;
  code: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  area: string;
  instruction: string;
  completed: boolean;
  completedAt?: string | undefined;
}

export interface GuidedRevision {
  status: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completionRate: number;
  tasks: RevisionTask[];
}

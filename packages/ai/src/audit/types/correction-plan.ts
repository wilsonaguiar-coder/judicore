export interface CorrectionItem {
  code: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  area: string;
  instruction: string;
}

export interface CorrectionPlan {
  status: string;
  items: CorrectionItem[];
}

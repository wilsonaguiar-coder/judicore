export interface FeedbackItem {
  code: string;
  title: string;
  explanation: string;
  suggestion?: string;
}

export interface FeedbackReport {
  status: string;
  score: number;
  summary: string;
  criticalFindings: FeedbackItem[];
  warnings: FeedbackItem[];
  strengths: string[];
}

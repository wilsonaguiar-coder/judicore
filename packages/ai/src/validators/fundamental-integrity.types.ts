export interface FundamentalIntegrityFinding {
  code: string;
  severity: "FATAL" | "WARNING";
  expression: string;
  excerpt: string;
  reason: string;
  suggestedFix: string;
}

// Tracker simples de tokens/casos para os integration tests reais com OpenAI.
//
// Lê limites de variáveis de ambiente (com defaults) e aborta a suíte se
// algum limite for ultrapassado. Não estima dólar — apenas tokens.

const DEFAULT_MAX_CASES = 10;
const DEFAULT_MAX_TOTAL_TOKENS = 200_000;

export interface CostLimits {
  maxCases: number;
  maxTotalTokens: number;
}

export function loadCostLimits(): CostLimits {
  const maxCases = Number.parseInt(process.env["JUDICORE_TEST_MAX_CASES"] ?? "", 10);
  const maxTokens = Number.parseInt(process.env["JUDICORE_TEST_MAX_TOKENS"] ?? "", 10);
  return {
    maxCases: Number.isFinite(maxCases) && maxCases > 0 ? maxCases : DEFAULT_MAX_CASES,
    maxTotalTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : DEFAULT_MAX_TOTAL_TOKENS,
  };
}

export interface CaseUsage {
  caseId: string;
  inputTokens: number;
  outputTokens: number;
}

export class CostTracker {
  private limits: CostLimits;
  private cases: CaseUsage[] = [];

  constructor(limits: CostLimits = loadCostLimits()) {
    this.limits = limits;
  }

  trackCase(caseId: string, inputTokens: number, outputTokens: number): void {
    this.cases.push({ caseId, inputTokens, outputTokens });
    console.log(
      `[cost-tracker] case=${caseId} input=${inputTokens} output=${outputTokens} ` +
        `total_cases=${this.cases.length}/${this.limits.maxCases} ` +
        `total_tokens=${this.totalTokens()}/${this.limits.maxTotalTokens}`,
    );
    if (this.cases.length > this.limits.maxCases) {
      throw new Error(
        `Cost limit excedido: ${this.cases.length} casos executados (máx ${this.limits.maxCases}).`,
      );
    }
    if (this.totalTokens() > this.limits.maxTotalTokens) {
      throw new Error(
        `Cost limit excedido: ${this.totalTokens()} tokens consumidos (máx ${this.limits.maxTotalTokens}).`,
      );
    }
  }

  totalTokens(): number {
    return this.cases.reduce((sum, c) => sum + c.inputTokens + c.outputTokens, 0);
  }

  totalCases(): number {
    return this.cases.length;
  }

  summary(): { cases: CaseUsage[]; totalTokens: number; totalCases: number; limits: CostLimits } {
    return {
      cases: [...this.cases],
      totalTokens: this.totalTokens(),
      totalCases: this.cases.length,
      limits: this.limits,
    };
  }
}

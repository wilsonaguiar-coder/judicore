import type { RewriteRequest, RewriteResult, RewriteProvider } from "./rewrite.types.js";

export class RewriteService {
  constructor(
    private readonly deepseekKey: string = process.env.DEEPSEEK_API_KEY || "",
    private readonly openaiKey: string = process.env.OPENAI_API_KEY || ""
  ) {}

  public async generateRewrittenDraft(request: RewriteRequest): Promise<RewriteResult> {
    const provider = request.provider || "DEEPSEEK";

    let rewrittenText = "";
    let usedProvider = provider;

    if (provider === "DEEPSEEK") {
      try {
        rewrittenText = await this.callDeepSeek(request);
      } catch (err) {
        try {
          rewrittenText = await this.callOpenAI(request);
          usedProvider = "OPENAI";
        } catch (fallbackErr) {}
      }
    } else if (provider === "OPENAI") {
      try {
        rewrittenText = await this.callOpenAI(request);
      } catch (err) {
        try {
          rewrittenText = await this.callDeepSeek(request);
          usedProvider = "DEEPSEEK";
        } catch (fallbackErr) {}
      }
    } else {
      throw new Error(`Provider opcional não suportado: ${provider}`);
    }

    if (!rewrittenText) {
      throw new Error("Erro controlado: Nenhum provider conseguiu gerar a reescrita.");
    }

    return {
      originalDraft: request.draft,
      rewrittenDraft: rewrittenText,
      taskId: request.task.id,
      provider: usedProvider,
      generatedAt: new Date().toISOString(),
      requiresHumanReview: true
    };
  }

  private buildPrompt(request: RewriteRequest): string {
    return `Objetivo: Aplicar apenas a correção indicada na peça fornecida.

Tarefa: ${request.task.code}
Correção Indicada: ${request.suggestion}

PROIBIDO:
- Mudar fatos
- Mudar provas
- Mudar pedidos
- Mudar resultado do julgamento
- Mudar valores
- Mudar datas
- Mudar partes
- Criar fundamentação nova
- Criar jurisprudência
- Criar legislação
- NUNCA Substituir original inteiramente com outro contexto

PERMITIDO:
- Inserir trecho faltante
- Completar dispositivo
- Completar fundamentação
- Eliminar contradição apontada

SAÍDA:
Retornar EXCLUSIVAMENTE o texto completo revisado da peça. Sem markdown extra ou saudações.

PEÇA ORIGINAL:
${request.draft}`;
  }

  private async callDeepSeek(request: RewriteRequest): Promise<string> {
    if (!this.deepseekKey) throw new Error("Missing DEEPSEEK_API_KEY");

    const prompt = this.buildPrompt(request);

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.deepseekKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Você é o reescritor restrito do JudiAudit." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek Error: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  private async callOpenAI(request: RewriteRequest): Promise<string> {
    if (!this.openaiKey) throw new Error("Missing OPENAI_API_KEY");

    const prompt = this.buildPrompt(request);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.openaiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é o reescritor restrito do JudiAudit." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI Error: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content?.trim() || "";
  }
}

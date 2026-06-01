import type { LegalClassification, ArgumentationMatrix } from "../pipeline/types.js";
import { PIECE_TEMPLATES, getJurisdicaoRules } from "../rules/legal_rules.js";

export function buildAuditPrompt(
  draft: string,
  classification: LegalClassification,
  matrix: ArgumentationMatrix,
): string {
  const rules = getJurisdicaoRules(classification.tipo_justica);
  const template = PIECE_TEMPLATES[classification.tipo_peca];
  const isCriminal = classification.tipo_justica === "CRIMINAL"
    || classification.assunto_principal.toLowerCase().includes("flagrante")
    || classification.assunto_principal.toLowerCase().includes("habeas")
    || classification.assunto_principal.toLowerCase().includes("criminal")
    || classification.assunto_principal.toLowerCase().includes("pris");

  return `Audite a peça jurídica abaixo com rigor técnico. Você é um juiz revisor sênior.

CONTEXTO DA PEÇA:
- Tipo: ${classification.tipo_peca}
- Justiça: ${classification.tipo_justica} (${rules.descricao})
- Regime: ${classification.regime_juridico ?? "geral"}
- Assunto: ${classification.assunto_principal}
- Matéria criminal detectada: ${isCriminal ? "SIM" : "NÃO"}

REGRAS APLICÁVEIS:
- Honorários: ${rules.honorarios_artigo}
- Artigos BLOQUEADOS: ${rules.artigos_bloqueados.join(", ") || "nenhum"}
- Proibições da peça: ${(template as unknown as { proibicoes?: readonly string[] }).proibicoes?.join(", ") ?? "nenhuma"}

TESES OBRIGATÓRIAS (verificar cobertura):
${matrix.teses.map((t, i) => `${i + 1}. ${t.pedido} → norma: ${t.norma}`).join("\n")}

PEÇA GERADA:
---
${draft.slice(0, 8000)}
---

Retorne SOMENTE um JSON válido com esta estrutura:
{
  "aprovada": true | false,
  "score": 0 a 100,
  "resumo": "avaliação geral em 1-2 frases",
  "erros": [
    {
      "tipo": "ARTIGO_ERRADO | JURISPRUDENCIA_INVENTADA | DIPLOMA_INCOMPATIVEL | ESTRUTURA_INCORRETA | TESE_AUSENTE | TERMO_PROIBIDO | PECA_GENERICA | LINGUAGEM_INCORRETA | OUTRO",
      "trecho": "trecho exato do texto com problema (max 100 chars)",
      "correcao": "o que deve ser corrigido",
      "severidade": "CRITICO | IMPORTANTE | SUGESTAO"
    }
  ]
}

CRITÉRIOS GERAIS:
- aprovada: true apenas se score >= 90 e nenhum erro CRITICO
- score: 100 = perfeito; -10 por erro CRITICO; -3 por IMPORTANTE; -1 por SUGESTAO
- CRITICO: erro jurídico grave e objetivo — artigo de regime/justiça errado, recurso incompatível, tribunal incompatível, jurisprudência inventada, estrutura completamente errada, mistura RPPS/RGPS, despacho com fundamentação de mérito
- IMPORTANTE: tese da matriz não coberta na peça, proibição violada, honorários com artigo errado
- SUGESTAO: preferência estilística, "poderia aprofundar tese", "poderia individualizar melhor fatos", ausência de jurisprudência quando a matriz não tinha jur associada, "poderia melhorar redação", "poderia detalhar pedidos"

ATENÇÃO — NÃO CLASSIFIQUE COMO CRITICO NEM IMPORTANTE:
- "Os fatos poderiam ser mais detalhados" → SUGESTAO
- "Ausência de menção a jurisprudência" quando nenhuma foi fornecida → SUGESTAO
- Qualquer preferência sobre estilo, tamanho ou completude → SUGESTAO
- "Poderia individualizar melhor" → SUGESTAO

VERIFICAÇÕES ESPECÍFICAS OBRIGATÓRIAS:

1. SENTENÇA com linguagem de habeas corpus:
   Se tipo_peca for SENTENCA, verifique se usa "concedo a ordem", "denego a ordem", "writ" — esses termos são de HC. Se detectado → CRITICO.

2. Habeas corpus com linguagem ordinária:
   Se o assunto menciona habeas corpus mas a peça usa "julgo procedente/improcedente" em vez de "concedo/denego a ordem" → CRITICO.

3. DECISÃO sem "É o relatório. Decido.":
   Se tipo_peca for DECISAO e a frase estiver ausente → IMPORTANTE.

4. DESPACHO com fundamentação excessiva:
   Se tipo_peca for DESPACHO e o texto contiver análise de mérito ou fundamentação jurídica extensa → CRITICO.

5. RECURSO sem impugnação específica:
   Se tipo_peca for RECURSO e não houver identificação da decisão recorrida → IMPORTANTE.

6. PETIÇÃO INICIAL absolutamente genérica:
   Se tipo_peca for PETICAO_INICIAL e não houver NENHUM fato concreto → IMPORTANTE. Fatos incompletos ou parciais → SUGESTAO.

7. Tese sem norma:
   Para cada tese da matriz, se não houver artigo de lei específico → IMPORTANTE.

8. Diploma incompatível:
   Se matéria criminal detectada e a peça usa diplomas civis sem menção ao CPP → CRITICO.

9. Honorários em matéria criminal:
   Se matéria criminal e a peça cita art. 85 CPC → CRITICO.

10. Linguagem de template não substituída:
    Se o texto contiver "[INSERIR", "[A DETERMINAR", "[PREENCHER", "[VERIFICAR" ou similares → SUGESTAO.

Retorne SOMENTE o JSON, sem texto adicional.`;
}

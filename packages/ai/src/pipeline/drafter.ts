import { getOpenAIClient, MODEL } from "../client.js";
import { buildSystemPrompt } from "../prompts.js";
import type { LegalClassification, LegalExtraction, ArgumentationMatrix, JurisprudenciaInput, GenerationMode } from "./types.js";
import { LEGAL_RULES, PIECE_TEMPLATES, APPEAL_RULES, TEMPLATE_MODEL_PROHIBITIONS } from "../rules/legal_rules.js";

function buildModeBlock(mode: GenerationMode): string {
  if (mode === "TEMPLATE_MODEL") {
    return `
⚠ MODO MODELO DE PEÇA — LEIA ANTES DE REDIGIR:
Esta geração não possui fatos suficientemente identificados para uma peça definitiva.
Gere um MODELO ESTRUTURADO com marcações de placeholder onde faltam dados concretos.

REGRAS ABSOLUTAS PARA ESTE MODO:
1. Use [INSERIR FATO ESPECÍFICO], [INSERIR NOME DA PARTE], [IDENTIFICAR TRIBUNAL], [DATA DO FATO], etc. onde não houver dados reais.
2. PROIBIDO usar qualquer linguagem decisória. NUNCA escreva:
   ${TEMPLATE_MODEL_PROHIBITIONS.map((p) => `"${p}"`).join(" | ")}
3. Substitua decisões por: "[INSERIR FUNDAMENTAÇÃO ESPECÍFICA]", "[ANALISAR PEDIDO CONCRETO]", "[PREENCHER CONFORME O CASO]"
4. O objetivo é gerar um MODELO REUTILIZÁVEL — não uma decisão aparentemente válida sobre fatos inexistentes.
5. Inclua no início da peça a seguinte nota: "⚠ MODELO ESTRUTURAL — Preencha os campos entre colchetes com os dados reais do caso antes de usar."

`;
  }

  if (mode === "SAFE_SKELETON") {
    return `
⚠ MODO ESQUELETO SEGURO — LEIA ANTES DE REDIGIR:
A classificação do caso tem baixa confiança ou o caso está incompleto.
Gere apenas um ESQUELETO ESTRUTURAL — sem conteúdo jurídico afirmativo.

REGRAS ABSOLUTAS PARA ESTE MODO:
1. Cada seção deve conter apenas o título e um placeholder explicativo entre colchetes.
2. NUNCA use linguagem decisória, afirmativa ou conclusiva.
3. Use apenas: [A DETERMINAR], [VERIFICAR COMPETÊNCIA], [INSERIR FATOS DO CASO CONCRETO], [PREENCHER COM DADOS REAIS]
4. Inclua no início: "⚠ ATENÇÃO: Esta peça foi gerada sem informações suficientes para uma minuta real. Complete todos os campos antes de qualquer uso."
5. NÃO invente fatos, normas ou jurisprudência para preencher lacunas.

`;
  }

  return "";
}

function buildDraftPrompt(
  classification: LegalClassification,
  extraction: LegalExtraction,
  matrix: ArgumentationMatrix,
  jurisprudencias: JurisprudenciaInput[],
  instruction?: string,
  corrections?: string,
  mode: GenerationMode = "FINAL_DRAFT",
): string {
  const rules = LEGAL_RULES[classification.tipo_justica];
  const template = PIECE_TEMPLATES[classification.tipo_peca];
  const relevantJurs = jurisprudencias.filter((j) =>
    matrix.teses.some((t) => t.jurisprudencia_id === j.id),
  );

  const jurBlock = relevantJurs.length > 0
    ? `\nJURISPRUDÊNCIAS APROVADAS PARA USO (use SOMENTE estas, pelos dados reais abaixo):\n${relevantJurs.map((j) => `[${j.id}] ${j.tribunal} — ${j.numero} — Relator: ${j.relator ?? "N/I"} — Data: ${j.dataJulgamento ?? "N/I"}\nTese: ${j.tese}\nEmenta (resumo): ${j.ementa.slice(0, 300)}...`).join("\n\n")}`
    : "\nNenhuma jurisprudência aprovada para uso. NÃO mencione nenhuma decisão judicial.";

  const matrixBlock = `\nMATRIZ DE ARGUMENTAÇÃO (use como estrutura obrigatória):\n${matrix.teses.map((t, i) => `Tese ${i + 1}: ${t.pedido}\n  Fato: ${t.fato}\n  Norma: ${t.norma}\n  Jurisprudência: ${t.jurisprudencia_id ?? "nenhuma"}\n  Conclusão: ${t.conclusao}`).join("\n\n")}`;

  const appealInfo = classification.tipo_peca === "SENTENCA" && classification.tipo_justica in (APPEAL_RULES.SENTENCA as Record<string, unknown>)
    ? `\nRECURSO CABÍVEL: ${(APPEAL_RULES.SENTENCA as Record<string, { recurso: string }>)[classification.tipo_justica]?.recurso ?? "ver legislação"}`
    : "";

  const correctionsBlock = corrections
    ? `\n⚠ CORREÇÕES OBRIGATÓRIAS (aplique estritamente):\n${corrections}\nReescreva corrigindo APENAS estes pontos. Não altere fatos, partes nem pedidos.`
    : "";

  const templateProibicoes = (template as { proibicoes?: readonly string[] }).proibicoes ?? ([] as const);
  const prohibitions = [...templateProibicoes, ...rules.artigos_bloqueados];

  const estruturaInstrucao = (template as unknown as { estrutura?: readonly string[] }).estrutura
    ?.map((s, i) => `${i + 1}. ${s}`)
    .join("\n") ?? "";

  const modeBlock = buildModeBlock(mode);

  return `${modeBlock}Redija a peça jurídica com base na classificação, extração e matriz de argumentação abaixo.

CLASSIFICAÇÃO:
- Tipo: ${classification.tipo_peca}
- Justiça: ${classification.tipo_justica} (${rules.descricao})
- Regime: ${classification.regime_juridico ?? "geral"}
- Tribunal: ${classification.tribunal_competente}
- Grau: ${classification.grau}
- Assunto: ${classification.assunto_principal}
- Partes: Autor: ${classification.partes.autor} × Réu: ${classification.partes.reu}

FATOS DO CASO:
${extraction.fatos.map((f, i) => `${i + 1}. ${f}`).join("\n")}

PEDIDOS:
${extraction.pedidos.map((p, i) => `${i + 1}. ${p}`).join("\n")}
${matrixBlock}
${jurBlock}
${appealInfo}
${correctionsBlock}

ESTRUTURA OBRIGATÓRIA (siga esta ordem — estes são TÍTULOS DE SEÇÃO, NÃO os escreva literalmente no texto):
${estruturaInstrucao}

TOM: ${(template as unknown as { tom?: string }).tom ?? "técnico"}
PROIBIÇÕES ABSOLUTAS: ${prohibitions.join(" | ")}
HONORÁRIOS (se aplicável): ${rules.honorarios_artigo}

REGRA CRÍTICA PARA JURISPRUDÊNCIAS:
- Use SOMENTE as jurisprudências listadas acima com seus dados reais (tribunal, número, relator, data)
- NUNCA escreva "[JUR-1]", "[JUR-N]" ou qualquer rótulo no texto final
- Se não houver jurisprudência aprovada, não mencione nenhuma decisão judicial

${instruction ? `INSTRUÇÃO ADICIONAL DO USUÁRIO: ${instruction}` : ""}`;
}

export class LegalDraftService {
  async *draft(
    classification: LegalClassification,
    extraction: LegalExtraction,
    matrix: ArgumentationMatrix,
    jurisprudencias: JurisprudenciaInput[],
    onUsage?: (input: number, output: number) => void,
    instruction?: string,
    corrections?: string,
    mode: GenerationMode = "FINAL_DRAFT",
  ): AsyncGenerator<string> {
    const client = getOpenAIClient();
    const isPostulatorio = classification.tipo_peca === "PETICAO_INICIAL" || classification.tipo_peca === "RECURSO";

    const stream = await client.chat.completions.create({
      model: MODEL,
      max_tokens: isPostulatorio ? 16384 : 8192,
      temperature: mode === "SAFE_SKELETON" ? 0.3 : isPostulatorio ? 0.85 : 0.65,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: buildDraftPrompt(classification, extraction, matrix, jurisprudencias, instruction, corrections, mode),
        },
      ],
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      if (chunk.usage && onUsage) {
        onUsage(chunk.usage.prompt_tokens ?? 0, chunk.usage.completion_tokens ?? 0);
      }
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) yield text;
    }
  }
}

import type { GenerationMode } from "../pipeline/types.js";
import { TEMPLATE_MODEL_PROHIBITIONS } from "../rules/legal_rules.js";

export function buildModeBlock(mode: GenerationMode): string {
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

  return `
⚡ MODO FINAL_DRAFT — PEÇA JURIDICAMENTE DENSA
Você está gerando uma peça final. A fundamentação deve ser técnica, densa e específica.

CADA TESE deve ser desenvolvida em 3 a 5 parágrafos seguindo esta estrutura:
1. Enunciado claro da proposição jurídica
2. Norma aplicável (artigo + diploma — obrigatório)
3. Aplicação minuciosa ao fato concreto do caso
4. Enfrentamento da principal objeção possível
5. Conclusão diretamente vinculada ao pedido

PROIBIÇÕES ABSOLUTAS NESTE MODO (nunca escreva estas expressões):
— "direito alegado" | "matéria cível" | "pretensão da parte"
— "caso concreto" | "legislação aplicável" | "normas pertinentes"
— "reconhecimento do direito" | "direito material postulado"

Se algum dado específico faltar (nome, data, valor), use marcador SOMENTE naquele ponto — mas NÃO empobreça a fundamentação jurídica das teses disponíveis.

`;
}

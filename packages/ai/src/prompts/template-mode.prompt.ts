import type { GenerationMode } from "../pipeline/types.js";
import { TEMPLATE_MODEL_PROHIBITIONS } from "../rules/legal_rules.js";

export function buildModeBlock(mode: GenerationMode): string {
  if (mode === "TEMPLATE_MODEL") {
    return `
⚡ MODO MODELO ESTRUTURADO — dados parciais disponíveis

O caso forneceu informações parciais. Gere uma peça JURIDICAMENTE COMPLETA com placeholders obrigatórios para os dados ausentes.

REGRAS ABSOLUTAS (FASE 8.4.2-R):
1. PROIBIDO inventar, inferir ou estimar dados não fornecidos.
   NUNCA use nomes fictícios, datas aproximadas, valores estimados ou fatos não informados.
2. Onde faltarem dados concretos, use OBRIGATORIAMENTE placeholder entre colchetes:
   — Nome do autor: [AUTOR]
   — Nome do réu: [RÉU]
   — Número do processo: [PROCESSO]
   — CPF/RG: [CPF] / [RG]
   — Datas não fornecidas: [DATA]
   — Valores não informados: [VALOR DA CAUSA]
   — Qualquer dado ausente: [DADO NÃO FORNECIDO]
3. Desenvolva fundamentação jurídica completa com os dados disponíveis: norma → aplicação → conclusão.
4. Estrutura completa com todas as seções do tipo de peça.
5. Os placeholders entre colchetes devem ser preenchidos pelo usuário antes de qualquer uso.

`;
  }

  if (mode === "SAFE_SKELETON") {
    return `
⚡ MODO ESQUELETO SEGURO — informações mínimas

O caso tem informações mínimas. Gere uma peça ESTRUTURALMENTE COMPLETA com placeholders obrigatórios para todos os dados não fornecidos.

REGRAS ABSOLUTAS (FASE 8.4.2-R):
1. PROIBIDO inventar, inferir ou estimar dados não fornecidos.
   NUNCA use nomes fictícios, datas aproximadas, valores estimados ou fatos não informados.
2. Use OBRIGATORIAMENTE placeholders entre colchetes para dados ausentes:
   — [AUTOR], [RÉU], [PROCESSO], [DATA], [VALOR DA CAUSA], [FATOS DO CASO], [DADO NÃO FORNECIDO]
3. Fundamentação baseada nas normas aplicáveis ao tipo de caso identificado.
4. Estrutura completa: abertura, seção de fatos com placeholders, direito desenvolvido, pedidos.
5. Os placeholders entre colchetes devem ser preenchidos pelo usuário antes de qualquer uso.

`;
  }

  return `
⚡ MODO FINAL_DRAFT — PEÇA JURIDICAMENTE DENSA E PERSUASIVA

Você está em FINAL_DRAFT. Produza peça juridicamente robusta, densa e persuasiva. Não faça resumo. Não seja sintético. Desenvolva as teses em profundidade.

REGRA ABSOLUTA — DADOS NÃO FORNECIDOS (FASE 8.4.2-R):
Se um dado específico não foi fornecido pelo usuário: use OBRIGATORIAMENTE placeholder entre colchetes — NUNCA invente, estime ou infira.
  Exemplos: [AUTOR], [RÉU], [PROCESSO], [DATA], [VALOR DA CAUSA], [CPF], [CARGO], [DADO NÃO FORNECIDO]
EXCEÇÃO: jurisprudência — cite APENAS decisões fornecidas pelo sistema. Não invente números de processo.

Para PETICAO_INICIAL, a seção DO DIREITO deve conter no mínimo 6 subtópicos jurídicos, salvo impossibilidade material:
  I — competência e fundamento jurisdicional;
  II — regime jurídico aplicável;
  III — norma principal do direito pleiteado;
  IV — requisitos legais e sua aplicação ao caso concreto;
  V — resistência administrativa ou lesão ao direito;
  VI — efeitos financeiros e/ou prescrição;
  VII — tutela de urgência (obrigatório se houver natureza alimentar, previdenciária, de servidor, benefício, pensão, saúde ou verba remuneratória).

Cada subtópico: no mínimo 2 a 4 parágrafos com:
— tese jurídica clara;
— norma aplicável (artigo + diploma);
— aplicação precisa aos fatos fornecidos;
— possível objeção da parte contrária e resposta;
— conclusão vinculada a pedido específico.

CADA TESE da matriz deve ser desenvolvida em 3 a 5 parágrafos seguindo esta estrutura:
1. Enunciado claro da proposição jurídica
2. Norma aplicável (artigo + diploma — obrigatório)
3. Aplicação minuciosa ao fato concreto do caso
4. Enfrentamento da principal objeção possível
5. Conclusão diretamente vinculada ao pedido

PROIBIÇÕES ABSOLUTAS NESTE MODO (nunca escreva estas expressões):
— "direito alegado" | "matéria cível" | "pretensão da parte"
— "caso concreto" | "legislação aplicável" | "normas pertinentes"
— "reconhecimento do direito" | "direito material postulado"

`;
}

import type { GenerationMode } from "../pipeline/types.js";
import { TEMPLATE_MODEL_PROHIBITIONS } from "../rules/legal_rules.js";

export function buildModeBlock(mode: GenerationMode): string {
  if (mode === "TEMPLATE_MODEL") {
    return `
⚡ MODO GENÉRICO DESENVOLVIDO — dados parciais disponíveis

O caso forneceu informações parciais. Gere uma peça JURIDICAMENTE COMPLETA usando dados genéricos plausíveis onde necessário.

REGRAS ABSOLUTAS:
1. PROIBIDO COMPLETAMENTE: colchetes, placeholders, marcadores de ausência.
   Nunca escreva: [INSERIR], [NOME], [A DETERMINAR], [PREENCHER], [DATA], [VALOR], [VERIFICAR].
2. Onde faltarem dados concretos, use dados genéricos plausíveis:
   — Nomes: "João da Silva" (autor), "Empresa Ré Ltda." ou órgão público pertinente (réu)
   — Datas: datas aproximadas coerentes com o tipo de caso (ex: "em março de 2024")
   — Valores: valores redondos estimados (ex: "R$ 15.000,00")
3. Desenvolva fundamentação jurídica completa: norma → aplicação → conclusão.
4. Estrutura completa com todas as seções do tipo de peça.
5. AO FINAL DA PEÇA, após o fechamento e assinatura, inclua obrigatoriamente esta nota literal:
   "⚠ Peça gerada com dados genéricos por insuficiência de informações. Substitua nomes, datas, valores e fatos específicos pelos dados reais do caso antes de qualquer uso."

`;
  }

  if (mode === "SAFE_SKELETON") {
    return `
⚡ MODO GENÉRICO SIMPLIFICADO — informações mínimas

O caso tem informações mínimas. Gere uma peça JURIDICAMENTE DESENVOLVIDA, simples, com dados genéricos plausíveis.

REGRAS ABSOLUTAS:
1. PROIBIDO COMPLETAMENTE: colchetes, placeholders, marcadores de ausência.
   Nunca escreva: [INSERIR], [NOME], [A DETERMINAR], [PREENCHER], [VERIFICAR].
2. Use dados genéricos plausíveis para o tipo de caso identificado:
   — Nomes de partes fictícias mas verossímeis
   — Fatos genéricos típicos do assunto jurídico
   — Fundamentação baseada nas normas aplicáveis ao tipo de caso
3. Peça completa: abertura, fatos genéricos coerentes, direito desenvolvido, pedidos concretos.
4. AO FINAL DA PEÇA, após o fechamento e assinatura, inclua obrigatoriamente esta nota literal:
   "⚠ Peça gerada com dados genéricos por insuficiência de informações. Substitua nomes, datas, valores e fatos específicos pelos dados reais do caso antes de qualquer uso."

`;
  }

  return `
⚡ MODO FINAL_DRAFT — PEÇA JURIDICAMENTE DENSA E PERSUASIVA

Você está em FINAL_DRAFT. Produza peça juridicamente robusta, densa e persuasiva. Não faça resumo. Não seja sintético. Desenvolva as teses em profundidade.

PROIBIÇÃO ABSOLUTA — PLACEHOLDERS (FASE 5.4):
NUNCA use colchetes ou marcadores de ausência: [INSERIR], [A DETERMINAR], [NOME], [CPF], [VALOR], [DATA], [PREENCHER].
Se um dado específico não foi fornecido: use dado genérico plausível (nome fictício, data aproximada, valor estimado).
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

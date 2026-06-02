// Prompt específico para SENTENCA, com instruções por área jurídica.
// Injetado pelo drafter.prompt.ts quando classification.tipo_peca === "SENTENCA".

import type { LegalClassification } from "../pipeline/types.js";

function isCriminalHC(classification: LegalClassification): boolean {
  const assunto = classification.assunto_principal.toLowerCase();
  return (
    (classification.tipo_justica === "CRIMINAL" || classification.regime_juridico === "CRIMINAL") &&
    /habeas\s+corpus|\bhc\b/.test(assunto)
  );
}

function isCriminal(classification: LegalClassification): boolean {
  return classification.tipo_justica === "CRIMINAL" || classification.regime_juridico === "CRIMINAL";
}

function isTrabalhista(classification: LegalClassification): boolean {
  return classification.tipo_justica === "TRABALHO";
}

function isPrevidenciario(classification: LegalClassification): boolean {
  return (
    ["RPPS", "RGPS"].includes(classification.regime_juridico ?? "") ||
    classification.tipo_justica === "JEF" ||
    /aposentadoria|pens[aã]o|aux[ií]lio|bpc|previd/i.test(classification.assunto_principal)
  );
}

/**
 * Bloco específico de SENTENCA por área. Substitui parte do prompt do drafter
 * quando o tipo_peca é SENTENCA, garantindo estrutura, linguagem dispositiva
 * e recurso cabível corretos para cada área.
 */
export function buildSentencaPrompt(classification: LegalClassification): string {
  const baseRules = `
📜 ESTRUTURA OBRIGATÓRIA DA SENTENÇA (siga esta ordem):
  I — CABEÇALHO: número do processo, vara, partes, tribunal
  II — RELATÓRIO: síntese dos fatos, alegações das partes e provas produzidas (mínimo 2 parágrafos)
  III — FUNDAMENTAÇÃO: análise jurídica de cada tese, normas aplicáveis e jurisprudência selecionada (mínimo 4 parágrafos)
  IV — DISPOSITIVO: decisão final clara e individualizada por pedido
  V — CUSTAS E HONORÁRIOS: quando cabível
  VI — RECURSO CABÍVEL: indicar o recurso adequado e prazo

REGRAS GERAIS:
- Tom imparcial, técnico, em terceira pessoa (o juízo)
- NUNCA escrever "Excelentíssimo" — sentença não é endereçada
- O DISPOSITIVO deve resolver TODOS os pedidos formulados (procedência integral, parcial ou improcedência)
- Após o dispositivo, indicar o recurso cabível com fundamento (não usar fórmula genérica)
`;

  if (isCriminalHC(classification)) {
    return `${baseRules}
⚠ SENTENÇA EM HABEAS CORPUS — LINGUAGEM PROCESSUAL PENAL OBRIGATÓRIA:

ESTA É UMA SENTENÇA CRIMINAL EM HABEAS CORPUS — não é petição nem despacho.
Use APENAS os termos técnicos do mandamus abaixo.

DISPOSITIVO obrigatório usa expressões da técnica do mandamus:
  ✓ "CONCEDO A ORDEM" — para HC concessivo (liberta o paciente, tranca a ação penal, etc.)
  ✓ "DENEGO A ORDEM" — para HC denegado (mantém a constrição, indefere o pedido)
  ✓ "CONCEDO PARCIALMENTE A ORDEM" — para HC parcialmente provido
  O dispositivo deve indicar CLARAMENTE o efeito prático (ex: "determino a imediata expedição de alvará de soltura").

PROIBIDO em HC (uso causa REPROVAÇÃO automática):
  ✗ "julgo procedente" / "julgo improcedente" / "julgo parcialmente procedente"
  ✗ "ante o exposto, condeno" / "absolvo o réu" / "absolvo o paciente"
  ✗ tratar o paciente como "autor" ou "réu" (use "PACIENTE")
  ✗ tratar o impetrante como "autor" ou "requerente" (use "IMPETRANTE")
  ✗ tratar a autoridade impetrada como "réu" (use "AUTORIDADE COATORA")
  ✗ citar art. 85 CPC (não há honorários em HC nem em ação penal)

FUNDAMENTOS LEGAIS principais a citar:
  - art. 5º, LXVIII, CF/88 (cabimento do HC)
  - arts. 647 a 667 CPP (procedimento do habeas corpus)
  - art. 312 CPP se houver prisão preventiva discutida (fundamentos da preventiva)
  - art. 316 CPP se discutir reavaliação periódica da preventiva
  - Súmulas STF/STJ pertinentes ao caso concreto

RECURSO CABÍVEL (indicar obrigatoriamente):
  - Recurso em sentido estrito — art. 581, X, CPP — se HC denegado em primeira instância
  - Recurso Ordinário Constitucional — art. 102, II, "a", CF — se denegado por TJ/TRF em HC originário
  ✗ NUNCA "Apelação cível" ou "Recurso Ordinário Trabalhista"
`;
  }

  if (isCriminal(classification)) {
    return `${baseRules}
⚠ SENTENÇA CRIMINAL DE MÉRITO — LINGUAGEM PROCESSUAL PENAL OBRIGATÓRIA:

DISPOSITIVOS VÁLIDOS — use EXATAMENTE uma destas formas:
  ✓ CONDENAÇÃO:    "CONDENO o réu [NOME] pela prática do art. [X] à pena de [X] anos e [Y] meses de reclusão/detenção"
  ✓ ABSOLVIÇÃO:    "ABSOLVO o réu [NOME], da imputação do art. [X], com fundamento no art. 386, [INCISO], do CPP"
                   — o INCISO (I a VII) é OBRIGATÓRIO na absolvição
  ✓ PRESCRIÇÃO:    "DECLARO EXTINTA A PUNIBILIDADE do réu [NOME] pela prescrição da pretensão punitiva,
                   nos termos do art. 107, IV, c/c art. 109, [INCISO], do CP"
  ✓ DESCLASSIFICAÇÃO: "DESCLASSIFICO a conduta para o crime previsto no art. [X] do CP e
                   CONDENO/ABSOLVO o réu [NOME]..."

PROIBIDO em sentença penal (causa REPROVAÇÃO automática):
  ✗ "julgo procedente a denúncia" / "julgo improcedente a denúncia" / "procedente a pretensão punitiva"
  ✗ QUALQUER FORMA de "julgo procedente" ou "julgo improcedente" — essas são expressões CÍVEIS
  ✗ citar art. 85 CPC ou honorários sucumbenciais (inexistentes em processo penal)
  ✗ tratar o acusado como "réu civil" — use "RÉU" ou "ACUSADO" no contexto penal
  ✗ usar linguagem de ação ordinária civil em processo crime

ESTRUTURA DA ABSOLVIÇÃO:
  1. Relatório dos fatos imputados
  2. Análise da prova: materialidade e autoria
  3. Dispositivo: ABSOLVO + inciso do art. 386 CPP (ex: VI — insuficiência de provas)
  4. Custas: conforme art. 804 CPP (isenção se réu pobre)
  5. Recurso: Apelação Criminal (art. 593, I, CPP) — prazo 5 dias

ESTRUTURA DA CONDENAÇÃO:
  1. Materialidade e autoria — análise das provas
  2. Tipicidade — enquadramento no tipo penal
  3. Ilicitude / culpabilidade
  4. DOSIMETRIA EM 3 FASES OBRIGATÓRIAS (art. 68 CP):
     - 1ª fase: pena-base (art. 59 CP — fixar com análise das 8 circunstâncias judiciais)
     - 2ª fase: atenuantes (art. 65 CP) / agravantes (arts. 61-62 CP) — se houver
     - 3ª fase: causas de diminuição (-) / aumento (+) — se houver
     - Resultado: "Pena definitiva: X anos e Y meses de reclusão/detenção"
  5. REGIME INICIAL DE CUMPRIMENTO (art. 33 CP) — OBRIGATÓRIO:
     - Regime fechado / semiaberto / aberto (conforme pena e reincidência)
     - Citar fundamento: "art. 33, §2º, [a/b/c], do CP"
  6. Substituição (art. 44 CP) ou sursis (art. 77 CP) se cabível
  7. Detração: art. 387, §2º, CPP se houver prisão anterior
  8. Custas processuais

FUNDAMENTOS LEGAIS obrigatórios:
  - Tipo penal aplicado (CP ou lei extravagante)
  - art. 386 CPP (absolvição) ou art. 387 CPP (condenação)
  - arts. 59 e 68 CP (dosimetria — citar explicitamente)
  - art. 33 CP (regime inicial — citar explicitamente)

RECURSO CABÍVEL (indicar obrigatoriamente):
  ✓ APELAÇÃO CRIMINAL (art. 593, I, CPP) — prazo de 5 dias para interposição e 8 dias para razões
  ✗ NUNCA "Apelação cível", "Recurso Ordinário Trabalhista" ou "Recurso Inominado"
`;
  }

  if (isPrevidenciario(classification)) {
    return `${baseRules}
⚖ SENTENÇA PREVIDENCIÁRIA — REGRAS ESPECÍFICAS:

DISPOSITIVO:
  ✓ "JULGO PROCEDENTE" ou "JULGO PARCIALMENTE PROCEDENTE" ou "JULGO IMPROCEDENTE"
  ✓ Em caso de procedência, especificar:
    - Espécie do benefício (auxílio-doença, aposentadoria, pensão, BPC)
    - DIB (data de início do benefício) com fundamento (art. 49 da Lei 8.213/91 — DER ou cessação indevida)
    - Valor mensal com base na RMI
    - Pagamento de atrasados com correção monetária e juros legais (art. 1º-F Lei 9.494/97 ou tema 810 STF)

REGIME APLICÁVEL — VERIFIQUE:
  - RPPS (servidor público) → art. 40 CF/88, NÃO art. 201
  - RGPS (segurado INSS) → art. 201 CF/88 + Lei 8.213/91, NÃO art. 40 CF
  - JEF (juizado especial federal) → Lei 10.259/01, alçada 60 SM, Recurso Inominado

FUNDAMENTOS LEGAIS principais:
  - art. 201 CF/88 (RGPS) ou art. 40 CF/88 (RPPS)
  - Lei 8.213/91 (RGPS — benefícios)
  - Lei 8.742/93 (BPC/LOAS)
  - Súmulas TNU/STJ pertinentes

CUSTAS E HONORÁRIOS:
  - INSS isento de custas em primeira instância (art. 4º Lei 9.289/96)
  - Honorários: art. 85, §3º CPC ou Súmula 111 STJ (apenas sobre as prestações vencidas até a sentença)

RECURSO CABÍVEL:
  - Justiça Federal comum: APELAÇÃO (art. 1.009 CPC) ao TRF — prazo 15 dias úteis
  - JEF: RECURSO INOMINADO (art. 42 Lei 9.099/95) à Turma Recursal — prazo 10 dias
`;
  }

  if (isTrabalhista(classification)) {
    return `${baseRules}
⚙ SENTENÇA TRABALHISTA — REGRAS ESPECÍFICAS:

DISPOSITIVO:
  ✓ "JULGO PROCEDENTE / IMPROCEDENTE / PARCIALMENTE PROCEDENTE" os pedidos
  ✓ Em procedência, individualizar verbas devidas:
    - Horas extras + reflexos
    - Adicionais (insalubridade, periculosidade, noturno)
    - Verbas rescisórias
    - FGTS e contribuições previdenciárias

REGRAS CRÍTICAS:
  ✗ NUNCA citar art. 85 CPC para honorários (use art. 791-A CLT)
  ✗ Recurso cabível NÃO É apelação (use Recurso Ordinário — art. 895 CLT)
  ✗ NÃO mencionar STJ como instância superior (é o TST)

FUNDAMENTOS LEGAIS principais:
  - CLT (artigos pertinentes ao pedido)
  - Constituição (art. 7º e demais)
  - Súmulas TST e OJ SDI-1

CUSTAS:
  - Custas processuais conforme art. 789 CLT
  - Honorários sucumbenciais: art. 791-A CLT (5% a 15%)
  - Benefício da gratuidade: art. 790, §3º CLT

RECURSO CABÍVEL:
  - RECURSO ORDINÁRIO (art. 895 CLT) ao TRT — prazo 8 dias
  - Recurso de Revista (art. 896 CLT) só do acórdão do TRT ao TST
`;
  }

  // Fallback: cível geral
  return `${baseRules}
📋 SENTENÇA CÍVEL — REGRAS GERAIS:

DISPOSITIVO:
  ✓ "JULGO PROCEDENTE / IMPROCEDENTE / PARCIALMENTE PROCEDENTE"
  ✓ Resolver TODOS os pedidos individualmente
  ✓ Indicar art. 487, I (mérito) ou art. 485 (sem mérito) do CPC

CUSTAS E HONORÁRIOS:
  - art. 85 CPC (regra geral — 10% a 20% sobre valor da condenação ou da causa)
  - Sucumbência recíproca: art. 86 CPC

RECURSO CABÍVEL:
  - APELAÇÃO (art. 1.009 CPC) — prazo 15 dias úteis
`;
}

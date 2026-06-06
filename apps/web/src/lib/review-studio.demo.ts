/**
 * review-studio.demo.ts
 *
 * Documento fictício de demonstração para o Review Studio.
 * Ativado automaticamente quando id === "teste-1".
 *
 * Contém deliberadamente:
 *  - pedido principal
 *  - pedido subsidiário
 *  - contradição simples (fundamentação nega dano moral, dispositivo condena)
 *  - omissão de fundamentação (nexo causal não analisado)
 */

export const DEMO_DOCUMENT_ID = "teste-1";

export const DEMO_DRAFT = `
SENTENÇA

Vistos e examinados os presentes autos de ação de indenização por danos morais e materiais, ajuizada por JOÃO DA SILVA em face de BANCO EXEMPLO S/A.

RELATÓRIO

O autor narra que em 20 de março de 2024, verificou indevidamente cobrado em seu extrato bancário o valor de R$ 350,00 referente a serviço que não contratou. Após diversas tentativas de resolução extrajudicial sem êxito, propõe a presente ação postulando:

PEDIDO PRINCIPAL: devolução em dobro do valor cobrado indevidamente (R$ 700,00) com fundamento no art. 42, parágrafo único do CDC;

PEDIDO SUBSIDIÁRIO: caso não reconhecida a devolução em dobro, requer ao menos a devolução simples do valor (R$ 350,00) com correção monetária;

PEDIDO DE DANO MORAL: indenização por danos morais no importe de R$ 5.000,00 em razão do abalo psicológico e constrangimento sofridos.

A ré contestou alegando que a cobrança foi regular, decorrente de serviço contratado pelo autor via aplicativo.

FUNDAMENTAÇÃO

Da análise dos documentos acostados, verifica-se que a ré não apresentou prova do contrato de prestação de serviço. O extrato bancário demonstra a cobrança e o autor nega categoricamente ter contratado o serviço. Aplicável o Código de Defesa do Consumidor por se tratar de relação de consumo.

Quanto ao dano moral, entendo que a mera cobrança indevida, sem maiores consequências documentadas, configura mero aborrecimento do cotidiano, insuficiente para caracterizar dano moral indenizável. Não há prova de abalo concreto à honra ou dignidade do autor.

DISPOSITIVO

Ante o exposto, JULGO PARCIALMENTE PROCEDENTES os pedidos para CONDENAR o réu a:

a) pagar ao autor o valor de R$ 700,00 a título de devolução em dobro da cobrança indevida, corrigido monetariamente pelo IPCA-E desde a cobrança e acrescido de juros de mora de 1% ao mês desde a citação;

b) pagar ao autor indenização por danos morais no valor de R$ 3.000,00, corrigidos monetariamente pelo IPCA-E a partir desta data.

Condeno a ré ao pagamento de honorários advocatícios fixados em 15% sobre o valor da condenação.

P.R.I.
`;

export const DEMO_METADATA = {
  title: "Ação Indenizatória — João da Silva × Banco Exemplo S/A",
  area: "CONSUMIDOR",
  tribunal: "TJSP",
  knownIssues: [
    "Contradição: fundamentação afasta dano moral, dispositivo condena por dano moral",
    "Omissão: nexo causal não analisado explicitamente",
    "Fundamentação do quantum do dano moral ausente",
  ],
};

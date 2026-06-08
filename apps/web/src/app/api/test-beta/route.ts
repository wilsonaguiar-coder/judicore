import { NextResponse } from "next/server";
import { GenerationPipeline } from "@judicore/ai";
import { prisma } from "@judicore/db";

const USER_ID = "cmosstzkf00007w17jjo10cwo";

const CASOS = [
  {
    id: 1,
    pieceType: "Petição Inicial",
    userOrientation: "Redigir petição inicial previdenciária pleiteando aposentadoria especial por exposição habitual a ruído acima de 85dB durante 25 anos. O autor trabalhou como operador de máquinas em metalúrgica. Possui PPP e LTCAT atestando a exposição. Requer reconhecimento do período especial e concessão da aposentadoria especial com 25 anos de trabalho insalubre.",
    doc: "Autor: Carlos Eduardo Ferreira, CPF 987.654.321-00, RG 12.345.678-9, residente na Av. Industrial, 500, São Paulo, SP, CEP 01310-100. Trabalhou na empresa Metalúrgica Progresso Ltda de 01/03/1995 a 01/03/2020 (25 anos) como Operador de Máquinas. PPP emitido pela empresa atesta exposição a ruído de 92dB sem EPI eficaz. LTCAT de 2019 confirma exposição habitual e permanente a agente nocivo ruído acima de 85dB. INSS indeferiu o pedido alegando que os EPIs neutralizavam a nocividade."
  },
  {
    id: 2,
    pieceType: "Contrarrazões",
    userOrientation: "Redigir contrarrazões previdenciárias em face de recurso do INSS que questiona tempo de contribuição já incontroverso reconhecido em sentença de primeiro grau transitada em julgado. O INSS recorre apenas quanto à RMI. Pugnar pelo improvimento do recurso e manutenção integral da sentença.",
    doc: "Processo nº 5001234-56.2022.4.03.6100. Sentença proferida em 15/04/2024 julgou procedente o pedido de Ana Paula Souza, CPF 111.222.333-44, reconhecendo 32 anos de contribuição e determinando a concessão de aposentadoria por tempo de contribuição com RMI de R$ 3.200,00. O INSS interpôs recurso em 10/05/2024 apenas quanto à RMI, não contestando o tempo de contribuição. A autora reside na Rua das Palmeiras, 200, Campinas, SP, CEP 13000-000."
  },
  {
    id: 3,
    pieceType: "Contestação",
    userOrientation: "Redigir contestação em ação de indenização por dano moral decorrente de negativação indevida do nome do autor no SPC e Serasa. A empresa ré alega que a dívida existe. Entretanto, o autor demonstra que quitou o débito em janeiro de 2024 e a negativação permaneceu por mais 8 meses. Contestar o valor pleiteado de R$ 30.000,00 como excessivo e pugnar pela improcedência ou redução do quantum.",
    doc: "Ré: Financeira Crédito Fácil S.A., CNPJ 00.111.222/0001-33. Autor: Roberto Alves Lima, CPF 444.555.666-77. A dívida de R$ 1.200,00 foi quitada em 15/01/2024 conforme comprovante de pagamento. A negativação permaneceu até 20/09/2024. O autor pleiteia R$ 30.000,00 a título de danos morais. Não houve contato prévio da empresa com o autor para comunicar a negativação."
  },
  {
    id: 4,
    pieceType: "Sentença",
    userOrientation: "Redigir sentença previdenciária julgando procedente pedido de auxílio por incapacidade temporária (antigo auxílio-doença). O laudo pericial atesta incapacidade total e temporária para atividade habitual por prazo de 180 dias. O INSS havia indeferido administrativamente alegando capacidade laborativa. Condenar o INSS a implantar o benefício e pagar parcelas retroativas.",
    doc: "Processo nº 5009876-54.2023.4.03.6200. Autor: Marcos Vinícius Costa, CPF 555.666.777-88. Perito judicial Dr. João Rodrigues, CRM 12345, atestou em 10/10/2024 incapacidade total e temporária para atividade de motorista profissional por 180 dias, em razão de hérnia de disco L4-L5 diagnosticada em março de 2024. DII (Data de Início da Incapacidade): 05/03/2024. Requerimento administrativo negado pelo INSS em 01/04/2024."
  },
  {
    id: 5,
    pieceType: "Decisão Interlocutória",
    userOrientation: "Redigir decisão interlocutória apreciando pedido de tutela de urgência em ação previdenciária. O autor idoso de 78 anos está sem receber aposentadoria por erro administrativo do INSS há 3 meses. Demonstrou fumus boni iuris e periculum in mora. Deferir a tutela de urgência determinando ao INSS a imediata implantação do benefício.",
    doc: "Processo nº 5005555-11.2024.4.03.6300. Autor: José Benedito Ferreira, 78 anos, CPF 222.333.444-55, aposentado por tempo de contribuição desde 2015. O INSS suspendeu o pagamento da aposentadoria em agosto de 2024 por suposto erro cadastral. O autor apresentou documentação comprobatória. Está sem renda há 3 meses. Reside na Rua do Amparo, 89, São Paulo, SP."
  }
];

export async function GET() {
  const results: any[] = [];

  for (const caso of CASOS) {
    try {
      const start = Date.now();
      const result = await GenerationPipeline.execute({
        userId: USER_ID,
        pieceType: caso.pieceType,
        userOrientation: caso.userOrientation,
        files: [{
          buffer: Buffer.from(caso.doc),
          mimeType: "text/plain",
          category: "Documentos do Caso"
        }]
      });
      const elapsed = Date.now() - start;

      const gen = await prisma.pieceGeneration.findUnique({
        where: { id: result.generationId }
      });

      results.push({
        caso: caso.id,
        pieceType: caso.pieceType,
        generationId: result.generationId,
        draft: result.draft,
        chars: result.draft.length,
        inputTokensGpt: gen?.inputTokensGpt,
        outputTokensGpt: gen?.outputTokensGpt,
        elapsedMs: elapsed
      });
    } catch (err: any) {
      results.push({ caso: caso.id, error: err.message });
    }
  }

  return NextResponse.json({ success: true, results });
}


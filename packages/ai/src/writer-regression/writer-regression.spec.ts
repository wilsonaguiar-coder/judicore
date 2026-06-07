import { WriterRegressionRunnerService } from "./writer-regression-runner.service.js";
import type { WriterRegressionScenario } from "./writer-regression.types.js";

describe("Writer Regression Scenarios (FASE 10.1.3)", () => {
  let runner: WriterRegressionRunnerService;

  beforeAll(() => {
    runner = new WriterRegressionRunnerService();
  });

  const scenarios: WriterRegressionScenario[] = [
    // ==================================================
    // GRUPO A — DECISION INTENT LOCK
    // ==================================================
    {
      id: "A1",
      group: "DECISION_INTENT_LOCK",
      description: "Pede IMPROCEDENCIA, gera PROCEDENCIA",
      input: {
        draft: "Diante do exposto, julgo PROCEDENTE o pedido.",
        classification: { tipo_peca: "SENTENCA" },
        decidedOutcome: "IMPROCEDENTE",
      },
      expectedResult: "BLOCKED",
    },
    {
      id: "A2",
      group: "DECISION_INTENT_LOCK",
      description: "Pede PROCEDENCIA, gera IMPROCEDENCIA",
      input: {
        draft: "Isto posto, julgo totalmente improcedente a demanda.",
        classification: { tipo_peca: "SENTENCA" },
        decidedOutcome: "PROCEDENTE",
      },
      expectedResult: "BLOCKED",
    },
    {
      id: "A3",
      group: "DECISION_INTENT_LOCK",
      description: "Pede PARCIAL PROCEDENCIA, gera PROCEDENCIA TOTAL",
      input: {
        draft: "Julgo procedente o pedido para condenar em tudo.",
        classification: { tipo_peca: "SENTENCA" },
        decidedOutcome: "PARCIALMENTE_PROCEDENTE",
      },
      expectedResult: "BLOCKED",
    },
    {
      id: "A4",
      group: "DECISION_INTENT_LOCK",
      description: "Pede HOMOLOGACAO, gera EXTINCAO SEM RESOLUCAO",
      input: {
        draft: "Julgo extinto o processo sem resolução de mérito, com fulcro no art. 485.",
        classification: { tipo_peca: "SENTENCA" },
        decidedOutcome: "HOMOLOGACAO",
      },
      expectedResult: "BLOCKED",
    },

    // ==================================================
    // GRUPO B — FUNDAMENTAL INTEGRITY
    // ==================================================
    {
      id: "B1",
      group: "FUNDAMENTAL_INTEGRITY",
      description: "'Restou comprovado' sem premissa",
      input: {
        draft: "Apenas alegou fatos. Sendo assim, restou comprovado o direito. Julgo procedente.",
        classification: { tipo_peca: "SENTENCA" },
      },
      expectedResult: "FATAL",
    },
    {
      id: "B2",
      group: "FUNDAMENTAL_INTEGRITY",
      description: "'Todos os requisitos foram preenchidos' sem suporte",
      input: {
        draft: "O autor ajuizou a presente demanda. Todos os requisitos foram preenchidos. Defiro.",
        classification: { tipo_peca: "DECISAO" },
      },
      expectedResult: "FATAL",
    },
    {
      id: "B3",
      group: "FUNDAMENTAL_INTEGRITY",
      description: "'A documentação comprova' sem documento",
      input: {
        draft: "Sabe-se que a documentação comprova o alegado. Diante disso, condeno.",
        classification: { tipo_peca: "SENTENCA" },
      },
      expectedResult: "FATAL",
    },
    {
      id: "B4",
      group: "FUNDAMENTAL_INTEGRITY",
      description: "CNIS + DER + datas + conclusão -> PASS",
      input: {
        draft: "Analisando o CNIS do autor, observa-se vínculos até a DER em 15/05/2023. Logo, restou comprovado o tempo.",
        classification: { tipo_peca: "SENTENCA" },
      },
      expectedResult: "PASS",
    },
    {
      id: "B5",
      group: "FUNDAMENTAL_INTEGRITY",
      description: "Laudo pericial + incapacidade + conclusão -> PASS",
      input: {
        draft: "Conforme laudo pericial anexado, o autor apresenta incapacidade laborativa total. Ficou demonstrado o requisito.",
        classification: { tipo_peca: "SENTENCA" },
      },
      expectedResult: "PASS",
    },

    // ==================================================
    // GRUPO C — CONTRADIÇÕES ESTRUTURAIS
    // ==================================================
    {
      id: "C1",
      group: "STRUCTURAL_CONTRADICTIONS",
      description: "Prescrição reconhecida + Condenação",
      input: {
        draft: "Acolho a prejudicial de prescrição quinquenal. Dispositivo: diante do exposto, julgo procedente para condenar.",
        classification: { tipo_peca: "SENTENCA" },
      },
      expectedResult: "BLOCKED",
    },
    {
      id: "C2",
      group: "STRUCTURAL_CONTRADICTIONS",
      description: "Ilegitimidade reconhecida + Análise de mérito",
      input: {
        draft: "Acolho a preliminar de ilegitimidade passiva. No mérito, verifico que a parte tem razão. Julgo procedente.",
        classification: { tipo_peca: "SENTENCA" },
      },
      expectedResult: "BLOCKED",
    },
    {
      id: "C3",
      group: "STRUCTURAL_CONTRADICTIONS",
      description: "Coisa julgada reconhecida + Procedência",
      input: {
        draft: "Verifica-se a ocorrência de coisa julgada. Isto posto, julgo procedente o pedido principal.",
        classification: { tipo_peca: "SENTENCA" },
      },
      expectedResult: "BLOCKED",
    },
    {
      id: "C4",
      group: "STRUCTURAL_CONTRADICTIONS",
      description: "Insuficiência probatória + Condenação criminal",
      input: {
        draft: "Relatório: ... Fundamentação: As provas são insuficientes para a condenação, aplicando-se o in dubio pro reo. Diante do exposto, condeno o réu.",
        classification: { tipo_peca: "SENTENCA", tipo_justica: "CRIMINAL" },
      },
      expectedResult: "BLOCKED",
    },
    {
      id: "C5",
      group: "STRUCTURAL_CONTRADICTIONS",
      description: "Autoria comprovada + Absolvição",
      input: {
        draft: "Relatório: ... Fundamentação: A autoria e materialidade estão plenamente demonstradas pelo laudo e depoimento. Diante do exposto, absolvo o réu.",
        classification: { tipo_peca: "SENTENCA", tipo_justica: "CRIMINAL" },
      },
      expectedResult: "BLOCKED",
    },

    // ==================================================
    // GRUPO D — JURISPRUDÊNCIA
    // ==================================================
    {
      id: "D1",
      group: "JURISPRUDENCE",
      description: "Precedente citado para tese incompatível (inversão forçada)",
      input: {
        draft: "Como se vê no precedente: 'A conduta configura ato ilícito'. Por isso, não houve ato ilícito.",
        classification: { tipo_peca: "SENTENCA" },
        jurisprudencias: [{ id: "j1", ementa: "A conduta configura ato ilícito", tribunal: "STJ", tema: "", numero: "", tese: "" }],
      },
      expectedResult: "FATAL",
    },
    {
      id: "D2",
      group: "JURISPRUDENCE",
      description: "Jurisprudência sem conexão temática",
      input: {
        draft: "Conforme jurisprudência de Direito Previdenciário (benefício concedido), julgo procedente a adoção.",
        classification: { tipo_peca: "SENTENCA", assunto_principal: "Adoção" },
        jurisprudencias: [{ id: "j1", ementa: "Concessão de auxílio-doença.", tribunal: "TRF", tema: "Previdenciário", numero: "", tese: "auxílio" }],
      },
      expectedResult: "WARNING",
    },
    {
      id: "D3",
      group: "JURISPRUDENCE",
      description: "Precedente corretamente aplicado",
      input: {
        draft: "Conforme jurisprudência sobre dano moral: 'Configura dano moral o atraso'. O atraso ocorreu, logo há dano moral.",
        classification: { tipo_peca: "SENTENCA", assunto_principal: "Dano moral" },
        jurisprudencias: [{ id: "j1", ementa: "Configura dano moral o atraso em voo.", tribunal: "STJ", tema: "Dano Moral", numero: "123", tese: "Dano moral por atraso" }],
      },
      expectedResult: "PASS",
    },

    // ==================================================
    // GRUPO E — PLACEHOLDERS
    // ==================================================
    {
      id: "E1",
      group: "PLACEHOLDERS",
      description: "[AUTOR]",
      input: {
        draft: "O autor [NOME DO AUTOR] ajuizou a ação.",
        classification: { tipo_peca: "SENTENCA" },
      },
      expectedResult: "BLOCKED",
    },
    {
      id: "E2",
      group: "PLACEHOLDERS",
      description: "[VARA]",
      input: {
        draft: "Excelentíssimo Juiz da [VARA] Cível.",
        classification: { tipo_peca: "PETICAO_INICIAL" },
      },
      expectedResult: "BLOCKED",
    },
    {
      id: "E3",
      group: "PLACEHOLDERS",
      description: "[DATA]",
      input: {
        draft: "São Paulo, [DATA].",
        classification: { tipo_peca: "RECURSO" },
      },
      expectedResult: "BLOCKED",
    },
    {
      id: "E4",
      group: "PLACEHOLDERS",
      description: "Documento completamente preenchido",
      input: {
        draft: "São Paulo, 10 de maio de 2024. O autor João ajuizou ação na 1ª Vara.",
        classification: { tipo_peca: "PETICAO_INICIAL" },
      },
      expectedResult: "PASS",
    },

    // ==================================================
    // GRUPO F — FATOS INVENTADOS
    // ==================================================
    {
      id: "F1",
      group: "FICTITIOUS_FACTS",
      description: "Nome de parte inexistente (fulano de tal)",
      input: {
        draft: "O Sr. Fulano de Tal requereu o benefício.",
        classification: { tipo_peca: "SENTENCA" },
      },
      expectedResult: "FATAL",
    },
    {
      id: "F2",
      group: "FICTITIOUS_FACTS",
      description: "Documento afirma existência de laudo inexistente (fictício)",
      input: {
        draft: "Conforme o CRM 123456 ou laudo fictício...",
        classification: { tipo_peca: "SENTENCA" },
      },
      expectedResult: "FATAL",
    },
    {
      id: "F3",
      group: "FICTITIOUS_FACTS",
      description: "Documento afirma existência de contrato inexistente (dados fake)",
      input: {
        draft: "Assinou o contrato com CNPJ 00.000.000/0000-00.",
        classification: { tipo_peca: "SENTENCA" },
      },
      expectedResult: "FATAL",
    },

    // ==================================================
    // GRUPO G — RECURSOS
    // ==================================================
    {
      id: "G1",
      group: "APPEALS",
      description: "Recurso sem impugnação da decisão recorrida (não ataca a sentença)",
      input: {
        // Texto que o AppealValidator já reprova: quando não menciona "reforma da sentença/decisão" 
        // e não ataca os fundamentos.
        draft: "Egrégio Tribunal, o autor requer a condenação do réu em danos morais porque sofreu muito.",
        classification: { tipo_peca: "RECURSO" },
      },
      expectedResult: "BLOCKED",
    },
    {
      id: "G2",
      group: "APPEALS",
      description: "Recurso apenas repete petição inicial (falta de dialeticidade)",
      input: {
        // O AppealValidator reprova por falta de dialeticidade se não menciona a decisão a quo.
        draft: "Nesta apelação, repito o que disse na inicial: houve falha no serviço e quero danos morais. Deferimento.",
        classification: { tipo_peca: "RECURSO" },
      },
      expectedResult: "BLOCKED",
    },
    {
      id: "G3",
      group: "APPEALS",
      description: "Recurso enfrenta fundamentos da sentença",
      input: {
        draft: "A sentença de fls. 10 merece reforma. O juiz a quo errou ao julgar improcedente por falta de provas, pois há laudo claro. Requer a reforma da decisão.",
        classification: { tipo_peca: "RECURSO" },
      },
      expectedResult: "PASS",
    },
  ];

  it("deve passar por todos os cenários sem regressões", () => {
    const summary = runner.runScenarios(scenarios);
    
    // Log para facilitar debug caso algo falhe
    if (summary.failed > 0) {
      const failures = summary.results.filter(r => !r.passed);
      console.error("Scenarios failed:", JSON.stringify(failures, null, 2));
    }

    expect(summary.failed).toBe(0);
    expect(summary.totalScenarios).toBe(27);
  });
});

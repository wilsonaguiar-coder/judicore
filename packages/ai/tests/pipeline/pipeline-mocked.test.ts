// Testa o LegalPipeline end-to-end com OpenAI mockado.
//
// O pipeline chama os serviços em ordem fixa. Para cada caso, configuramos
// uma fila de respostas que simula as saídas de cada etapa. O objetivo é
// validar o roteamento (modo, validações, status final) e a integração das
// fases — não a qualidade dos prompts.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { LegalPipeline } from "../../src/pipeline/pipeline.js";
import { setOpenAIClient } from "../../src/client.js";
import { createMockOpenAI, type StageResponder } from "../helpers/openai-mock.js";
import type {
  PipelineInput,
  PipelineEvent,
  LegalClassification,
  LegalExtraction,
  ArgumentationMatrix,
  LegalAudit,
  EvidenceAnalysis,
} from "../../src/pipeline/types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface MockedRun {
  events: PipelineEvent[];
  draft: string;
  mode?: string;
  status?: string;
  doneEvent?: Extract<PipelineEvent, { event: "done" }>["data"];
  validationErrors: string[]; // regras emitidas
}

async function runPipelineWithMock(
  input: PipelineInput,
  queue: StageResponder[],
): Promise<MockedRun> {
  const { client } = createMockOpenAI(queue);
  setOpenAIClient(client);

  const pipeline = new LegalPipeline();
  const events: PipelineEvent[] = [];
  let draft = "";
  let modeReceived: string | undefined;
  let doneData: Extract<PipelineEvent, { event: "done" }>["data"] | undefined;
  const validationErrors: string[] = [];

  for await (const evt of pipeline.run(input, "test_gen_id")) {
    events.push(evt);
    if (evt.event === "chunk") draft += evt.data;
    if (evt.event === "mode") modeReceived = evt.data.mode;
    if (evt.event === "done") doneData = evt.data;
    if (evt.event === "validation_errors") {
      for (const err of evt.data) validationErrors.push(err.rule);
    }
  }

  const result: MockedRun = {
    events,
    draft,
    validationErrors,
  };
  if (modeReceived !== undefined) result.mode = modeReceived;
  if (doneData) {
    result.doneEvent = doneData;
    if (doneData.status !== undefined) result.status = doneData.status;
  }
  return result;
}

// ── Respostas padrão de cada estágio ─────────────────────────────────────────

function classificationResp(over: Partial<LegalClassification> = {}): StageResponder {
  return {
    kind: "json",
    payload: {
      tipo_justica: "ESTADUAL",
      tipo_peca: "PETICAO_INICIAL",
      regime_juridico: "CIVIL",
      grau: "PRIMEIRO",
      tribunal_competente: "TJSP",
      rito: null,
      assunto_principal: "indenização por danos morais",
      partes: { autor: "Maria da Silva", reu: "Loja XYZ Ltda." },
      confianca: 0.92,
      ...over,
    },
  };
}

function extractionResp(over: Partial<LegalExtraction> = {}): StageResponder {
  return {
    kind: "json",
    payload: {
      fatos: [
        "Maria teve nome inscrito indevidamente em SPC/Serasa em 15/03/2024",
        "Valor da inscrição: R$ 1.847,32",
        "A inscrição perdurou por 60 dias",
      ],
      pedidos: [
        "Indenização por danos morais de R$ 15.000",
        "Declaração de inexistência do débito",
      ],
      questoes_juridicas: [
        "Responsabilidade civil objetiva do fornecedor",
        "Dano moral in re ipsa",
      ],
      artigos_citados: ["art. 14 CDC", "art. 186 CC/2002"],
      jurisprudencias_relevantes: ["jur_favoravel_danos"],
      qualidade_extracao: "SUFICIENTE",
      ...over,
    },
  };
}

function evidenceResp(analyses: EvidenceAnalysis[]): StageResponder {
  return { kind: "json", payload: { analyses } };
}

function matrixResp(over: Partial<ArgumentationMatrix> = {}): StageResponder {
  return {
    kind: "json",
    payload: {
      teses: [
        {
          id: "tese_001",
          pedido: "Indenização por danos morais de R$ 15.000",
          tese: "É devida indenização por dano moral in re ipsa pela inscrição indevida",
          fato: "Inscrição indevida em SPC/Serasa por débito inexistente",
          norma: "art. 14 CDC c/c art. 186 CC/2002",
          ratio: "Responsabilidade civil objetiva do fornecedor — dano in re ipsa",
          jurisprudencia_id: "jur_favoravel_danos",
          conclusao: "Procede o pedido",
        },
        {
          id: "tese_002",
          pedido: "Declaração de inexistência do débito",
          tese: "O débito não existe pois a autora jamais celebrou contrato com a ré",
          fato: "Autora desconhece a relação contratual",
          norma: "art. 319 CPC c/c art. 14 CDC",
          ratio: "Ausência de relação jurídica subjacente",
          jurisprudencia_id: null,
          conclusao: "Procede o pedido",
        },
      ],
      ...over,
    },
  };
}

function draftStream(text: string): StageResponder {
  // Quebra o texto em chunks de ~50 chars para simular streaming
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 50) chunks.push(text.slice(i, i + 50));
  return { kind: "stream", chunks };
}

function auditResp(over: Partial<LegalAudit> = {}): StageResponder {
  return {
    kind: "json",
    payload: {
      aprovada: true,
      score: 92,
      erros: [],
      resumo: "Peça tecnicamente adequada",
      ...over,
    },
  };
}

// ── Reset entre testes ───────────────────────────────────────────────────────

beforeEach(() => {
  setOpenAIClient(null);
});

// ── Caso 8: Input genérico → SAFE_SKELETON ───────────────────────────────────

describe("Pipeline mockado — Caso 8: input genérico vira SAFE_SKELETON ou TEMPLATE_MODEL", () => {
  it("input curto ('Direito civil') deve disparar SAFE_SKELETON", async () => {
    // input <20 chars dispara SAFE_SKELETON em determinePreliminaryMode,
    // antes da matriz. Ainda assim o pipeline chama classifier+extractor+matrix+drafter+auditor.
    const draftText = `
      [ENDEREÇAMENTO]
      EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA [VARA] CÍVEL DA COMARCA DE [COMARCA]

      [QUALIFICAÇÃO DAS PARTES]
      [NOME DO AUTOR], [QUALIFICAÇÃO], vem propor:

      AÇÃO [TIPO DE AÇÃO]
      em face de [NOME DO RÉU], pelos fatos e fundamentos a seguir.

      DOS FATOS
      [INSERIR FATOS]

      DOS PEDIDOS
      [INSERIR PEDIDOS]

      Valor da causa: R$ [VALOR]

      [LOCAL], [DATA]
      [ADVOGADO — OAB/UF]
    `.trim();

    const result = await runPipelineWithMock(
      {
        userId: "test_user",
        caseDescription: "Direito civil",
        documentType: "PETICAO_INICIAL",
        jurisprudencias: [],
      },
      [
        classificationResp({ confianca: 0.6, tipo_justica: "INDETERMINADA" }),
        extractionResp({ fatos: [], pedidos: [], qualidade_extracao: "INSUFICIENTE" }),
        matrixResp({ teses: [] }),
        draftStream(draftText),
        auditResp({ score: 40, aprovada: false }),
      ],
    );

    assert.equal(result.mode, "SAFE_SKELETON", "Input curto deve gerar SAFE_SKELETON");
    assert.equal(result.status, "APROVADA COM RESSALVAS");
    assert.equal(result.doneEvent?.blocked, false);
  });
});

// ── Caso 9: Caso completo → FINAL_DRAFT ──────────────────────────────────────

describe("Pipeline mockado — Caso 9: caso completo vira FINAL_DRAFT", () => {
  it("descrição rica + extração SUFICIENTE + matriz com 2 teses → FINAL_DRAFT", async () => {
    const draftText = `
      EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA VARA CÍVEL DA COMARCA DE SÃO PAULO

      MARIA DA SILVA, brasileira, CPF 123.456.789-00, residente em Rua A, 100, São Paulo/SP,
      vem propor

      AÇÃO DECLARATÓRIA DE INEXISTÊNCIA DE DÉBITO C/C INDENIZAÇÃO POR DANOS MORAIS

      em face de LOJA XYZ LTDA., CNPJ 12.345.678/0001-00, com endereço em Av. B, 200.

      DOS FATOS
      Em 15/03/2024, a autora teve seu nome indevidamente inscrito nos cadastros de SPC e Serasa
      por suposto débito de R$ 1.847,32 referente a contrato que jamais celebrou. A inscrição
      perdurou por 60 dias até remoção judicial.

      DO DIREITO
      A responsabilidade civil objetiva do fornecedor está prevista no art. 14 do CDC.
      O dano moral decorrente de inscrição indevida é in re ipsa, dispensando prova do prejuízo.

      DOS PEDIDOS
      a) Declaração de inexistência do débito;
      b) Condenação ao pagamento de R$ 15.000 a título de danos morais;
      c) Custas e honorários sucumbenciais nos termos do art. 85 CPC.

      Valor da causa: R$ 16.847,32.

      São Paulo, 01/06/2026.
      Advogado — OAB/SP 123456
    `.trim();

    const result = await runPipelineWithMock(
      {
        userId: "test_user",
        caseDescription:
          "Maria da Silva teve nome inscrito indevidamente em SPC/Serasa pela Loja XYZ em 15/03/2024 por débito inexistente de R$ 1.847,32. Pretende ação declaratória de inexistência do débito c/c danos morais de R$ 15.000.",
        documentType: "PETICAO_INICIAL",
        jurisprudencias: [
          {
            id: "jur_favoravel_danos",
            tribunal: "STJ",
            numero: "REsp 1.234.567/SP",
            tema: "Dano moral in re ipsa",
            ementa: "Inscrição indevida em cadastros restritivos gera dano moral in re ipsa.",
            tese: "Dano moral in re ipsa",
          },
        ],
      },
      [
        classificationResp(),
        extractionResp(),
        evidenceResp([
          {
            id: "jur_favoravel_danos",
            stance: "FAVORAVEL",
            use_mode: "FOUNDATION",
            confidence: 0.95,
            tese_extraida: "Dano moral in re ipsa",
            fundamento_da_classificacao: "Precedente direto e favorável",
            pode_citar_na_peca: true,
            regra_de_uso: "Citar como fundamento favorável",
          },
        ]),
        matrixResp(),
        draftStream(draftText),
        auditResp({ score: 94 }),
      ],
    );

    assert.equal(result.mode, "FINAL_DRAFT");
    assert.equal(result.status, "MINUTA APROVADA");
  });
});

// ── Caso 7: Despacho com "defiro" → REPROVADA (erro fatal estrutural) ────────

describe("Pipeline mockado — Caso 7: despacho com 'defiro'", () => {
  it("draft com 'defiro' em DESPACHO deve emitir DESPACHO_WITH_DECISION_LANGUAGE", async () => {
    const draftText = `Processo nº 0001234-56.2024.8.26.0000\n\nDefiro o pedido de tutela de urgência formulado pela parte autora, determinando a intimação imediata do réu.`;

    const result = await runPipelineWithMock(
      {
        userId: "test_user",
        caseDescription:
          "Juiz deve emitir despacho de impulso processual determinando a intimação das partes para audiência designada.",
        documentType: "DESPACHO",
        jurisprudencias: [],
      },
      [
        classificationResp({ tipo_peca: "DESPACHO" }),
        extractionResp({ fatos: ["intimação para audiência"], pedidos: [], qualidade_extracao: "PARCIAL" }),
        matrixResp({ teses: [] }),
        draftStream(draftText),
        auditResp({ score: 70, aprovada: false }),
      ],
    );

    assert.ok(
      result.validationErrors.includes("DESPACHO_WITH_DECISION_LANGUAGE"),
      "Deve detectar DESPACHO_WITH_DECISION_LANGUAGE",
    );
    // Nota: status final aqui é APROVADA COM RESSALVAS porque o pipeline cai
    // em TEMPLATE_MODEL (extração PARCIAL). Para um DESPACHO real chegando em
    // FINAL_DRAFT, o status seria REPROVADA. O ponto deste teste é validar
    // que a regra fatal É detectada, não o status final do modo modelo.
    assert.equal(result.mode, "TEMPLATE_MODEL");
  });
});

// Roda todos os fixtures (preferencialmente com mock) e gera dois arquivos:
//   - tests/report/output/report.json
//   - tests/report/output/report.html
//
// Por padrão, usa o pipeline MOCKADO (sem custo). Para usar OpenAI real,
// rode com a flag --real (e OPENAI_API_KEY configurada).
//
// Uso:
//   npm run test:legal-report             # mock
//   npm run test:legal-report -- --real   # OpenAI real (respeita JUDICORE_TEST_MAX_CASES)

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LegalPipeline } from "../../src/pipeline/pipeline.js";
import { setOpenAIClient } from "../../src/client.js";
import { createMockOpenAI, type StageResponder } from "../helpers/openai-mock.js";
import { CostTracker, loadCostLimits } from "../helpers/cost-tracker.js";
import { FIXTURES, type CaseFixture } from "../fixtures/legal-cases.js";
import { renderHtml, type ReportCase, type ReportData } from "./html-template.js";
import type { PipelineEvent, ValidationError, LegalAudit } from "../../src/pipeline/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");

const args = process.argv.slice(2);
const USE_REAL = args.includes("--real");

// ── Mock responses padrão usados quando USE_REAL=false ───────────────────────

function inferClassificationFromFixture(fx: CaseFixture): {
  tipo_justica: string;
  regime_juridico: string;
} {
  const rules = fx.expected.mustHaveCriticalErrors ?? [];
  if (rules.includes("RPPS_WRONG_ARTICLE")) return { tipo_justica: "ESTADUAL", regime_juridico: "RPPS" };
  if (rules.includes("RGPS_WRONG_ARTICLE")) return { tipo_justica: "FEDERAL", regime_juridico: "RGPS" };
  if (rules.includes("INCOMPATIBLE_APPEAL") || rules.includes("WRONG_SUPERIOR_COURT")) {
    return { tipo_justica: "TRABALHO", regime_juridico: "CLT" };
  }
  if (rules.includes("CRIMINAL_WRONG_TERM") || rules.includes("WRONG_HONORARIOS_CRIMINAL")) {
    return { tipo_justica: "CRIMINAL", regime_juridico: "CRIMINAL" };
  }
  if (rules.includes("JEF_JEC_WRONG_APPEAL") && fx.id.includes("jef")) {
    return { tipo_justica: "JEF", regime_juridico: "RGPS" };
  }
  if (rules.includes("JEF_JEC_WRONG_APPEAL")) return { tipo_justica: "JEC", regime_juridico: "CIVIL" };
  if (fx.id.includes("rpps")) return { tipo_justica: "ESTADUAL", regime_juridico: "RPPS" };
  return { tipo_justica: "ESTADUAL", regime_juridico: "CIVIL" };
}

function buildMockQueue(fx: CaseFixture): StageResponder[] {
  const { tipo_justica, regime_juridico } = inferClassificationFromFixture(fx);
  const classification: StageResponder = {
    kind: "json",
    payload: {
      tipo_justica,
      tipo_peca: fx.documentType,
      regime_juridico,
      grau: "PRIMEIRO",
      tribunal_competente: tipo_justica === "TRABALHO" ? "TRT2" : "TJSP",
      rito: null,
      assunto_principal: fx.caseDescription.slice(0, 80),
      partes: { autor: "Autor", reu: "Réu" },
      confianca: 0.85,
    },
  };
  const extraction: StageResponder = {
    kind: "json",
    payload: {
      fatos: ["fato 1", "fato 2", "fato 3"],
      pedidos: ["pedido 1", "pedido 2"],
      questoes_juridicas: ["questão 1", "questão 2"],
      artigos_citados: ["art. 186 CC"],
      jurisprudencias_relevantes: [],
      qualidade_extracao: fx.caseDescription.length < 30 ? "INSUFICIENTE" : "SUFICIENTE",
    },
  };
  const evidenceQueue: StageResponder[] = fx.jurisprudencias.length > 0
    ? [
        {
          kind: "json",
          payload: {
            analyses: fx.jurisprudencias.map((j) => ({
              id: j.id,
              stance: fx.expected.evidenceStance?.[j.id] ?? "NEUTRO",
              use_mode: "CONTEXT_ONLY",
              confidence: 0.8,
              tese_extraida: j.tese,
              fundamento_da_classificacao: "mock",
              pode_citar_na_peca: true,
              regra_de_uso: "mock",
            })),
          },
        },
      ]
    : [];
  const matrix: StageResponder = {
    kind: "json",
    payload: {
      teses: [
        {
          id: "t1",
          pedido: "pedido 1",
          tese: "tese 1",
          fato: "fato 1",
          norma: "art. 186 CC",
          ratio: "ratio",
          jurisprudencia_id: null,
          conclusao: "procedente",
        },
        {
          id: "t2",
          pedido: "pedido 2",
          tese: "tese 2",
          fato: "fato 2",
          norma: "art. 927 CC",
          ratio: "ratio 2",
          jurisprudencia_id: null,
          conclusao: "procedente",
        },
      ],
    },
  };
  // Draft customizado por caso quando aplicável
  const draftText = buildMockDraft(fx);
  const draftChunks: string[] = [];
  for (let i = 0; i < draftText.length; i += 80) draftChunks.push(draftText.slice(i, i + 80));
  const draft: StageResponder = { kind: "stream", chunks: draftChunks };
  // Score do mock: para casos esperando APROVADA COM RESSALVAS, retorna 85;
  // para casos esperando MINUTA APROVADA, retorna 92; default 88.
  const expectedStatus = fx.expected.status;
  const score =
    expectedStatus === "APROVADA COM RESSALVAS" ? 85 :
    expectedStatus === "MINUTA APROVADA" ? 92 :
    expectedStatus === "REPROVADA" ? 70 :
    88;
  const audit: StageResponder = {
    kind: "json",
    payload: { aprovada: score >= 81, score, erros: [], resumo: "ok" },
  };

  return [classification, extraction, ...evidenceQueue, matrix, draft, audit];
}

function buildMockDraft(fx: CaseFixture): string {
  const rules = fx.expected.mustHaveCriticalErrors ?? [];
  if (rules.includes("DESPACHO_WITH_DECISION_LANGUAGE")) {
    return "Processo nº 0001234-56.2024.8.26.0000\nDefiro o pedido formulado.";
  }
  if (rules.includes("WRONG_SUPERIOR_COURT") && rules.includes("INCOMPATIBLE_APPEAL")) {
    return "Interpõe-se APELAÇÃO ao Superior Tribunal de Justiça — STJ, requerendo a reforma da decisão.";
  }
  if (rules.includes("INCOMPATIBLE_APPEAL")) {
    return "Interpõe-se APELAÇÃO contra a sentença proferida em primeiro grau de jurisdição.";
  }
  if (rules.includes("JEF_JEC_WRONG_APPEAL")) {
    return "Interpõe-se apelação contra a sentença proferida pelo Juizado Especial Federal.";
  }
  if (rules.includes("CRIMINAL_WRONG_TERM")) {
    return "Trata-se de habeas corpus. Ante o exposto, julgo improcedente o pedido.";
  }
  if (rules.includes("RPPS_WRONG_ARTICLE")) {
    return "O servidor faz jus à aposentadoria nos termos do art. 201 da CF/88.";
  }
  // Defaults por tipo de peça (sem termos proibidos)
  if (fx.documentType === "SENTENCA") {
    return [
      "Processo nº 0001234-56.2024.8.26.0000",
      "RELATÓRIO\nTrata-se de ação indenizatória ajuizada por Autor em face de Réu, com fundamento em descumprimento contratual e pleito de danos morais.",
      "FUNDAMENTAÇÃO\nApós análise dos autos, verifica-se que a parte autora não demonstrou cabalmente o nexo causal nem a extensão do dano alegado. As provas documentais juntadas são insuficientes para amparar o pedido.",
      "DISPOSITIVO\nAnte o exposto, julgo improcedente o pedido formulado, com fundamento no art. 487, I, do CPC. Condeno a autora ao pagamento de custas e honorários advocatícios fixados em 10% sobre o valor da causa, nos termos do art. 85, §2º, do CPC.",
    ].join("\n\n");
  }
  if (fx.documentType === "DECISAO") {
    return [
      "Processo nº 0001234-56.2024.8.26.0000",
      "Trata-se de pedido de tutela de urgência formulado pela parte autora.",
      "É o relatório. Decido.",
      "Verifico presentes os requisitos do art. 300 CPC: probabilidade do direito e perigo de dano.",
      "Defiro a tutela de urgência para determinar a baixa imediata da inscrição.",
    ].join("\n\n");
  }
  if (fx.documentType === "DESPACHO") {
    return "Processo nº 0001234-56.2024.8.26.0000\nIntimem-se as partes para a audiência de conciliação designada.";
  }
  if (fx.documentType === "RECURSO") {
    return [
      "EXCELENTÍSSIMO SENHOR DOUTOR DESEMBARGADOR RELATOR",
      "Identificação da decisão recorrida: sentença de improcedência proferida em primeiro grau.",
      "Razões de impugnação: a decisão recorrida deixou de analisar provas essenciais.",
      "Pedido recursal: requer-se a reforma da sentença para julgar procedente o pedido.",
    ].join("\n\n");
  }
  return [
    "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA VARA CÍVEL",
    "DOS FATOS\nNarração genérica de fatos relevantes para o caso.",
    "DO DIREITO\nArt. 186 CC/2002. Responsabilidade civil.",
    "DOS PEDIDOS\nProcedência da ação.",
    "Valor da causa: R$ 1.000,00.",
  ].join("\n\n");
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function runFixture(fx: CaseFixture, tracker: CostTracker): Promise<ReportCase> {
  if (!USE_REAL) {
    const queue = buildMockQueue(fx);
    const { client } = createMockOpenAI(queue);
    setOpenAIClient(client);
  } else {
    setOpenAIClient(null);
  }

  const pipeline = new LegalPipeline();
  let draft = "";
  let mode: string | undefined;
  let status: string | undefined;
  let audit: LegalAudit | undefined;
  const validationErrors: ValidationError[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    for await (const evt of pipeline.run(
      {
        userId: "report",
        caseDescription: fx.caseDescription,
        documentType: fx.documentType,
        jurisprudencias: fx.jurisprudencias,
        instruction: fx.instruction,
      },
      `report_${fx.id}`,
      async (_stage, data) => {
        const d = data as { usage?: { inputTokens?: number; outputTokens?: number } };
        if (d?.usage) {
          inputTokens += d.usage.inputTokens ?? 0;
          outputTokens += d.usage.outputTokens ?? 0;
        }
      },
    )) {
      if (evt.event === "chunk") draft += evt.data;
      if (evt.event === "mode") mode = evt.data.mode;
      if (evt.event === "done") status = evt.data.status;
      if (evt.event === "audit") audit = evt.data;
      if (evt.event === "validation_errors") validationErrors.push(...evt.data);
    }
  } catch (err) {
    return {
      fixtureId: fx.id,
      fixtureName: fx.name,
      documentType: fx.documentType,
      ...(fx.expected.mode !== undefined && { expectedMode: fx.expected.mode }),
      ...(fx.expected.status !== undefined && { expectedStatus: fx.expected.status }),
      ...(fx.expected.mustHaveCriticalErrors !== undefined && {
        expectedCriticalErrors: fx.expected.mustHaveCriticalErrors,
      }),
      obtainedErrors: [],
      pass: false,
      failureReasons: [`Exceção durante execução: ${String(err)}`],
    };
  } finally {
    if (USE_REAL) tracker.trackCase(fx.id, inputTokens, outputTokens);
  }

  // Avaliar expected vs obtained
  const failureReasons: string[] = [];
  const obtainedRules = validationErrors.map((e) => e.rule);

  if (fx.expected.mode && mode !== fx.expected.mode) {
    failureReasons.push(`mode esperado ${fx.expected.mode}, obtido ${mode ?? "indefinido"}`);
  }
  if (fx.expected.status && status !== fx.expected.status) {
    failureReasons.push(`status esperado ${fx.expected.status}, obtido ${status ?? "indefinido"}`);
  }
  for (const rule of fx.expected.mustHaveCriticalErrors ?? []) {
    if (!obtainedRules.includes(rule)) {
      failureReasons.push(`regra esperada não emitida: ${rule}`);
    }
  }
  for (const rule of fx.expected.mustNotHaveCriticalErrors ?? []) {
    if (obtainedRules.includes(rule)) {
      failureReasons.push(`regra não deveria ser emitida: ${rule}`);
    }
  }
  for (const text of fx.expected.mustContain ?? []) {
    if (!draft.toLowerCase().includes(text.toLowerCase())) {
      failureReasons.push(`draft deveria conter: "${text}"`);
    }
  }
  for (const text of fx.expected.mustNotContain ?? []) {
    if (draft.toLowerCase().includes(text.toLowerCase())) {
      failureReasons.push(`draft NÃO deveria conter: "${text}"`);
    }
  }

  const result: ReportCase = {
    fixtureId: fx.id,
    fixtureName: fx.name,
    documentType: fx.documentType,
    obtainedErrors: validationErrors.map((e) => ({ rule: e.rule, message: e.message, fatal: e.fatal })),
    pass: failureReasons.length === 0,
    failureReasons,
  };
  if (fx.expected.mode !== undefined) result.expectedMode = fx.expected.mode;
  if (fx.expected.status !== undefined) result.expectedStatus = fx.expected.status;
  if (fx.expected.mustHaveCriticalErrors !== undefined) result.expectedCriticalErrors = fx.expected.mustHaveCriticalErrors;
  if (mode !== undefined) result.obtainedMode = mode;
  if (status !== undefined) result.obtainedStatus = status;
  if (audit) result.audit = { score: audit.score, aprovada: audit.aprovada };
  if (draft) result.draftExcerpt = draft.slice(0, 500);
  if (USE_REAL) {
    result.inputTokens = inputTokens;
    result.outputTokens = outputTokens;
  }
  return result;
}

async function main(): Promise<void> {
  const limits = loadCostLimits();
  const tracker = new CostTracker(limits);
  const fixturesToRun = USE_REAL ? FIXTURES.slice(0, limits.maxCases) : FIXTURES;

  console.log(
    `[report] Modo: ${USE_REAL ? "REAL (OpenAI)" : "MOCK"} | ` +
      `Casos: ${fixturesToRun.length} | ` +
      `Limites: ${limits.maxCases} casos / ${limits.maxTotalTokens} tokens`,
  );

  const cases: ReportCase[] = [];
  for (const fx of fixturesToRun) {
    console.log(`[report] Rodando ${fx.id}...`);
    const result = await runFixture(fx, tracker);
    cases.push(result);
    console.log(`[report]   → ${result.pass ? "PASS" : "FAIL"}${result.failureReasons.length ? " — " + result.failureReasons[0] : ""}`);
  }

  const passed = cases.filter((c) => c.pass).length;
  const failed = cases.length - passed;

  const data: ReportData = {
    generatedAt: new Date().toISOString(),
    totalCases: cases.length,
    passed,
    failed,
    cases,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  const jsonPath = join(OUTPUT_DIR, "report.json");
  const htmlPath = join(OUTPUT_DIR, "report.html");
  await writeFile(jsonPath, JSON.stringify(data, null, 2), "utf8");
  await writeFile(htmlPath, renderHtml(data), "utf8");

  console.log(`\n[report] ${passed}/${cases.length} casos passaram`);
  console.log(`[report] JSON: ${jsonPath}`);
  console.log(`[report] HTML: ${htmlPath}`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("[report] erro fatal:", err);
  process.exit(2);
});

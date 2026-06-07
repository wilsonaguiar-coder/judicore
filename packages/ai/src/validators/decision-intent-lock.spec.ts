/**
 * Decision Intent Lock — Testes
 *
 * Valida que:
 *  1. extractDecidedOutcome reconhece todos os 11 tipos de orientação decisória
 *  2. validateOutcomeConformance bloqueia dispositivos opostos (FATAL)
 *  3. validateOutcomeConformance aprova dispositivos corretos
 *  4. buildDecisionDirectiveBlock gera bloco não-vazio para todos os outcomes
 *  5. SentencaValidator detecta as 4 contradições BLOCO 1–4
 *
 * Execução:
 *   node --import tsx/esm src/validators/decision-intent-lock.spec.ts
 */

import { extractDecidedOutcome, buildDecisionDirectiveBlock, getOutcomeExpectation } from "../pipeline/outcome-extractor.js";
import { validateOutcomeConformance } from "./outcome-conformance.validator.js";
import { SentencaValidator } from "./sentenca.validator.js";
import type { DecidedOutcome } from "../pipeline/types.js";
import type { LegalClassification } from "../pipeline/types.js";

// ─── Harness ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    console.error(`  ✗ ${name}\n      ${e instanceof Error ? e.message : String(e)}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// ─── Suite 1: extractDecidedOutcome ──────────────────────────────────────────

console.log("\nSuite 1 — extractDecidedOutcome: todos os 11 tipos");

const extractionCases: Array<{ instruction: string; expected: DecidedOutcome }> = [
  { instruction: "Gere sentença julgando procedente o pedido",              expected: "PROCEDENTE" },
  { instruction: "quero sentença de improcedência",                         expected: "IMPROCEDENTE" },
  { instruction: "sentença parcialmente procedente, parte acolhida",        expected: "PARCIALMENTE_PROCEDENTE" },
  { instruction: "extinguir sem resolução do mérito art. 485 CPC",          expected: "EXTINCAO_SEM_RESOLUCAO" },
  { instruction: "preciso de sentença extinto sem resolução",               expected: "EXTINCAO_SEM_RESOLUCAO" },
  { instruction: "homologação de acordo entre as partes",                   expected: "HOMOLOGACAO" },
  { instruction: "preciso homologar o acordo firmado",                      expected: "HOMOLOGACAO" },
  { instruction: "defiro o pedido de tutela antecipada",                    expected: "DEFIRO" },
  { instruction: "indefiro o pedido, indeferido por ausência de fumus",     expected: "INDEFIRO" },
  { instruction: "concedo a ordem de habeas corpus",                        expected: "CONCEDO_ORDEM" },
  { instruction: "denego a ordem de habeas corpus impetrado",               expected: "DENEGO_ORDEM" },
  { instruction: "condeno o réu pelo art. 155 do CP",                      expected: "CONDENO" },
  { instruction: "absolvo o réu por insuficiência de provas",               expected: "ABSOLVO" },
];

for (const { instruction, expected } of extractionCases) {
  test(`extrai "${expected}" de: "${instruction.slice(0, 50)}"`, () => {
    const result = extractDecidedOutcome(instruction);
    assert(result === expected, `esperado "${expected}", obtido "${result ?? "undefined"}"`);
  });
}

test("retorna undefined para instrução sem orientação", () => {
  assert(extractDecidedOutcome("Gere uma petição inicial trabalhista") === undefined, "esperado undefined");
  assert(extractDecidedOutcome(undefined) === undefined, "esperado undefined para undefined");
  assert(extractDecidedOutcome("") === undefined, "esperado undefined para string vazia");
});

// ─── Suite 2: buildDecisionDirectiveBlock ─────────────────────────────────────

console.log("\nSuite 2 — buildDecisionDirectiveBlock: todos os outcomes geram bloco não-vazio");

const allOutcomes: DecidedOutcome[] = [
  "PROCEDENTE", "IMPROCEDENTE", "PARCIALMENTE_PROCEDENTE",
  "EXTINCAO_SEM_RESOLUCAO", "HOMOLOGACAO",
  "DEFIRO", "INDEFIRO", "CONCEDO_ORDEM", "DENEGO_ORDEM",
  "CONDENO", "ABSOLVO",
];

for (const outcome of allOutcomes) {
  test(`bloco não-vazio para ${outcome}`, () => {
    const block = buildDecisionDirectiveBlock(outcome, "SENTENCA");
    assert(block.length > 50, `bloco muito curto (${block.length} chars)`);
    assert(block.includes("DIREÇÃO DECISÓRIA"), "bloco deve conter cabeçalho DIREÇÃO DECISÓRIA");
  });
}

test("bloco EXTINCAO contém art. 485", () => {
  const block = buildDecisionDirectiveBlock("EXTINCAO_SEM_RESOLUCAO", "SENTENCA");
  assert(block.includes("485"), "bloco deve mencionar art. 485");
});

test("bloco HOMOLOGACAO contém 'acordo'", () => {
  const block = buildDecisionDirectiveBlock("HOMOLOGACAO", "SENTENCA");
  assert(block.toLowerCase().includes("acordo"), "bloco deve mencionar acordo");
});

// ─── Suite 3: validateOutcomeConformance — inversões bloqueadas ───────────────

console.log("\nSuite 3 — validateOutcomeConformance: inversões bloqueadas (FATAL)");

function makeDisp(text: string): string {
  return `RELATÓRIO\n\nAqui vai o relatório.\n\nFUNDAMENTAÇÃO\n\nAqui vai a fundamentação.\n\nDISPOSITIVO\n\n${text}`;
}

test("PROCEDENTE solicitado → dispositivo IMPROCEDENTE gera FATAL", () => {
  const errors = validateOutcomeConformance(makeDisp("Julgo improcedente os pedidos."), "PROCEDENTE");
  assert(errors.some((e) => e.fatal && e.rule === "OUTCOME_CONFORMANCE_VIOLATION"), `esperado OUTCOME_CONFORMANCE_VIOLATION, obtido: ${JSON.stringify(errors)}`);
});

test("IMPROCEDENTE solicitado → dispositivo PROCEDENTE gera FATAL", () => {
  const errors = validateOutcomeConformance(makeDisp("Julgo procedente o pedido."), "IMPROCEDENTE");
  assert(errors.some((e) => e.fatal && e.rule === "OUTCOME_CONFORMANCE_VIOLATION"), `esperado OUTCOME_CONFORMANCE_VIOLATION`);
});

test("DEFIRO solicitado → dispositivo INDEFIRO gera FATAL", () => {
  const errors = validateOutcomeConformance(makeDisp("Indefiro o pedido de tutela antecipada."), "DEFIRO");
  assert(errors.some((e) => e.fatal), `esperado erro FATAL para inversão DEFIRO→INDEFIRO`);
});

test("INDEFIRO solicitado → dispositivo DEFIRO gera FATAL", () => {
  const errors = validateOutcomeConformance(makeDisp("Defiro o pedido requerido."), "INDEFIRO");
  assert(errors.some((e) => e.fatal), `esperado erro FATAL para inversão INDEFIRO→DEFIRO`);
});

test("CONDENO solicitado → dispositivo ABSOLVO gera FATAL", () => {
  const errors = validateOutcomeConformance(makeDisp("Absolvo o réu da imputação, nos termos do art. 386 do CPP."), "CONDENO");
  assert(errors.some((e) => e.fatal), `esperado erro FATAL para inversão CONDENO→ABSOLVO`);
});

test("ABSOLVO solicitado → dispositivo CONDENO gera FATAL", () => {
  const errors = validateOutcomeConformance(makeDisp("Condeno o réu à pena de 4 anos de reclusão."), "ABSOLVO");
  assert(errors.some((e) => e.fatal), `esperado erro FATAL para inversão ABSOLVO→CONDENO`);
});

test("CONCEDO_ORDEM solicitado → dispositivo DENEGO gera FATAL", () => {
  const errors = validateOutcomeConformance(makeDisp("Denego a ordem de habeas corpus impetrado."), "CONCEDO_ORDEM");
  assert(errors.some((e) => e.fatal), `esperado erro FATAL para inversão CONCEDO→DENEGO`);
});

// ─── Suite 4: validateOutcomeConformance — casos corretos passam ──────────────

console.log("\nSuite 4 — validateOutcomeConformance: orientação correta aprovada");

test("PROCEDENTE solicitado → dispositivo PROCEDENTE passa", () => {
  const errors = validateOutcomeConformance(makeDisp("Julgo procedente o pedido de concessão do benefício."), "PROCEDENTE");
  assert(errors.length === 0, `esperado 0 erros, obtido: ${JSON.stringify(errors)}`);
});

test("IMPROCEDENTE solicitado → dispositivo IMPROCEDENTE passa", () => {
  const errors = validateOutcomeConformance(makeDisp("Julgo improcedente os pedidos formulados na inicial."), "IMPROCEDENTE");
  assert(errors.length === 0, `esperado 0 erros`);
});

test("EXTINCAO_SEM_RESOLUCAO solicitado → dispositivo correto passa", () => {
  const errors = validateOutcomeConformance(
    makeDisp("Julgo extinto o processo, sem resolução do mérito, nos termos do art. 485, VI, do CPC."),
    "EXTINCAO_SEM_RESOLUCAO",
  );
  assert(errors.length === 0, `esperado 0 erros, obtido: ${JSON.stringify(errors)}`);
});

test("HOMOLOGACAO solicitado → dispositivo HOMOLOGO passa", () => {
  const errors = validateOutcomeConformance(
    makeDisp("Homologo o acordo celebrado entre as partes, nos termos das cláusulas constantes dos autos."),
    "HOMOLOGACAO",
  );
  assert(errors.length === 0, `esperado 0 erros, obtido: ${JSON.stringify(errors)}`);
});

test("CONDENO solicitado → dispositivo CONDENO passa", () => {
  const errors = validateOutcomeConformance(makeDisp("Condeno o réu pela prática do art. 155, §4º, do CP."), "CONDENO");
  assert(errors.length === 0, `esperado 0 erros`);
});

test("undefined decidedOutcome → nenhum erro", () => {
  const errors = validateOutcomeConformance(makeDisp("Julgo improcedente o pedido."), undefined);
  assert(errors.length === 0, `esperado 0 erros quando outcome é undefined`);
});

// ─── Suite 5: SentencaValidator — 4 blocos de contradição ────────────────────

console.log("\nSuite 5 — SentencaValidator: 4 blocos de contradição fundamentação × dispositivo");

const sentValidator = new SentencaValidator();
const classificacaoSentenca: LegalClassification = {
  tipo_peca: "SENTENCA",
  tipo_justica: "TRABALHO",
  regime_juridico: "CLT",
  grau: "PRIMEIRO",
  tribunal_competente: "VT",
  rito: null,
  assunto_principal: "Rescisão indireta",
  partes: { autor: "João Silva", reu: "Empresa ABC Ltda" },
  confianca: 0.95,
};

function buildSentenca(fundamentacao: string, dispositivo: string): string {
  return [
    "RELATÓRIO\n\nDescrição dos fatos conforme petição inicial e contestação. As partes trouxeram aos autos as seguintes alegações. O autor pleiteia o reconhecimento de rescisão indireta. A ré contesta os pedidos. Encerrada a instrução, passo a decidir.",
    `FUNDAMENTAÇÃO\n\n${fundamentacao}`,
    `DISPOSITIVO\n\n${dispositivo}\n\nRecurso cabível: recurso ordinário (RO), no prazo de 8 dias, nos termos do art. 895 da CLT.`,
  ].join("\n\n");
}

// BLOCO 1 — trabalhista: fundamentação pro autor + dispositivo improcedente
test("BLOCO 1: fundamentação favorável ao autor + dispositivo improcedente → FATAL", () => {
  const draft = buildSentenca(
    "A nulidade da justa causa é evidente. O empregador não comprovou a falta grave. Ausência de imediatidade não observada. A justa causa não configurada.",
    "Julgo totalmente improcedentes os pedidos formulados pelo reclamante. Custas pela parte autora.",
  );
  const result = sentValidator.validate(draft, classificacaoSentenca);
  assert(
    result.errors.some((e) => e.rule === "SENTENCE_REASONING_DISPOSITIVE_CONTRADICTION" && e.fatal),
    `esperado SENTENCE_REASONING_DISPOSITIVE_CONTRADICTION FATAL, obtido: ${JSON.stringify(result.errors.map((e) => e.rule))}`,
  );
});

// BLOCO 2 — criminal: fundamentação absolvitória + CONDENO
const classifCriminal: LegalClassification = { ...classificacaoSentenca, tipo_peca: "SENTENCA", tipo_justica: "CRIMINAL", regime_juridico: "CRIMINAL" };

test("BLOCO 2: in dubio pro reo na fundamentação + CONDENO no dispositivo → FATAL", () => {
  const draft = buildSentenca(
    "O princípio da presunção de inocência rege o processo penal. A autoria não foi comprovada pelos elementos probatórios colhidos. A prova insuficiente para condenação não permite a formação do juízo condenatório. In dubio pro reo.",
    "Condeno o réu João Silva pela prática do art. 155 do Código Penal à pena de 4 anos de reclusão.",
  );
  const result = sentValidator.validate(draft, classifCriminal);
  assert(
    result.errors.some((e) => e.rule === "CRIMINAL_REASONING_DISPOSITIVE_CONTRADICTION" && e.fatal),
    `esperado CRIMINAL_REASONING_DISPOSITIVE_CONTRADICTION FATAL, obtido: ${JSON.stringify(result.errors.map((e) => e.rule))}`,
  );
});

// BLOCO 3 — família: fundamentação pro mãe + guarda ao pai
const classifFamilia: LegalClassification = { ...classificacaoSentenca, tipo_peca: "SENTENCA", tipo_justica: "ESTADUAL", regime_juridico: "CIVIL" };

test("BLOCO 3: laudo favorável à mãe + dispositivo guarda ao pai → FATAL", () => {
  const draft = buildSentenca(
    "O laudo psicossocial favorável à mãe demonstra vínculo afetivo com a genitora consolidado. A criança está bem adaptada junto à mãe. O melhor interesse da criança aponta para a genitora.",
    "Defiro a guarda unilateral ao pai, genitor, que demonstrou melhores condições. Recurso cabível: apelação, art. 1.009 do CPC.",
  );
  const result = sentValidator.validate(draft, classifFamilia);
  assert(
    result.errors.some((e) => e.rule === "FAMILY_REASONING_DISPOSITIVE_CONTRADICTION" && e.fatal),
    `esperado FAMILY_REASONING_DISPOSITIVE_CONTRADICTION FATAL, obtido: ${JSON.stringify(result.errors.map((e) => e.rule))}`,
  );
});

// BLOCO 4 — criminal: fundamentação condenatória + ABSOLVO
test("BLOCO 4: autoria e materialidade comprovadas + ABSOLVO no dispositivo → FATAL", () => {
  const draft = buildSentenca(
    "A autoria e materialidade comprovadas pelos depoimentos e laudos periciais. O dolo comprovado do agente é inafastável. A conduta dolosa demonstrada pela análise das provas colhidas na instrução.",
    "Absolvo o réu João Silva da imputação do art. 155 do CP, com fundamento no art. 386, VII, do CPP.",
  );
  const result = sentValidator.validate(draft, classifCriminal);
  assert(
    result.errors.some((e) => e.rule === "CRIMINAL_CONDENATORY_REASONING_ABSOLVES" && e.fatal),
    `esperado CRIMINAL_CONDENATORY_REASONING_ABSOLVES FATAL, obtido: ${JSON.stringify(result.errors.map((e) => e.rule))}`,
  );
});

// Caso limpo — sem contradição
test("Sentença coerente (PROCEDENTE) não gera contradição", () => {
  const draft = buildSentenca(
    "O autor comprovou os requisitos para a rescisão indireta. A falta grave imputável ao empregador restou configurada pelas provas dos autos. O direito pleiteado está amparado pela legislação consolidada.",
    "Julgo procedente o pedido, reconhecendo a rescisão indireta do contrato de trabalho, condenando a ré ao pagamento das verbas rescisórias previstas em lei.",
  );
  const result = sentValidator.validate(draft, classificacaoSentenca);
  const contras = result.errors.filter((e) =>
    ["SENTENCE_REASONING_DISPOSITIVE_CONTRADICTION", "FAMILY_REASONING_DISPOSITIVE_CONTRADICTION",
     "CRIMINAL_REASONING_DISPOSITIVE_CONTRADICTION", "CRIMINAL_CONDENATORY_REASONING_ABSOLVES"].includes(e.rule),
  );
  assert(contras.length === 0, `esperado 0 contradições, obtido: ${JSON.stringify(contras.map((e) => e.rule))}`);
});

// ─── Suite 6: getOutcomeExpectation — novos tipos ─────────────────────────────

console.log("\nSuite 6 — getOutcomeExpectation: EXTINCAO_SEM_RESOLUCAO e HOMOLOGACAO");

test("EXTINCAO_SEM_RESOLUCAO tem positivePatterns e label correto", () => {
  const exp = getOutcomeExpectation("EXTINCAO_SEM_RESOLUCAO");
  assert(exp.label === "EXTINÇÃO SEM RESOLUÇÃO DO MÉRITO", `label incorreto: ${exp.label}`);
  assert(exp.positivePatterns.length > 0, "deve ter positivePatterns");
  assert(exp.positivePatterns.some((p) => p.test("Julgo extinto o processo, sem resolução do mérito, nos termos do art. 485, VI, do CPC.")), "positivePattern deve reconhecer o dispositivo correto");
});

test("HOMOLOGACAO tem positivePatterns e label correto", () => {
  const exp = getOutcomeExpectation("HOMOLOGACAO");
  assert(exp.label === "HOMOLOGAÇÃO", `label incorreto: ${exp.label}`);
  assert(exp.positivePatterns.length > 0, "deve ter positivePatterns");
  assert(exp.positivePatterns.some((p) => p.test("Homologo o acordo celebrado entre as partes.")), "positivePattern deve reconhecer homologação");
});

// ─── Resultado ────────────────────────────────────────────────────────────────

console.log(`\nTotal: ${passed + failed} | ✓ ${passed} | ✗ ${failed}`);
if (failed > 0) {
  console.error(`\n${failed} testes falharam.`);
  process.exit(1);
} else {
  console.log("\nTodos os testes passaram.");
}

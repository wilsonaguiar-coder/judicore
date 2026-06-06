import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateRequestDispositive } from "../../src/validators/request-dispositive.validator.js";

// ════════════════════════════════════════════════════════════════════════════
// FASE 5.8.0 — REQUEST × DISPOSITIVE AUDIT
// ════════════════════════════════════════════════════════════════════════════

// ── POSITIVOS ────────────────────────────────────────────────────────────────

describe("UNADDRESSED_MAIN_REQUEST — dano moral pedido mas não enfrentado", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
DOS FATOS
A parte autora alega ter sofrido danos materiais e morais decorrentes da conduta ilícita
da parte ré. Os fatos narrados na inicial demonstram que o réu agiu de forma negligente,
causando prejuízos efetivos ao patrimônio e à honra do autor. As provas juntadas aos autos
confirmam a narrativa apresentada: documentos, testemunhos e laudos técnicos comprovam a
extensão dos danos sofridos. O autor buscou solução extrajudicial sem sucesso, tendo o réu
se recusado a assumir a responsabilidade pelos danos causados pela sua conduta culposa.

DO DIREITO
A responsabilidade civil do réu está configurada pelos elementos do art. 186 do Código Civil:
ação culposa, dano e nexo causal. Presentes todos os requisitos legais, impõe-se a condenação.

DOS PEDIDOS
Requer seja o réu condenado ao pagamento de indenização a título de dano moral no valor mínimo
de R$ 10.000,00, considerando a extensão do sofrimento, a condição econômica das partes e o
caráter pedagógico da sanção civil. Requer também a condenação ao pagamento de dano material
pelos prejuízos patrimoniais efetivamente comprovados nos autos desta demanda judicial.

DISPOSITIVO
Ante o exposto, condeno o réu ao pagamento de R$ 5.000,00 a título de dano material comprovado
nos autos. Honorários advocatícios fixados em 10% sobre o valor da condenação. Custas processuais
pelo réu. Apelação cabível no prazo de 15 dias úteis a partir da intimação desta sentença.
`;
    const errors = validateRequestDispositive(draft);
    assert.ok(
      errors.some((e) => e.rule === "UNADDRESSED_MAIN_REQUEST"),
      `Esperado UNADDRESSED_MAIN_REQUEST, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "UNADDRESSED_MAIN_REQUEST")!;
    assert.equal(err.fatal, false);
    const d = err.details as { missingRequests: string[] };
    assert.ok(d.missingRequests.includes("dano moral"), "dano moral deveria estar em missingRequests");
  });
});

describe("UNADDRESSED_SUBSIDIARY_REQUEST — subsidiariamente auxílio ignorado", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
DOS FATOS
A parte autora, segurada do RGPS, requer a concessão de aposentadoria por incapacidade permanente
em razão de doença incapacitante diagnosticada e atestada pelo médico assistente. Os laudos
médicos juntados comprovam a incapacidade total e definitiva para qualquer atividade laborativa.
A perícia administrativa do INSS indeferiu o benefício, razão pela qual o segurado busca a via
judicial para ver seu direito reconhecido. O histórico laboral e previdenciário está devidamente
comprovado pelos documentos juntados com a petição inicial desta demanda previdenciária.

DO DIREITO
O segurado preenche todos os requisitos para a concessão do benefício por incapacidade permanente:
qualidade de segurado mantida, carência cumprida e incapacidade total devidamente comprovada.

DOS PEDIDOS
Requer a concessão de aposentadoria por incapacidade permanente a partir da data de entrada
do requerimento administrativo (DER). Subsidiariamente, requer a concessão de auxílio por
incapacidade temporária caso não reconhecida a incapacidade total e definitiva pelo juízo.
Requer honorários advocatícios nos termos do art. 85 do CPC.

DISPOSITIVO
Ante o exposto, indefiro o pedido de aposentadoria por incapacidade permanente por ausência
de incapacidade total. Honorários advocatícios de 10% sobre as prestações vencidas. Custas.
Recurso inominado cabível no prazo legal aplicável ao rito do Juizado Especial Federal.
`;
    const errors = validateRequestDispositive(draft);
    assert.ok(
      errors.some((e) => e.rule === "UNADDRESSED_SUBSIDIARY_REQUEST"),
      `Esperado UNADDRESSED_SUBSIDIARY_REQUEST, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "UNADDRESSED_SUBSIDIARY_REQUEST")!;
    assert.equal(err.fatal, false);
  });
});

describe("UNADDRESSED_INJUNCTION_REQUEST — tutela de urgência ignorada", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
DA TUTELA DE URGÊNCIA
Requer a concessão de tutela de urgência antecipada para suspender os efeitos do ato
administrativo impugnado até o julgamento final do mérito desta demanda judicial. O periculum
in mora está configurado pelos prejuízos irreversíveis que o ato continua produzindo a cada
dia sobre o patrimônio do autor. O fumus boni iuris decorre da ilegalidade manifesta do ato
questionado, conforme demonstrado nos documentos juntados com a petição inicial desta ação.
A tutela antecipada é medida necessária e urgente para garantir a efetividade da tutela final.

DOS FATOS
A parte autora descreve em detalhes a conduta ilícita da administração pública, que praticou
ato sem amparo legal, violando os princípios da legalidade e da motivação dos atos administrativos.

DO DIREITO
Com fundamento no art. 300 do CPC/2015, estão presentes os requisitos para a tutela de urgência.

DOS PEDIDOS
Requer a concessão de tutela antecipada. Requer ainda a procedência do pedido principal
para anulação definitiva do ato impugnado. Honorários advocatícios conforme o art. 85 CPC.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido. Condeno a parte ré ao pagamento de R$ 10.000,00
a título de indenização pelos danos sofridos. Honorários advocatícios de 10% sobre a condenação.
Apelação cabível no prazo de 15 dias úteis a partir da intimação desta sentença de procedência.
`;
    const errors = validateRequestDispositive(draft);
    assert.ok(
      errors.some((e) => e.rule === "UNADDRESSED_INJUNCTION_REQUEST"),
      `Esperado UNADDRESSED_INJUNCTION_REQUEST, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "UNADDRESSED_INJUNCTION_REQUEST")!;
    assert.equal(err.fatal, false);
  });
});

describe("RELIEF_NOT_REQUESTED — alimentos concedidos sem pedido", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
DOS FATOS
A parte autora, consumidora prejudicada, descreve os danos sofridos em razão da conduta
do fornecedor réu. A relação de consumo está configurada, pois o autor é consumidor final
do produto defeituoso fornecido pela empresa ré no mercado de consumo. Os documentos juntados
comprovam o defeito do produto e os prejuízos decorrentes. Tentativas extrajudiciais de
solução foram infrutíferas, ensejando o ajuizamento desta demanda judicial indenizatória.

DO DIREITO
O CDC é aplicável ao caso. A responsabilidade do fornecedor independe de culpa (art. 12 CDC).

DOS PEDIDOS
Requer a condenação do réu ao pagamento de indenização a título de dano moral no valor
mínimo de R$ 8.000,00 pelos transtornos e sofrimentos causados pela conduta ilícita do
fornecedor. Nada mais requer nesta demanda. Honorários advocatícios na forma do art. 85 CPC.

DISPOSITIVO
Ante o exposto, condeno o réu ao pagamento de R$ 8.000,00 a título de dano moral. Condeno
ainda ao pagamento de alimentos no valor de R$ 1.000,00 mensais. Honorários advocatícios
de 10% sobre o total da condenação. Apelação cabível no prazo legal de 15 dias úteis.
`;
    const errors = validateRequestDispositive(draft);
    assert.ok(
      errors.some((e) => e.rule === "RELIEF_NOT_REQUESTED"),
      `Esperado RELIEF_NOT_REQUESTED, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "RELIEF_NOT_REQUESTED")!;
    assert.equal(err.fatal, false);
    const d = err.details as { extraReliefs: string[] };
    assert.ok(d.extraReliefs.includes("alimentos"), "alimentos deveria estar em extraReliefs");
  });
});

describe("INCOMPLETE_RELIEF — condenação em danos morais sem valor", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
RELATÓRIO
Trata-se de ação indenizatória ajuizada pela parte autora em face do réu, pleiteando
indenização por danos morais decorrentes da conduta ilícita descrita na petição inicial.
O réu foi devidamente citado e apresentou contestação tempestiva, refutando os fatos
narrados na inicial e sustentando a ausência de conduta culposa e de dano indenizável.
A instrução probatória foi realizada com oitiva de testemunhas e juntada de documentos.

FUNDAMENTAÇÃO
Presente o dano moral. A conduta do réu viola os direitos da personalidade do autor.
O nexo causal está demonstrado pelos elementos probatórios colhidos durante a instrução.
A indenização deve observar os princípios da proporcionalidade e da vedação ao enriquecimento
sem causa, compensando o sofrimento sem gerar enriquecimento desproporcional ao autor.
A extensão do dano, a culpa do réu e a condição econômica das partes devem ser ponderadas.

DISPOSITIVO
Ante o exposto, condeno o réu ao pagamento de danos morais. Custas processuais pelo réu.
Honorários advocatícios fixados em 10% sobre o valor da condenação. Apelação cabível no
prazo de 15 dias úteis a contar da data da intimação desta sentença de procedência.
`;
    const errors = validateRequestDispositive(draft);
    assert.ok(
      errors.some((e) => e.rule === "INCOMPLETE_RELIEF"),
      `Esperado INCOMPLETE_RELIEF, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "INCOMPLETE_RELIEF")!;
    assert.equal(err.fatal, false);
    const d = err.details as { missingRequests: string[] };
    assert.ok(d.missingRequests.length > 0, "missingRequests deveria conter parâmetro ausente");
  });
});

// ── NEGATIVOS ─────────────────────────────────────────────────────────────────

describe("Negativo: dano moral pedido e enfrentado no dispositivo", () => {
  it("NÃO deve emitir UNADDRESSED_MAIN_REQUEST", () => {
    const draft = `
DOS FATOS
A parte autora relata os fatos que deram origem ao pedido de indenização por dano moral.
O réu agiu de forma negligente, causando prejuízos efetivos à honra e dignidade do autor.
As provas juntadas confirmam a narrativa: documentos, testemunhos e perícia técnica.
Tentativas extrajudiciais foram infrutíferas. O autor busca reparação integral dos danos.

DO DIREITO
A responsabilidade civil está configurada (art. 186 CC). O dano moral é indenizável.
A jurisprudência do STJ é consolidada sobre o tema da reparação por danos morais.

DOS PEDIDOS
Requer a condenação ao pagamento de indenização a título de dano moral no valor de
R$ 10.000,00, bem como ao pagamento de dano material pelos prejuízos comprovados.
Honorários advocatícios nos termos do art. 85 do CPC/2015.

DISPOSITIVO
Ante o exposto, condeno o réu ao pagamento de R$ 8.000,00 a título de dano moral e
R$ 2.000,00 a título de dano material. Honorários advocatícios de 10% sobre a condenação.
Custas pelo réu. Apelação cabível no prazo de 15 dias úteis a partir da intimação.
`;
    const errors = validateRequestDispositive(draft);
    assert.equal(
      errors.filter((e) => e.rule === "UNADDRESSED_MAIN_REQUEST").length,
      0,
      `Não esperado UNADDRESSED_MAIN_REQUEST, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
  });
});

describe("Negativo: pedido subsidiário expressamente apreciado", () => {
  it("NÃO deve emitir UNADDRESSED_SUBSIDIARY_REQUEST", () => {
    const draft = `
DOS FATOS
O segurado relata a incapacidade laborativa decorrente de doença grave que o impede de
exercer suas atividades habituais. O INSS indeferiu o benefício administrativamente.
Os laudos médicos juntados comprovam a gravidade da doença e a extensão da incapacidade.

DO DIREITO
Os requisitos para o benefício por incapacidade estão preenchidos conforme a Lei 8.213/91.

DOS PEDIDOS
Requer a concessão de aposentadoria por incapacidade permanente. Subsidiariamente, requer
a concessão de auxílio por incapacidade temporária. Honorários advocatícios conforme o CPC.

DISPOSITIVO
Ante o exposto, indefiro o pedido de aposentadoria por incapacidade permanente. Defiro,
contudo, o pedido subsidiário de auxílio por incapacidade temporária a partir da DER,
com DIB na data do laudo pericial. Determino a implantação imediata do benefício pelo INSS.
Recurso inominado no prazo legal do JEF. Honorários de 10% sobre as prestações vencidas.
`;
    const errors = validateRequestDispositive(draft);
    assert.equal(
      errors.filter((e) => e.rule === "UNADDRESSED_SUBSIDIARY_REQUEST").length,
      0,
    );
  });
});

describe("Negativo: tutela de urgência expressamente apreciada", () => {
  it("NÃO deve emitir UNADDRESSED_INJUNCTION_REQUEST", () => {
    const draft = `
DA TUTELA DE URGÊNCIA
Requer a concessão de tutela de urgência antecipada para suspender os efeitos do ato
impugnado até o julgamento final. O periculum in mora é manifesto. O fumus boni iuris
decorre da ilegalidade aparente do ato. A tutela é necessária para evitar danos irreversíveis.

DOS FATOS
A administração praticou ato sem amparo legal, violando os princípios da legalidade e motivação.

DO DIREITO
Art. 300 CPC/2015 fundamenta o pedido de tutela. Os requisitos estão presentes no caso.

DOS PEDIDOS
Requer tutela antecipada e procedência do pedido principal de anulação do ato administrativo.

DISPOSITIVO
Defiro a tutela de urgência antecipada para suspender os efeitos do ato impugnado até o
julgamento do mérito. No mérito, julgo procedente o pedido. Anulo o ato administrativo
impugnado por vício de legalidade. Condeno ao pagamento de honorários de 10% sobre a causa.
Apelação cabível no prazo de 15 dias úteis a partir da intimação desta sentença de procedência.
`;
    const errors = validateRequestDispositive(draft);
    assert.equal(
      errors.filter((e) => e.rule === "UNADDRESSED_INJUNCTION_REQUEST").length,
      0,
    );
  });
});

describe("Negativo: dispositivo concede apenas o que foi pedido", () => {
  it("NÃO deve emitir RELIEF_NOT_REQUESTED", () => {
    const draft = `
DOS FATOS
A parte autora relata os fatos relacionados à guarda do filho menor e à fixação de alimentos.
Após a separação, os genitores não chegaram a acordo quanto à guarda e aos alimentos mensais.
O menor necessita de provisão alimentar adequada ao seu desenvolvimento e bem-estar.

DO DIREITO
A guarda compartilhada é a regra (art. 1.584 CC). Os alimentos devem ser fixados conforme
o binômio necessidade/possibilidade. A jurisprudência do STJ é consolidada sobre o tema.

DOS PEDIDOS
Requer a fixação da guarda compartilhada do menor. Requer a fixação de alimentos mensais
em valor proporcional às necessidades do menor e às possibilidades do alimentante réu.
Honorários advocatícios nos termos do art. 85 do CPC/2015.

DISPOSITIVO
Ante o exposto, fixo a guarda compartilhada do menor entre as partes. Fixo alimentos mensais
no valor de R$ 1.200,00 devidos pelo réu. Honorários advocatícios de 10% sobre o valor da
causa. Apelação cabível no prazo de 15 dias úteis a partir da intimação desta sentença.
`;
    const errors = validateRequestDispositive(draft);
    assert.equal(
      errors.filter((e) => e.rule === "RELIEF_NOT_REQUESTED").length,
      0,
    );
  });
});

describe("Negativo: condenação com valor explícito — sem INCOMPLETE_RELIEF", () => {
  it("NÃO deve emitir INCOMPLETE_RELIEF", () => {
    const draft = `
RELATÓRIO
Trata-se de ação indenizatória por danos morais decorrentes de conduta ilícita do réu.
O autor descreveu os fatos na inicial, o réu contestou tempestivamente, e a instrução
probatória foi realizada com oitiva de testemunhas e análise dos documentos juntados.

FUNDAMENTAÇÃO
O dano moral está configurado pela conduta culposa do réu que violou os direitos da
personalidade do autor. O nexo causal está demonstrado. A indenização deve ser fixada
observando a proporcionalidade, a extensão do dano e a capacidade econômica das partes.
O valor de R$ 8.000,00 é adequado para compensar o sofrimento sem gerar enriquecimento.

DISPOSITIVO
Ante o exposto, condeno o réu ao pagamento de danos morais no valor de R$ 8.000,00
(oito mil reais), com correção monetária pelo IPCA-E desde a data do evento danoso e
juros de mora de 1% ao mês desde a citação. Honorários advocatícios de 10% sobre
o valor da condenação. Apelação cabível no prazo de 15 dias úteis.
`;
    const errors = validateRequestDispositive(draft);
    assert.equal(
      errors.filter((e) => e.rule === "INCOMPLETE_RELIEF").length,
      0,
    );
  });
});

// ── Details structure (T11 / T20) ─────────────────────────────────────────────

describe("T20 — Details auditável — todos os campos obrigatórios presentes", () => {
  it("deve incluir requestsFound, dispositiveFound, missingRequests, extraReliefs, requestSectionFound, dispositiveSectionFound, fallbackWindowUsed, skipped", () => {
    const draft = `
RELATÓRIO
Trata-se de ação indenizatória ajuizada pela parte autora em face do réu, pleiteando
indenização por danos morais decorrentes da conduta ilícita descrita na petição inicial.
O réu foi devidamente citado e apresentou contestação tempestiva, refutando os fatos
narrados na inicial e sustentando a ausência de conduta culposa e de dano indenizável.
A instrução probatória foi realizada com oitiva de testemunhas e juntada de documentos.

FUNDAMENTAÇÃO
Presente o dano moral. A conduta do réu viola os direitos da personalidade do autor.
O nexo causal está demonstrado pelos elementos probatórios colhidos durante a instrução.
A indenização deve observar os princípios da proporcionalidade e da vedação ao enriquecimento
sem causa, compensando o sofrimento sem gerar enriquecimento desproporcional ao autor.
A extensão do dano, a culpa do réu e a condição econômica das partes devem ser ponderadas.

DISPOSITIVO
Ante o exposto, condeno o réu ao pagamento de danos morais. Custas processuais pelo réu.
Honorários advocatícios fixados em 10% sobre o valor da condenação. Apelação cabível no
prazo de 15 dias úteis a contar da data da intimação desta sentença de procedência.
`;
    const errors = validateRequestDispositive(draft);
    const err = errors.find((e) => e.rule === "INCOMPLETE_RELIEF");
    assert.ok(err, "INCOMPLETE_RELIEF esperado");
    const d = err!.details as {
      requestsFound: unknown;
      dispositiveFound: unknown;
      missingRequests: unknown;
      extraReliefs: unknown;
      requestSectionFound: unknown;
      dispositiveSectionFound: unknown;
      fallbackWindowUsed: unknown;
      skipped: unknown;
    };
    assert.ok(Array.isArray(d.requestsFound),           "requestsFound deve ser array");
    assert.ok(Array.isArray(d.dispositiveFound),         "dispositiveFound deve ser array");
    assert.ok(Array.isArray(d.missingRequests),          "missingRequests deve ser array");
    assert.ok(Array.isArray(d.extraReliefs),             "extraReliefs deve ser array");
    assert.equal(typeof d.requestSectionFound,  "boolean", "requestSectionFound deve ser boolean");
    assert.equal(typeof d.dispositiveSectionFound, "boolean", "dispositiveSectionFound deve ser boolean");
    assert.equal(typeof d.fallbackWindowUsed,   "boolean", "fallbackWindowUsed deve ser boolean");
    assert.equal(d.skipped, false,                       "skipped deve ser false");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FASE 5.8.1 — HARDENING
// ════════════════════════════════════════════════════════════════════════════

describe("T12 — Texto sem acentos — pedido aposentadoria não enfrentado", () => {
  it("deve emitir UNADDRESSED_MAIN_REQUEST", () => {
    const draft = `
DOS FATOS
O segurado pleiteia aposentadoria por tempo de contribuicao tendo cumprido todos os requisitos
legais exigidos pela legislacao previdenciaria. O INSS indeferiu o beneficio administrativamente,
razao pela qual o segurado busca a via judicial para ver seu direito reconhecido pelo juizo.
O historico laboral esta devidamente comprovado pelos documentos juntados com a peticao inicial.
A qualidade de segurado e o cumprimento da carencia estao comprovados nos presentes autos.

DO DIREITO
O segurado tem direito ao beneficio nos termos da Lei 8.213/91. Todos os requisitos estao
presentes conforme documentos juntados. Os documentos comprovam o tempo de contribuicao e
a qualidade de segurado mantida regularmente ao longo de mais de trinta e cinco anos.

DOS PEDIDOS
Requer a concessao de aposentadoria por tempo de contribuicao a partir do requerimento
administrativo. Requer honorarios advocaticios conforme o art. 85 do Codigo de Processo Civil.

DISPOSITIVO
Ante o exposto, defiro o pedido de declaracao de tempo especial de contribuicao para fins
previdenciarios. Honorarios de 10% sobre o valor da causa. Recurso inominado no prazo legal.
`;
    const errors = validateRequestDispositive(draft);
    assert.ok(
      errors.some((e) => e.rule === "UNADDRESSED_MAIN_REQUEST"),
      `Esperado UNADDRESSED_MAIN_REQUEST, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "UNADDRESSED_MAIN_REQUEST")!;
    assert.equal(err.fatal, false);
    const d = err.details as { missingRequests: string[] };
    assert.ok(d.missingRequests.includes("aposentadoria"), "aposentadoria deveria estar em missingRequests");
  });
});

describe("T13 — Texto curto — deve ser ignorado", () => {
  it("NÃO deve emitir nenhum alerta", () => {
    const draft = `
DOS PEDIDOS
Requer dano moral.

DISPOSITIVO
Julgo improcedente.
`;
    const errors = validateRequestDispositive(draft);
    assert.equal(errors.length, 0, "texto curto não deve gerar alertas");
  });
});

describe("T14 — Template incompleto — deve ser ignorado", () => {
  it("NÃO deve emitir nenhum alerta", () => {
    const draft = `
DOS FATOS
O autor {{NOME DO AUTOR}} ingressou com ação indenizatória requerendo dano moral
em virtude da conduta ilícita praticada pela parte ré. Os fatos ocorreram na data
de [DATA DO EVENTO] no local [ENDEREÇO COMPLETO]. O CPF do autor é [CPF].

DOS PEDIDOS
Requer [PREENCHER] indenização por dano moral no valor de R$ [VALOR].
Requer aposentadoria a partir de [DATA DE INÍCIO] conforme documentos.

DISPOSITIVO
Ante o exposto, condeno ao pagamento de R$ [VALOR]. Honorários de 10%.
`;
    const errors = validateRequestDispositive(draft);
    assert.equal(errors.length, 0, "template incompleto não deve gerar alertas");
  });
});

describe("T15 — Jurisprudência isolada — deve ser ignorada", () => {
  it("NÃO deve emitir nenhum alerta", () => {
    const draft = `
EMENTA: Direito Previdenciário — Aposentadoria por incapacidade permanente — Laudo pericial.
Acórdão do Superior Tribunal de Justiça. Relator: Ministro Fulano de Tal. Turma: 3ª Turma.
Julgado em 01 de janeiro de 2024. DJe publicado em 05 de janeiro de 2024. STF RE 123456.
TRF 4ª Região processo 1234567. TST precedente sobre matéria trabalhista análoga ao caso.
STJ REsp 9876543 julgado pela Segunda Turma. Relator designado para redação do acórdão.
Precedente consolidado pelo STF em sede de repercussão geral vinculante ao caso concreto.
O STJ pacificou entendimento na Súmula 654. STF Tema 123. TRF2 precedente vinculante.
Ementa publicada no Diário de Justiça Eletrônico em data posterior ao julgamento plenário.
`;
    const errors = validateRequestDispositive(draft);
    assert.equal(errors.length, 0, "jurisprudência isolada não deve gerar alertas");
  });
});

describe("T16 — Deduplicação — cada regra aparece no máximo uma vez", () => {
  it("NÃO deve retornar regras duplicadas", () => {
    const draft = `
DOS FATOS
A parte autora alega ter sofrido danos materiais e morais decorrentes da conduta ilícita
da parte ré. Os fatos narrados na inicial demonstram que o réu agiu de forma negligente,
causando prejuízos efetivos ao patrimônio e à honra do autor. As provas juntadas aos autos
confirmam a narrativa apresentada: documentos, testemunhos e laudos técnicos comprovam a
extensão dos danos sofridos. O autor buscou solução extrajudicial sem sucesso, sem resultado.

DO DIREITO
A responsabilidade civil do réu está configurada pelos elementos do art. 186 do Código Civil.
Ação culposa, dano e nexo causal presentes. Impõe-se a condenação ao pagamento de indenização.

DOS PEDIDOS
Requer seja o réu condenado ao pagamento de indenização a título de dano moral no valor mínimo
de R$ 10.000,00. Requer também a condenação ao pagamento de dano material pelos prejuízos.

DISPOSITIVO
Ante o exposto, condeno o réu ao pagamento de R$ 5.000,00 a título de dano material.
Honorários de 10% sobre a condenação. Apelação cabível no prazo de 15 dias úteis.
`;
    const errors = validateRequestDispositive(draft);
    const rules = errors.map((e) => e.rule);
    const unique = new Set(rules);
    assert.equal(rules.length, unique.size, `regras duplicadas detectadas: ${JSON.stringify(rules)}`);
  });
});

describe("T17 — Rejeição global — dano moral pedido, dispositivo julga improcedentes todos os pedidos", () => {
  it("NÃO deve emitir UNADDRESSED_MAIN_REQUEST", () => {
    const draft = `
DOS FATOS
A parte autora alega ter sofrido danos morais graves em razão da conduta ilícita praticada
pelo réu. Os fatos narrados na petição inicial demonstram que houve violação aos direitos
da personalidade do autor. As provas juntadas confirmam a narrativa. A instrução probatória
foi realizada regularmente com oitiva de testemunhas e análise de documentos juntados.

DO DIREITO
O art. 186 do Código Civil configura a responsabilidade civil. Nexo causal demonstrado.
A conduta dolosa do réu gerou dano moral indenizável nos termos da jurisprudência do STJ.

DOS PEDIDOS
Requer a condenação do réu ao pagamento de indenização a título de dano moral no valor
mínimo de R$ 10.000,00. Honorários advocatícios conforme o art. 85 do CPC/2015.

DISPOSITIVO
Ante o exposto, julgo improcedentes todos os pedidos formulados na petição inicial, por
ausência de prova do dano moral alegado. Honorários de 10% sobre o valor da causa.
Apelação cabível no prazo de 15 dias úteis a partir da intimação desta sentença.
`;
    const errors = validateRequestDispositive(draft);
    assert.equal(
      errors.filter((e) => e.rule === "UNADDRESSED_MAIN_REQUEST").length,
      0,
      `Não esperado UNADDRESSED_MAIN_REQUEST quando há rejeição global dos pedidos`,
    );
  });
});

describe("T18 — Rejeição global — pedido subsidiário, dispositivo julga improcedentes todos os pedidos", () => {
  it("NÃO deve emitir UNADDRESSED_SUBSIDIARY_REQUEST", () => {
    const draft = `
DOS FATOS
O segurado pleiteia aposentadoria por incapacidade permanente em razão de doença grave.
Os laudos médicos comprovam a incapacidade total e definitiva para o trabalho habitual.
O INSS indeferiu o benefício administrativamente após perícia realizada pelo órgão gestor.
Toda a documentação está juntada nos presentes autos desta demanda previdenciária judicial.

DO DIREITO
O art. 42 da Lei 8.213/91 ampara o pedido principal de aposentadoria por incapacidade.
O art. 59 ampara o pedido subsidiário de auxílio por incapacidade temporária do segurado.

DOS PEDIDOS
Requer a concessão de aposentadoria por incapacidade permanente. Subsidiariamente, requer
a concessão de auxílio por incapacidade temporária. Honorários advocatícios conforme o CPC.

DISPOSITIVO
Ante o exposto, julgo improcedentes todos os pedidos formulados pelo segurado, pois a
perícia judicial não confirmou a incapacidade alegada na petição inicial desta ação.
Honorários advocatícios de 10% sobre as prestações vencidas. Recurso inominado cabível.
`;
    const errors = validateRequestDispositive(draft);
    assert.equal(
      errors.filter((e) => e.rule === "UNADDRESSED_SUBSIDIARY_REQUEST").length,
      0,
      `Não esperado UNADDRESSED_SUBSIDIARY_REQUEST quando há rejeição global dos pedidos`,
    );
  });
});

describe("T19 — Tutela absorvida pelo mérito — não gera UNADDRESSED_INJUNCTION_REQUEST", () => {
  it("NÃO deve emitir UNADDRESSED_INJUNCTION_REQUEST", () => {
    const draft = `
DA TUTELA DE URGÊNCIA
Requer a concessão de tutela de urgência antecipada para suspender os efeitos do ato
administrativo impugnado até o julgamento final do mérito desta demanda judicial urgente.
O periculum in mora está configurado. O fumus boni iuris decorre da ilegalidade manifesta.

DOS FATOS
A parte autora descreve a conduta ilícita da administração pública que praticou ato ilegal.
Os documentos juntados comprovam todos os fatos narrados na petição inicial desta demanda.

DO DIREITO
O art. 300 do CPC/2015 fundamenta o pedido de tutela antecipada. Requisitos presentes.

DOS PEDIDOS
Requer tutela antecipada e procedência do pedido principal. Honorários conforme CPC.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido. Anulo o ato administrativo impugnado por
vício de legalidade. Tutela absorvida pelo mérito — prejudicado o exame em separado.
Honorários de 10%. Apelação cabível no prazo de 15 dias úteis desta sentença final.
`;
    const errors = validateRequestDispositive(draft);
    assert.equal(
      errors.filter((e) => e.rule === "UNADDRESSED_INJUNCTION_REQUEST").length,
      0,
      `Não esperado UNADDRESSED_INJUNCTION_REQUEST quando tutela absorvida pelo mérito`,
    );
  });
});


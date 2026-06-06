// mvp-smoke.test.ts — FASE 6.0.0
//
// Suite de smoke tests do MVP JudiAudit.
// Objetivo: verificar que o pipeline completo (FinalValidator + AuditReportEngine)
// roda sem exceção para os 8 domínios principais e retorna um AuditReport válido.
//
// NÃO valida mérito jurídico.
// NÃO valida alertas específicos.
// Apenas garante: não quebra + retorna AuditReport com campos obrigatórios.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FinalValidator } from "../../src/validators/final.validator.js";
import { AuditReportEngine } from "../../src/audit-report/audit-report.engine.js";
import {
  makeClassification,
  makeExtraction,
  makeMatrix,
  makeAudit,
} from "../helpers/factories.js";
import type { LegalClassification } from "../../src/pipeline/types.js";

// ── Helper ────────────────────────────────────────────────────────────────────

function runSmoke(
  label: string,
  draft: string,
  classOverrides: Partial<LegalClassification> = {},
): void {
  describe(`Smoke — ${label}`, () => {
    it("pipeline completo roda sem erro e retorna AuditReport", () => {
      const classification = makeClassification(classOverrides);
      const extraction     = makeExtraction();
      const matrix         = makeMatrix();
      const audit          = makeAudit({ score: 80 });

      const validator = new FinalValidator();
      const validationResult = validator.validate(
        draft,
        classification,
        extraction,
        matrix,
        audit,
        [],
        "FINAL_DRAFT",
      );

      assert.ok(Array.isArray(validationResult.errors), "errors deve ser array");
      assert.equal(typeof validationResult.valid, "boolean", "valid deve ser boolean");

      const engine = new AuditReportEngine();
      const report = engine.generate(
        draft,
        validationResult,
        classification,
        extraction,
        matrix,
        audit,
        [],
      );

      assert.ok(report,                                       "report deve existir");
      assert.equal(typeof report.qualidadeTecnica,   "number", "qualidadeTecnica deve ser number");
      assert.equal(typeof report.viabilidadeJuridica, "number", "viabilidadeJuridica deve ser number");
      assert.ok(report.classificacaoFinal,                    "classificacaoFinal deve existir");
      assert.ok(Array.isArray(report.problemasFatais),        "problemasFatais deve ser array");
      assert.ok(Array.isArray(report.problemasNaoFatais),     "problemasNaoFatais deve ser array");
      assert.ok(Array.isArray(report.pontosFortes),           "pontosFortes deve ser array");
      assert.ok(Array.isArray(report.sugestoesMelhoria),      "sugestoesMelhoria deve ser array");
    });
  });
}

// ── Drafts por domínio ────────────────────────────────────────────────────────

const DRAFT_RGPS = `
RELATÓRIO
Trata-se de ação previdenciária ajuizada pelo segurado JOÃO DA SILVA em face do INSS,
pleiteando a concessão de aposentadoria por tempo de contribuição. O autor comprovou o
recolhimento de 35 anos de contribuição ao RGPS. O INSS indeferiu o benefício alegando
ausência de carência mínima, o que é contestado pelos documentos juntados aos autos.
A instrução foi encerrada com juntada de CNIS e contracheques originais devidamente autenticados.

FUNDAMENTAÇÃO
Nos termos do art. 201 da Constituição Federal, a previdência social atenderá os contribuintes
na forma da Lei 8.213/91. O autor demonstrou, pelo CNIS juntado, o recolhimento de 420 meses
de contribuição ao Regime Geral de Previdência Social, superando a carência exigida pelo art. 25
da Lei 8.213/91. A qualidade de segurado está comprovada pelos documentos juntados. O STJ em
precedentes reiterados reconhece o direito à aposentadoria uma vez cumpridos os requisitos legais.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido para condenar o INSS a conceder a aposentadoria por
tempo de contribuição ao autor, com DER fixada na data do requerimento administrativo. Honorários
advocatícios de 10% sobre as parcelas vencidas. Recurso inominado cabível no prazo de 10 dias.
`;

const DRAFT_TRABALHISTA = `
RELATÓRIO
Trata-se de reclamação trabalhista ajuizada por MARIA SOUZA em face de EMPRESA XYZ LTDA,
pleiteando o reconhecimento de vínculo empregatício, pagamento de verbas rescisórias e horas extras.
A reclamante alega ter prestado serviços à reclamada por 3 anos como vendedora, com subordinação,
pessoalidade, onerosidade e habitualidade, sem que fosse registrada. Foram ouvidas testemunhas
que confirmaram as alegações da autora. Os documentos comprovam a habitualidade dos serviços.

FUNDAMENTAÇÃO
Nos termos dos arts. 2º e 3º da CLT, há relação de emprego quando presentes os requisitos de
subordinação, pessoalidade, onerosidade e habitualidade. A prova oral demonstrou que a reclamante
trabalhava exclusivamente para a reclamada, sob suas ordens diretas. O art. 443 CLT não exige forma
especial para o contrato de emprego, que pode ser expresso ou tácito. As testemunhas afirmaram
que a jornada extrapolava 8 horas diárias habitualmente sem pagamento das horas extraordinárias.

DISPOSITIVO
Ante o exposto, reconheço o vínculo empregatício e condeno a reclamada ao pagamento de FGTS,
férias + 1/3, 13º salário, aviso prévio, horas extras com adicional de 50% e multa do art. 477 CLT.
Honorários de 10% nos termos da Súmula 219 TST. Recurso ordinário cabível no prazo de 8 dias.
`;

const DRAFT_FAMILIA = `
RELATÓRIO
Trata-se de ação de guarda ajuizada pela genitora ANA LIMA em face do genitor PEDRO LIMA,
pleiteando a guarda unilateral da filha menor BEATRIZ, de 7 anos. Ambos os genitores têm
boas condições de exercer a guarda. Foi realizado estudo psicossocial que recomendou guarda
compartilhada. A criança tem laços afetivos com ambos os genitores e convivência regular.

FUNDAMENTAÇÃO
Nos termos do art. 1.584 do Código Civil e do art. 227 da Constituição Federal, a guarda deve
atender ao melhor interesse da criança. O ECA, em seus arts. 19 e seguintes, garante o direito
à convivência familiar. O estudo social recomendou a guarda compartilhada, preservando o contato
com ambos os genitores. A jurisprudência do STJ é consolidada no sentido de que a guarda
compartilhada é a regra, salvo quando prejudicial ao menor (Súmula 613 STJ).

DISPOSITIVO
Ante o exposto, estabeleço a guarda compartilhada da menor BEATRIZ entre os genitores, com
residência alternada semanal. Alimentos fixados em 25% dos rendimentos do genitor. Visitas
regulamentadas conforme acordado. Recurso de apelação cabível no prazo de 15 dias úteis.
`;

const DRAFT_CONSUMIDOR = `
RELATÓRIO
Trata-se de ação de indenização por danos morais ajuizada por CARLOS FERREIRA em face do
BANCO DO BRASIL S.A., em razão de negativação indevida do nome do autor nos órgãos de proteção
ao crédito. O autor comprovou o pagamento integral da dívida e a manutenção da negativação por
60 dias após a quitação. A relação de consumo é incontroversa entre fornecedor e consumidor.

FUNDAMENTAÇÃO
A relação de consumo está configurada nos termos do art. 2º do CDC (Lei 8.078/90), sendo o autor
consumidor e o réu fornecedor de serviços bancários. Nos termos do art. 14 do CDC, o fornecedor
responde pelo defeito do serviço independentemente de culpa. A negativação indevida após quitação
configura defeito do serviço e gera dano moral in re ipsa conforme entendimento do STJ (Súmula 385).
O art. 6º, VI, do CDC assegura a reparação dos danos morais. Analisando o caso concreto, o valor
de R$ 5.000,00 é proporcional ao dano sofrido e adequado para fins de compensação e inibição.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido para condenar o réu ao pagamento de R$ 5.000,00 a título
de danos morais, corrigidos monetariamente desde a sentença. Honorários de 10%. Custas processuais.
Apelação cabível no prazo de 15 dias úteis a partir da intimação desta sentença de mérito.
`;

const DRAFT_TRIBUTARIO = `
RELATÓRIO
Trata-se de ação anulatória de débito fiscal ajuizada pela empresa ALFA LTDA em face da
FAZENDA NACIONAL, pleiteando a anulação de auto de infração lavrado para cobrança de IRPJ
supostamente devido no exercício de 2019. A autora alega decadência do direito de lançamento
e ausência do fato gerador. O fisco sustenta regularidade do lançamento realizado em 2024.

FUNDAMENTAÇÃO
Nos termos do art. 150 do CTN, o crédito tributário constituído por homologação decai em 5 anos
do fato gerador. O lançamento foi realizado em 2024, referente ao exercício de 2019, ultrapassando
o prazo decadencial do art. 173 do CTN. A decadência tributária extingue o crédito nos termos
do art. 156, V, do CTN. A jurisprudência do STJ é pacífica no sentido de que a decadência é
matéria de ordem pública, cognoscível de ofício. O auto de infração é, portanto, inválido.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido para anular o auto de infração nº 12345/2024, declarando
extinto o crédito tributário pela decadência. Honorários de 10% sobre o valor da causa. Custas.
Apelação cabível no prazo de 15 dias úteis a partir da intimação desta sentença de mérito.
`;

const DRAFT_CRIMINAL = `
RELATÓRIO
Trata-se de ação penal pública incondicionada em que o Ministério Público denuncia FULANO DE TAL
pela prática do crime de furto simples (art. 155, caput, do Código Penal). A denúncia descreve
que o acusado, no dia 10/01/2024, às 15h, subtraiu para si um celular avaliado em R$ 1.500,00.
A materialidade foi comprovada pelo boletim de ocorrência, exame de corpo de delito e nota fiscal.
A autoria foi confirmada pelo reconhecimento pessoal realizado pela vítima e por testemunhas.

FUNDAMENTAÇÃO
A materialidade delitiva está comprovada pelo exame pericial e pelo boletim de ocorrência.
A autoria é certa, evidenciada pelo reconhecimento da vítima e pelas testemunhas que viram
o acusado com o bem subtraído logo após o fato. Nos termos do art. 155 do CP, o furto simples
é punido com reclusão de 1 a 4 anos e multa. Aplicando o critério trifásico da dosimetria:
1ª fase: pena-base de 1 ano (circunstâncias judiciais neutras); 2ª fase: sem agravantes/atenuantes;
3ª fase: sem causas de aumento/diminuição. Pena definitiva: 1 ano de reclusão.

DISPOSITIVO
Ante o exposto, CONDENO FULANO DE TAL pela prática do crime do art. 155, caput, do CP à pena
de 1 (um) ano de reclusão, em regime inicial aberto, e ao pagamento de 10 dias-multa. Substituo
a pena privativa de liberdade por prestação de serviços à comunidade (art. 44 CP). Apelação cabível.
`;

const DRAFT_AMBIENTAL = `
RELATÓRIO
Trata-se de ação civil pública ajuizada pelo Ministério Público em face de INDÚSTRIA QUÍMICA LTDA
e FAZENDA SANTA RITA, pleiteando a condenação por dano ambiental ao Ribeirão das Pedras causado
pelo descarte irregular de efluentes industriais. O laudo pericial constatou contaminação do
curso d'água por metais pesados em concentração 5 vezes acima do permitido. A área atingida
corresponde a 3 km de extensão do ribeirão e 50 ha de área de preservação permanente.

FUNDAMENTAÇÃO
Nos termos do art. 225 da Constituição Federal e do art. 14, §1º, da Lei 6.938/81 (PNMA),
a responsabilidade por dano ambiental é objetiva, prescindindo de culpa. O nexo causal entre
as atividades das rés e o dano ambiental comprovado foi estabelecido pelo laudo pericial.
A reparação integral do dano é imperativa nos termos do art. 225, §3º, CF. O STJ consolidou
entendimento de que o poluidor responde solidariamente pela reparação ambiental (REsp 1.374.284).

DISPOSITIVO
Ante o exposto, condeno solidariamente as rés à recuperação integral da área degradada no prazo
de 24 meses, sob pena de multa diária de R$ 10.000,00. Condeno ainda ao pagamento de R$ 500.000,00
por danos ambientais residuais. Apelação cabível no prazo de 15 dias úteis a partir da intimação.
`;

const DRAFT_FAZENDA = `
RELATÓRIO
Trata-se de ação mandamental impetrada por SERVIDOR PÚBLICO em face do Estado de São Paulo,
pleiteando o reconhecimento do direito à nomeação para o cargo de Auditor Fiscal, aprovado em
concurso público realizado em 2022. O impetrante foi aprovado em 5º lugar dentro do número de
vagas previsto no edital. O Estado alega inexistência de vagas e impossibilidade orçamentária.
A impetração foi formulada dentro do prazo decadencial de 120 dias (art. 23 da Lei 12.016/09).

FUNDAMENTAÇÃO
A aprovação dentro do número de vagas do edital gera direito subjetivo à nomeação, nos termos
da Súmula 15 do STF e do Tema 784 do STJ. O art. 37, IV, da Constituição Federal garante ao
aprovado o direito à nomeação quando observados os critérios estabelecidos no edital. A recusa
da Administração sem justificativa idônea viola o princípio da boa-fé administrativa. O prazo
para nomeação flui a partir da homologação do concurso, não podendo ser indefinidamente postergado.

DISPOSITIVO
Ante o exposto, concedo a segurança para determinar ao Estado que proceda à nomeação e posse do
impetrante no prazo de 30 dias, sob pena de sequestro de verba. Sem honorários (Súmula 512 STF).
Recurso de apelação cabível no prazo de 15 dias úteis a partir da intimação desta sentença.
`;

// ── Execução dos smoke tests ──────────────────────────────────────────────────

runSmoke("RGPS — Aposentadoria por Tempo de Contribuição", DRAFT_RGPS, {
  tipo_justica: "JEF",
  tipo_peca:    "SENTENCA",
  regime_juridico: "RGPS",
  assunto_principal: "Aposentadoria por tempo de contribuição INSS RGPS",
});

runSmoke("Trabalhista — Reconhecimento de Vínculo + Horas Extras", DRAFT_TRABALHISTA, {
  tipo_justica: "TRABALHO",
  tipo_peca:    "SENTENCA",
  regime_juridico: "CLT",
  assunto_principal: "Reconhecimento de vínculo empregatício e verbas rescisórias",
});

runSmoke("Família — Guarda Compartilhada", DRAFT_FAMILIA, {
  tipo_justica: "ESTADUAL",
  tipo_peca:    "SENTENCA",
  regime_juridico: "CIVIL",
  assunto_principal: "Guarda compartilhada filhos menores alimentos",
});

runSmoke("Consumidor — Dano Moral por Negativação Indevida", DRAFT_CONSUMIDOR, {
  tipo_justica: "ESTADUAL",
  tipo_peca:    "SENTENCA",
  regime_juridico: "CIVIL",
  assunto_principal: "Dano moral consumidor CDC negativação indevida",
});

runSmoke("Tributário — Anulação de Auto de Infração (Decadência)", DRAFT_TRIBUTARIO, {
  tipo_justica: "FEDERAL",
  tipo_peca:    "SENTENCA",
  regime_juridico: "CIVIL",
  assunto_principal: "Anulação de débito fiscal IRPJ decadência CTN tributário",
});

runSmoke("Criminal — Furto Simples (Condenação)", DRAFT_CRIMINAL, {
  tipo_justica: "CRIMINAL",
  tipo_peca:    "SENTENCA",
  regime_juridico: "CRIMINAL",
  assunto_principal: "Furto simples art. 155 CP dosimetria regime",
});

runSmoke("Ambiental — ACP Dano Ambiental", DRAFT_AMBIENTAL, {
  tipo_justica: "FEDERAL",
  tipo_peca:    "SENTENCA",
  regime_juridico: "CIVIL",
  assunto_principal: "Dano ambiental ACP responsabilidade objetiva PNMA",
});

runSmoke("Fazenda Pública — Mandado de Segurança / Nomeação em Concurso", DRAFT_FAZENDA, {
  tipo_justica: "ESTADUAL",
  tipo_peca:    "SENTENCA",
  regime_juridico: "CIVIL",
  assunto_principal: "Mandado de segurança nomeação concurso público servidor",
});

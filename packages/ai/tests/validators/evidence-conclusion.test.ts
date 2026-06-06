import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateEvidenceConclusion } from "../../src/validators/evidence-conclusion.validator.js";

// ════════════════════════════════════════════════════════════════════════════
// FASE 5.9.0 — EVIDENCE × CONCLUSION AUDIT
// ════════════════════════════════════════════════════════════════════════════

// ── POSITIVOS ────────────────────────────────────────────────────────────────

describe("T1 — MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION — laudo confirma incapacidade, benefício negado", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
RELATÓRIO
Trata-se de ação previdenciária ajuizada pelo segurado em face do INSS, pleiteando a
concessão de aposentadoria por incapacidade permanente. O requerente alega incapacidade
total e definitiva para qualquer atividade laborativa. O INSS indeferiu o benefício
administrativamente, alegando ausência de incapacidade verificada em perícia administrativa.
O segurado juntou laudos médicos e documentos que comprovam o histórico de tratamento.

FUNDAMENTAÇÃO
O laudo pericial foi desfavorável ao INSS. O perito concluiu pela incapacidade laboral
total do segurado, atestando que a doença impede qualquer atividade. A perícia médica
demonstra que o requerente está impossibilitado para o exercício de atividades laborativas.
A incapacidade laboral total é reconhecida pelo laudo pericial judicial juntado nos autos.
Os documentos médicos confirmam o diagnóstico e a extensão da incapacidade permanente.
O exame clínico pericial atestou que a condição é irreversível e permanente neste caso.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido de aposentadoria por incapacidade formulado
pelo segurado. Honorários advocatícios de 10% sobre as prestações vencidas. Custas.
Recurso inominado cabível no prazo legal do Juizado Especial Federal desta comarca.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.ok(
      errors.some((e) => e.rule === "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION"),
      `Esperado MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

describe("T2 — SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION — PPP comprova atividade especial, tempo especial negado", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
RELATÓRIO
O segurado pleiteia o reconhecimento de tempo de contribuição especial em razão de
exposição a agentes nocivos durante toda a sua vida laboral. O PPP e o LTCAT juntados
aos autos demonstram as condições de trabalho a que o requerente esteve submetido.
O INSS negou administrativamente o reconhecimento do tempo especial, ensejando esta ação.
Os documentos técnicos foram elaborados pela empresa empregadora e assinados por técnico.

FUNDAMENTAÇÃO
O PPP juntado aos autos é de clareza meridiana ao indicar a exposição habitual e permanente
a agente nocivo ruído acima dos limites de tolerância estabelecidos pela legislação vigente.
O LTCAT demonstra as condições ambientais de trabalho no período questionado pelo segurado.
A exposição permanente ao ruído de intensidade acima do limite é fator de insalubridade.
Os documentos técnicos confirmam a exposição habitual ao agente físico prejudicial à saúde.
O agente nocivo ruído atingia níveis acima de 85 dB conforme medição técnica realizada.

DISPOSITIVO
Ante o exposto, não reconheço o tempo especial de contribuição requerido pelo segurado.
Atividade comum não enseja a conversão pretendida. Honorários de 10%. Custas processuais.
Recurso inominado cabível no prazo legal do Juizado Especial Federal aplicável ao caso.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.ok(
      errors.some((e) => e.rule === "SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION"),
      `Esperado SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

describe("T3 — PAYMENT_PROOF_CONTRADICTION — comprovante de pagamento reconhecido, pagamento negado", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
RELATÓRIO
Trata-se de ação de cobrança ajuizada pelo credor em face do devedor, pleiteando
o pagamento de dívida contraída por contrato de mútuo celebrado entre as partes.
O réu apresentou contestação alegando a quitação da dívida mediante pagamento já realizado.
O réu juntou documentos comprobatórios do pagamento que alega ter realizado tempestivamente.
As partes foram devidamente intimadas e a instrução foi conduzida regularmente nestes autos.

FUNDAMENTAÇÃO
O réu juntou comprovante de pagamento via TED para a conta bancária do credor identificado.
O recibo assinado pelo próprio credor foi juntado como prova do recebimento do valor integral.
A transferência bancária identificada corresponde ao valor exato da dívida objeto da ação.
O comprovante anexado demonstra que a operação foi efetivada dentro do prazo de vencimento.
Os extratos bancários confirmam a movimentação financeira na data e no valor pactuados.
A autenticação bancária do comprovante de pagamento é válida e não foi questionada tecnicamente.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido do autor. Não houve pagamento comprovado da
dívida pelo réu. Condeno o réu ao pagamento do valor principal atualizado. Honorários.
Apelação cabível no prazo de 15 dias úteis a partir da intimação desta sentença.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.ok(
      errors.some((e) => e.rule === "PAYMENT_PROOF_CONTRADICTION"),
      `Esperado PAYMENT_PROOF_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "PAYMENT_PROOF_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

describe("T4 — CONTRACT_EVIDENCE_CONTRADICTION — contrato juntado, relação jurídica negada", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
RELATÓRIO
Trata-se de ação de cobrança fundada em contrato de prestação de serviços celebrado
entre as partes. A autora alega que prestou os serviços contratados e não recebeu
a contraprestação pactuada. O réu nega a existência de qualquer relação jurídica.
Os documentos juntados com a inicial incluem o instrumento contratual assinado por ambas
as partes. A instrução processual foi realizada com oitiva das partes e testemunhas.

FUNDAMENTAÇÃO
O contrato assinado pelas partes foi juntado às fls. e constitui prova documental inequívoca.
O instrumento contratual demonstra o ajuste firmado entre as partes com todas as cláusulas.
O contrato juntado aos autos está devidamente autenticado e reconhecido pelas partes.
O documento contratual tem firma reconhecida e data certa, conferindo plena validade jurídica.
As testemunhas ouvidas confirmaram a assinatura e a existência do contrato entre as partes.
A validade formal do instrumento contratual não foi impugnada por nenhuma das partes.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido por inexistência de relação jurídica comprovada
entre as partes. Honorários advocatícios de 10% sobre o valor da causa. Custas processuais.
Apelação cabível no prazo de 15 dias úteis a partir da intimação desta sentença de mérito.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.ok(
      errors.some((e) => e.rule === "CONTRACT_EVIDENCE_CONTRADICTION"),
      `Esperado CONTRACT_EVIDENCE_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "CONTRACT_EVIDENCE_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

describe("T5 — WITNESS_OVERTIME_CONTRADICTION — testemunha confirma jornada, horas extras negadas", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
RELATÓRIO
Trata-se de reclamação trabalhista ajuizada pelo reclamante em face de sua ex-empregadora,
pleiteando o pagamento de horas extras em razão da jornada extraordinária habitual prestada
além dos limites legais durante toda a relação de emprego. O reclamante afirma ter laborado
sistematicamente além do horário contratual sem o devido pagamento das horas extraordinárias.
O reclamado nega a realização de trabalho além da jornada contratual regular de oito horas.

FUNDAMENTAÇÃO
A prova testemunhal foi farta e consistente na comprovação da jornada extraordinária habitual.
Testemunha confirmou que o reclamante trabalhava regularmente até as 20h todos os dias úteis.
As testemunhas afirmaram que o labor extraordinário era prática comum naquele departamento.
A jornada extraordinária era de conhecimento da supervisão da empresa reclamada conforme prova.
A prova testemunhal confirma a prestação habitual de horas além da jornada contratual legal.
Os registros de ponto apresentados foram impugnados pelas testemunhas como fraudados na empresa.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido de horas extras por ausência de prova suficiente
da jornada extraordinária alegada. Honorários de 10% sobre o valor arbitrado da causa.
Recurso ordinário cabível no prazo de 8 dias úteis a partir da intimação desta sentença.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.ok(
      errors.some((e) => e.rule === "WITNESS_OVERTIME_CONTRADICTION"),
      `Esperado WITNESS_OVERTIME_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "WITNESS_OVERTIME_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

describe("T6 — DEPENDENCY_EVIDENCE_CONTRADICTION — dependência econômica reconhecida, pensão negada", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
RELATÓRIO
Trata-se de ação previdenciária em que a requerente pleiteia a concessão de pensão por
morte em razão do falecimento do instituidor do benefício. O INSS indeferiu o benefício
alegando que a requerente não comprovou a dependência econômica necessária para a concessão.
A requerente juntou documentos que demonstram sua dependência financeira em relação ao falecido.
A instrução foi realizada regularmente com juntada de documentos e declarações das partes.

FUNDAMENTAÇÃO
A dependência econômica da requerente em relação ao falecido foi comprovada pelos documentos.
A dependente demonstrou que o falecido era responsável pela integralidade do sustento familiar.
A dependência demonstrada pelos documentos juntados é inequívoca e incontroversa nos autos.
Os extratos bancários mostram que a requerente recebia depósitos regulares do instituidor.
A condição de dependente econômico é reconhecida pelos documentos juntados neste processo.
As declarações e comprovantes juntados atestam a dependência econômica da requerente no caso.

DISPOSITIVO
Ante o exposto, indefiro a pensão por morte por ausência de dependência econômica comprovada
em relação ao falecido instituidor. Honorários de 10% sobre as prestações vencidas. Custas.
Recurso inominado cabível no prazo legal do Juizado Especial Federal desta comarca judicial.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.ok(
      errors.some((e) => e.rule === "DEPENDENCY_EVIDENCE_CONTRADICTION"),
      `Esperado DEPENDENCY_EVIDENCE_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "DEPENDENCY_EVIDENCE_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

// ── NEGATIVOS ─────────────────────────────────────────────────────────────────

describe("T7 — Negativo: laudo confirma incapacidade e benefício é concedido", () => {
  it("NÃO deve emitir MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION", () => {
    const draft = `
RELATÓRIO
O segurado pleiteia aposentadoria por incapacidade permanente. O laudo pericial foi
favorável ao segurado, reconhecendo incapacidade laboral total. O perito concluiu pela
incapacidade permanente para qualquer atividade. O INSS contestou o laudo pericial.
A instrução foi regular com perícia judicial e documental nos presentes autos.

FUNDAMENTAÇÃO
O laudo pericial confirma a incapacidade laboral total e permanente do segurado. A perícia
médica reconheceu a incapacidade. O perito concluiu que o requerente está incapacitado.
A incapacidade laboral permanente foi comprovada e demonstrada pelos documentos médicos.
Todos os requisitos legais estão preenchidos para a concessão do benefício previdenciário.
Os documentos e o laudo pericial corroboram o pedido formulado na petição inicial desta ação.
A prova dos autos é suficiente para o deferimento do benefício pleiteado pelo segurado.

DISPOSITIVO
Ante o exposto, concedo a aposentadoria por incapacidade permanente. Determino a implantação
do benefício a partir da DER. Honorários de 10% sobre as prestações vencidas calculadas.
Recurso inominado cabível no prazo legal do Juizado Especial Federal desta comarca.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(
      errors.filter((e) => e.rule === "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION").length,
      0,
      `Não esperado MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION quando benefício é concedido`,
    );
  });
});

describe("T8 — Negativo: PPP comprova atividade especial e tempo especial é reconhecido", () => {
  it("NÃO deve emitir SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION", () => {
    const draft = `
RELATÓRIO
O segurado pleiteia o reconhecimento de tempo especial. O PPP e o LTCAT demonstram
a exposição habitual e permanente a agente nocivo ruído. O INSS contestou os documentos.
A instrução foi regular com análise dos documentos técnicos juntados pelo requerente.
A empresa empregadora assinou o PPP e o LTCAT com todas as informações necessárias.

FUNDAMENTAÇÃO
O PPP juntado é válido e comprova a exposição habitual ao agente nocivo ruído acima do
limite. O LTCAT confirma a exposição permanente ao agente físico nocivo durante todo o período.
A exposição habitual ao ruído acima dos limites está comprovada pelos documentos juntados.
O agente nocivo presente no ambiente laboral afeta a saúde conforme laudos técnicos juntados.
Os requisitos para o reconhecimento do tempo especial estão preenchidos no caso concreto.
A documentação técnica é válida, regular e suficiente para o reconhecimento pretendido.

DISPOSITIVO
Ante o exposto, reconheço o tempo especial de contribuição requerido pelo segurado durante
o período comprovado pelos documentos juntados. Determino a averbação do tempo especial.
Honorários de 10% sobre as prestações vencidas. Recurso inominado no prazo legal aplicável.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(
      errors.filter((e) => e.rule === "SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION").length,
      0,
      `Não esperado SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION quando tempo especial reconhecido`,
    );
  });
});

describe("T9 — Negativo: comprovante de pagamento reconhecido e cobrança julgada improcedente", () => {
  it("NÃO deve emitir PAYMENT_PROOF_CONTRADICTION", () => {
    const draft = `
RELATÓRIO
Trata-se de ação de cobrança. O réu apresentou contestação com comprovante de pagamento
via PIX e recibo assinado pelo credor. A autora não impugnou os documentos apresentados.
A instrução foi regular com análise dos documentos de quitação juntados pela defesa.
O comprovante de pagamento via transferência bancária foi juntado dentro do prazo legal.

FUNDAMENTAÇÃO
O comprovante de pagamento juntado pelo réu é válido e demonstra a quitação da dívida. O recibo
assinado confirma o recebimento. A transferência bancária via PIX comprova o pagamento realizado.
O comprovante anexado corresponde ao valor integral da dívida objeto desta demanda.
A autenticidade do comprovante de pagamento não foi contestada pela parte autora nos autos.
A quitação foi demonstrada de forma inequívoca pelos documentos juntados pelo demandado.
O recibo assinado pelo próprio credor tem força probatória absoluta para comprovar pagamento.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido da autora, pois o pagamento da dívida foi
comprovado pelos documentos juntados pelo réu. Honorários de 10%. Custas processuais.
Apelação cabível no prazo de 15 dias úteis a partir da intimação desta sentença de mérito.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(
      errors.filter((e) => e.rule === "PAYMENT_PROOF_CONTRADICTION").length,
      0,
      `Não esperado PAYMENT_PROOF_CONTRADICTION quando pagamento foi reconhecido como válido`,
    );
  });
});

describe("T10 — Negativo: contrato juntado e relação jurídica reconhecida", () => {
  it("NÃO deve emitir CONTRACT_EVIDENCE_CONTRADICTION", () => {
    const draft = `
RELATÓRIO
Trata-se de ação de cobrança fundada em contrato de prestação de serviços. O contrato
assinado pelas partes foi juntado. O réu contesta o valor cobrado, não a existência do contrato.
O instrumento contratual demonstra o ajuste firmado e as obrigações pactuadas pelas partes.
A instrução probatória foi regular com análise do documento contratual juntado nos autos.

FUNDAMENTAÇÃO
O contrato assinado é válido e comprova a relação jurídica estabelecida entre as partes.
O instrumento contratual foi devidamente firmado e autenticado por ambas as partes envolvidas.
O contrato juntado tem força probatória para demonstrar as obrigações assumidas contratualmente.
O documento contratual é claro e não permite dúvida quanto à existência da relação jurídica.
Os serviços foram prestados conforme o contrato, e o valor é devido conforme o pactuado.
A relação jurídica está comprovada pelo contrato assinado juntado nestes presentes autos.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido. Reconheço a relação jurídica e condeno o réu ao
pagamento do valor contratado. Honorários de 10% sobre a condenação. Custas processuais.
Apelação cabível no prazo de 15 dias úteis a partir da intimação desta sentença de mérito.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(
      errors.filter((e) => e.rule === "CONTRACT_EVIDENCE_CONTRADICTION").length,
      0,
      `Não esperado CONTRACT_EVIDENCE_CONTRADICTION quando relação jurídica reconhecida`,
    );
  });
});

describe("T11 — Negativo: prova testemunhal confirma jornada e horas extras são concedidas", () => {
  it("NÃO deve emitir WITNESS_OVERTIME_CONTRADICTION", () => {
    const draft = `
RELATÓRIO
O reclamante pleiteia horas extras. A prova testemunhal confirma a jornada extraordinária.
Testemunhas afirmaram que o labor extraordinário era habitual. O reclamado contesta.
A instrução trabalhista foi regular com oitiva de testemunhas e análise dos registros.
A jornada extraordinária foi objeto de instrução probatória completa nestes autos.

FUNDAMENTAÇÃO
A prova testemunhal é contundente ao confirmar a jornada extraordinária habitual realizada.
Testemunha confirmou que o reclamante trabalhava além do horário todos os dias da semana.
As testemunhas afirmaram ser o labor extraordinário uma prática corrente na empresa reclamada.
A jornada extraordinária está comprovada pela prova oral e pelos registros de ponto juntados.
A sobrejornada era do conhecimento da supervisão e foi tolerada pela gestão da empresa ré.
O reclamante tem direito ao pagamento das horas extras habituais comprovadas nesta demanda.

DISPOSITIVO
Ante o exposto, condeno a reclamada ao pagamento de horas extras com adicional de 50%.
As horas extras são devidas conforme prova produzida nos autos desta reclamação trabalhista.
Recurso ordinário cabível no prazo de 8 dias úteis a partir da intimação desta sentença.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(
      errors.filter((e) => e.rule === "WITNESS_OVERTIME_CONTRADICTION").length,
      0,
      `Não esperado WITNESS_OVERTIME_CONTRADICTION quando horas extras são concedidas`,
    );
  });
});

describe("T12 — Negativo: dependência econômica comprovada e pensão concedida", () => {
  it("NÃO deve emitir DEPENDENCY_EVIDENCE_CONTRADICTION", () => {
    const draft = `
RELATÓRIO
A requerente pleiteia pensão por morte. A dependência econômica foi comprovada pelos
documentos juntados. O INSS contesta a qualidade de dependente da requerente beneficiária.
A instrução foi regular com análise dos documentos comprobatórios juntados pela requerente.
O falecido era responsável pelo sustento da família conforme documentos apresentados.

FUNDAMENTAÇÃO
A dependência econômica da requerente foi comprovada pelos documentos de maneira inequívoca.
A dependente demonstrou ser beneficiária do falecido para fins previdenciários e financeiros.
A dependência econômica reconhecida pelos documentos é suficiente para o deferimento da pensão.
Os requisitos legais para a concessão da pensão por morte estão todos preenchidos no caso.
A qualidade de dependente está demonstrada e não há razão para negar o benefício previdenciário.
A dependência econômica comprovada é fator determinante para a concessão da pensão por morte.

DISPOSITIVO
Ante o exposto, concedo a pensão por morte à requerente. Determino a implantação do benefício.
Honorários de 10% sobre as prestações vencidas calculadas na forma da lei previdenciária.
Recurso inominado cabível no prazo legal do Juizado Especial Federal desta comarca judicial.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(
      errors.filter((e) => e.rule === "DEPENDENCY_EVIDENCE_CONTRADICTION").length,
      0,
      `Não esperado DEPENDENCY_EVIDENCE_CONTRADICTION quando pensão concedida`,
    );
  });
});

// ── HARDENING ─────────────────────────────────────────────────────────────────

describe("T13 — Hardening: texto sem acentos — regra 1 deve disparar corretamente", () => {
  it("deve emitir MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION em texto sem acentos", () => {
    const draft = `
RELATORIO
O segurado pleiteia aposentadoria por incapacidade. O INSS indeferiu o beneficio.
O segurado busca a via judicial para ver seu direito reconhecido perante o juizo competente.
Os documentos medicos foram juntados com a peticao inicial para comprovar a incapacidade.

FUNDAMENTACAO
O laudo pericial confirma a incapacidade laboral total do segurado para qualquer atividade.
A pericia medica realizada pelo perito judicial atesta a impossibilidade de laborar.
A incapacidade laboral permanente esta comprovada pelos documentos medicos e pelo laudo.
O perito concluiu pelo estado total de incapacidade, sendo impossivel qualquer atividade.
Os documentos juntados corroboram as conclusoes do laudo pericial realizado judicialmente.
A incapacidade parcial foi confirmada pelo exame pericial com todos os laudos medicos.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido de aposentadoria por incapacidade permanente.
Beneficio indevido por ausencia de requisito legal. Honorarios de 10%. Custas processuais.
Recurso inominado cabivel no prazo legal do Juizado Especial Federal desta comarca.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.ok(
      errors.some((e) => e.rule === "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION"),
      `Esperado MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION em texto sem acentos, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
  });
});

describe("T14 — Hardening: texto curto deve ser ignorado", () => {
  it("NÃO deve emitir nenhum alerta para texto curto", () => {
    const draft = `
FUNDAMENTAÇÃO
O laudo pericial confirma incapacidade total.

DISPOSITIVO
Julgo improcedente.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(errors.length, 0, "texto curto não deve gerar alertas");
  });
});

describe("T15 — Hardening: template incompleto deve ser ignorado", () => {
  it("NÃO deve emitir nenhum alerta para template com marcadores", () => {
    const draft = `
FUNDAMENTAÇÃO
O laudo pericial [LAUDO AQUI] confirma a incapacidade laboral do segurado {{NOME}}.
O perito concluiu pela incapacidade laboral do requerente. CPF do autor: [CPF].
Os documentos juntados [DOCUMENTOS] comprovam a incapacidade total e permanente.

DISPOSITIVO
Ante o exposto, [PREENCHER] o pedido de aposentadoria. Honorários de 10%.
Recurso cabível no prazo de [PRAZO] dias. [DATA DA SENTENÇA]. XXX. _________.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(errors.length, 0, "template incompleto não deve gerar alertas");
  });
});

describe("T16 — Hardening: jurisprudência isolada deve ser ignorada", () => {
  it("NÃO deve emitir nenhum alerta para texto de jurisprudência isolada", () => {
    const draft = `
EMENTA: Direito Previdenciário — Aposentadoria por incapacidade — Laudo pericial favorável.
Acórdão do Superior Tribunal de Justiça sobre benefício por incapacidade laboral permanente.
Relator: Ministro Fulano de Tal. Quinta Turma. Julgado em 01/01/2024. DJe 05/01/2024.
STF Repercussão Geral Tema 123. TRF 4ª Região precedente consolidado. TST processo 9876.
STJ REsp 1234567. Relator designado para redação do acórdão final deste julgamento plenário.
Precedente vinculante publicado no Diário de Justiça Eletrônico. STF julgou o mérito.
Ementa publicada após o julgamento pela Turma completa com quórum pleno de ministros.
Julgado em sessão ordinária. DJe publicado regularmente. Relator confirmou o entendimento.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(errors.length, 0, "jurisprudência isolada não deve gerar alertas");
  });
});

describe("T17 — Hardening: deduplicação — cada regra aparece no máximo uma vez", () => {
  it("NÃO deve retornar regras duplicadas", () => {
    const draft = `
RELATÓRIO
O segurado pleiteia aposentadoria por incapacidade. O PPP comprova atividade especial.
O INSS negou todos os pedidos. Os documentos médicos foram juntados com a inicial.
O requerente submete comprovante de pagamento de contribuições em atraso junto à autarquia.

FUNDAMENTAÇÃO
O laudo pericial confirma incapacidade laboral total e permanente do segurado requerente.
O PPP demonstra exposição habitual e permanente ao agente nocivo ruído acima do limite.
A incapacidade laboral total foi atestada pelo perito judicial nomeado para o caso.
A exposição habitual ao agente nocivo está documentada pelo PPP e pelo LTCAT juntados.
Os documentos médicos e periciais confirmam todas as alegações do segurado neste processo.
O comprovante de pagamento juntado demonstra a regularidade das contribuições previdenciárias.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido. Benefício indevido. Não reconheço o tempo especial.
Honorários de 10%. Custas processuais pelo segurado. Recurso inominado no prazo legal.
`;
    const errors = validateEvidenceConclusion(draft);
    const rules = errors.map((e) => e.rule);
    const unique = new Set(rules);
    assert.equal(rules.length, unique.size, `regras duplicadas: ${JSON.stringify(rules)}`);
  });
});

describe("T18 — Hardening: fallback 80/20 — sem seção dispositivo explícita", () => {
  it("deve emitir alerta mesmo sem marcador de dispositivo explícito", () => {
    const line = "O laudo pericial confirma incapacidade laboral total e permanente do segurado. ";
    const evidenceBlock = line.repeat(9);
    const conclusionBlock =
      "Julgo improcedente o pedido. Beneficio indevido por ausencia de incapacidade. " +
      "Honorarios de 10% sobre o valor da causa. Recurso cabivel no prazo legal aplicavel.";
    const draft = evidenceBlock + conclusionBlock;

    const errors = validateEvidenceConclusion(draft);
    assert.ok(
      errors.some((e) => e.rule === "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION"),
      `Esperado MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION com fallback 80/20, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION")!;
    const d = err.details as { fallbackWindowUsed: boolean };
    assert.equal(d.fallbackWindowUsed, true, "fallbackWindowUsed deve ser true");
  });
});

describe("T19 — Hardening: details auditável — todos os campos obrigatórios presentes", () => {
  it("deve incluir evidenceMatched, conclusionMatched, evidenceSectionFound, dispositiveSectionFound, fallbackWindowUsed, skipped", () => {
    const draft = `
RELATÓRIO
O segurado pleiteia aposentadoria por incapacidade. O INSS indeferiu o pedido.
Os documentos médicos foram juntados com a petição inicial para comprovar o quadro.
A instrução foi regular com juntada de documentos e realização de perícia judicial.

FUNDAMENTAÇÃO
O laudo pericial confirma a incapacidade laboral total e permanente do requerente segurado.
A perícia médica realizada pelo perito judicial atesta a impossibilidade de exercer atividade.
A incapacidade laboral total está comprovada pelo laudo e pelos documentos médicos juntados.
O perito concluiu pelo estado total de incapacidade permanente para qualquer atividade laboral.
Os documentos corroboram as conclusões do laudo pericial realizado nestes autos do processo.
A incapacidade permanente foi confirmada por exame pericial com todos os laudos médicos.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido de aposentadoria por incapacidade permanente.
Honorários advocatícios de 10% sobre o valor da causa. Custas processuais pelo autor.
Recurso inominado cabível no prazo legal do Juizado Especial Federal desta comarca judicial.
`;
    const errors = validateEvidenceConclusion(draft);
    const err = errors.find((e) => e.rule === "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION");
    assert.ok(err, "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION esperado");
    const d = err!.details as {
      evidenceMatched: unknown;
      conclusionMatched: unknown;
      evidenceSectionFound: unknown;
      dispositiveSectionFound: unknown;
      fallbackWindowUsed: unknown;
      skipped: unknown;
    };
    assert.ok(Array.isArray(d.evidenceMatched),            "evidenceMatched deve ser array");
    assert.ok(Array.isArray(d.conclusionMatched),          "conclusionMatched deve ser array");
    assert.equal(typeof d.evidenceSectionFound,    "boolean", "evidenceSectionFound deve ser boolean");
    assert.equal(typeof d.dispositiveSectionFound, "boolean", "dispositiveSectionFound deve ser boolean");
    assert.equal(typeof d.fallbackWindowUsed,      "boolean", "fallbackWindowUsed deve ser boolean");
    assert.equal(d.skipped, false,                          "skipped deve ser false");
  });
});

// ── HARDENING 5.9.1 ───────────────────────────────────────────────────────────

describe("T20 — 5.9.1 Hardening: texto sem acentos — regra médica dispara", () => {
  it("deve emitir MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION em texto sem acentos", () => {
    const draft = `
RELATORIO
Segurado pleiteia aposentadoria por incapacidade permanente. O INSS indeferiu o beneficio
administrativamente. O segurado juntou laudos medicos e documentos comprobatorios do quadro.
A instrucao foi regular com juntada de documentos e realizacao de pericia judicial neste feito.

FUNDAMENTACAO
O laudo pericial realizado pelo perito judicial confirma a incapacidade laboral total.
A pericia medica atesta a impossibilidade de laborar em qualquer atividade remunerada.
A incapacidade laboral permanente esta comprovada pelos laudos e documentos medicos juntados.
O perito concluiu que o requerente esta totalmente incapacitado para qualquer atividade laboral.
Os documentos medicos corroboram as conclusoes da pericia judicial realizada regularmente.
O exame pericial demonstra que a condicao do segurado e irreversivel e permanente neste caso.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido de aposentadoria por incapacidade formulado.
Beneficio indevido por ausencia de requisito legal especifico. Honorarios de 10%. Custas.
Recurso inominado cabivel no prazo legal do Juizado Especial Federal desta comarca aplicavel.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.ok(
      errors.some((e) => e.rule === "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION"),
      `Esperado MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION em texto sem acentos, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
  });
});

describe("T21 — 5.9.1 Hardening: texto curto deve ser ignorado", () => {
  it("NÃO deve emitir nenhum alerta para texto curto", () => {
    const draft = `
FUNDAMENTAÇÃO
O laudo pericial confirma incapacidade total.
DISPOSITIVO
Julgo improcedente.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(errors.length, 0, "texto curto não deve gerar alertas");
  });
});

describe("T22 — 5.9.1 Hardening: template incompleto deve ser ignorado", () => {
  it("NÃO deve emitir nenhum alerta para template com marcadores", () => {
    const draft = `
FUNDAMENTAÇÃO
O laudo pericial [LAUDO AQUI] confirma a incapacidade laboral do segurado {{NOME}}.
O perito concluiu pela incapacidade laboral do requerente. CPF do autor: [CPF].
Os documentos juntados [DOCUMENTOS] comprovam a incapacidade total e permanente.

DISPOSITIVO
Ante o exposto, [PREENCHER] o pedido de aposentadoria. Honorários de 10%.
Recurso cabível no prazo de [PRAZO] dias. [DATA DA SENTENÇA]. XXX. _________.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(errors.length, 0, "template incompleto não deve gerar alertas");
  });
});

describe("T23 — 5.9.1 Hardening: jurisprudência isolada deve ser ignorada", () => {
  it("NÃO deve emitir nenhum alerta para texto de jurisprudência isolada", () => {
    const draft = `
EMENTA: Direito Previdenciário — Aposentadoria por incapacidade — Laudo pericial favorável.
Acórdão do Superior Tribunal de Justiça sobre benefício por incapacidade laboral permanente.
Relator: Ministro Fulano de Tal. Quinta Turma. Julgado em 01/01/2024. DJe 05/01/2024.
STF Repercussão Geral Tema 123. TRF 4ª Região precedente consolidado. TST processo 9876.
STJ REsp 1234567. Relator designado para redação do acórdão final deste julgamento plenário.
Precedente vinculante publicado no Diário de Justiça Eletrônico. STF julgou o mérito.
Ementa publicada após o julgamento pela Turma completa com quórum pleno de ministros.
Julgado em sessão ordinária. DJe publicado regularmente. Relator confirmou o entendimento.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(errors.length, 0, "jurisprudência isolada não deve gerar alertas");
  });
});

describe("T24 — 5.9.1 Hardening: deduplicação — mesmo alerta não pode aparecer duas vezes", () => {
  it("deve emitir cada regra no máximo uma vez", () => {
    const draft = `
RELATÓRIO
O segurado pleiteia aposentadoria por incapacidade. O PPP comprova atividade especial.
O INSS negou todos os pedidos. Os documentos médicos foram juntados com a inicial pelo advogado.
O requerente submete comprovante de pagamento de contribuições em atraso junto à autarquia.

FUNDAMENTAÇÃO
O laudo pericial confirma incapacidade laboral total e permanente do segurado requerente.
O PPP demonstra exposição habitual e permanente ao agente nocivo ruído acima do limite legal.
A incapacidade laboral total foi atestada pelo perito judicial nomeado para o caso concreto.
A exposição habitual ao agente nocivo está documentada pelo PPP e pelo LTCAT juntados.
Os documentos médicos e periciais confirmam todas as alegações do segurado neste processo.
O comprovante de pagamento juntado demonstra a regularidade das contribuições previdenciárias.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido. Benefício indevido. Não reconheço o tempo especial.
Honorários de 10%. Custas processuais pelo segurado. Recurso inominado no prazo legal.
`;
    const errors = validateEvidenceConclusion(draft);
    const rules = errors.map((e) => e.rule);
    const unique = new Set(rules);
    assert.equal(rules.length, unique.size, `regras duplicadas detectadas: ${JSON.stringify(rules)}`);
  });
});

describe("T25 — 5.9.1 Proteção médica: laudo negativo não deve gerar alerta", () => {
  it("NÃO deve emitir MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION quando prova é negativa", () => {
    const draft = `
RELATÓRIO
O segurado pleiteia aposentadoria por incapacidade permanente. O INSS indeferiu o benefício
administrativamente, alegando capacidade laboral verificada em perícia. O requerente recorre
da decisão administrativa e busca a via judicial para questionar a conclusão da autarquia.
A instrução foi realizada regularmente com realização de perícia judicial nos presentes autos.

FUNDAMENTAÇÃO
O laudo pericial foi realizado pelo perito judicial nomeado pelo juízo. A perícia médica
foi conduzida com rigor técnico e o exame clínico foi completo. O perito não constatou
incapacidade laboral no requerente, concluindo que ele está apto ao trabalho regular.
A capacidade laboral preservada foi constatada pelo exame pericial realizado judicialmente.
Os documentos médicos juntados não são suficientes para infirmar as conclusões do perito.
O laudo pericial é claro ao concluir que o segurado possui capacidade para laborar.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido de aposentadoria por incapacidade permanente.
Honorários advocatícios de 10% sobre o valor da causa. Custas processuais pelo demandante.
Recurso inominado cabível no prazo legal do Juizado Especial Federal desta comarca judicial.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(
      errors.filter((e) => e.rule === "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION").length,
      0,
      "laudo negativo não deve gerar MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION",
    );
  });
});

describe("T26 — 5.9.1 Proteção PPP/LTCAT: PPP negativo não deve gerar alerta", () => {
  it("NÃO deve emitir SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION quando PPP é negativo", () => {
    const draft = `
RELATÓRIO
O segurado pleiteia o reconhecimento de tempo especial. O PPP foi juntado aos autos.
O INSS sustenta que os documentos são insuficientes para comprovar a atividade especial.
A instrução foi regular com análise dos documentos técnicos juntados pelo requerente.
O laudo técnico foi elaborado pela empresa empregadora e encaminhado ao juízo competente.

FUNDAMENTAÇÃO
O PPP não comprova exposição habitual e permanente a agente nocivo acima dos limites legais.
A análise do LTCAT demonstra que os valores medidos estavam dentro dos limites de tolerância.
O agente nocivo não foi identificado nos patamares legais exigidos para reconhecimento especial.
O PPP juntado é insuficiente para demonstrar exposição permanente a agente nocivo prejudicial.
Os documentos técnicos não atingem o nível de prova necessário para o reconhecimento pretendido.
A exposição não comprovada pelos laudos inviabiliza o reconhecimento do tempo especial pleiteado.

DISPOSITIVO
Ante o exposto, não reconheço o tempo especial pleiteado pelo segurado. Atividade comum.
Honorários de 10% sobre o valor da causa. Custas processuais. Recurso inominado no prazo.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(
      errors.filter((e) => e.rule === "SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION").length,
      0,
      "PPP negativo não deve gerar SPECIAL_ACTIVITY_EVIDENCE_CONTRADICTION",
    );
  });
});

describe("T27 — 5.9.1 Proteção pagamento: ausência de comprovante não deve gerar alerta", () => {
  it("NÃO deve emitir PAYMENT_PROOF_CONTRADICTION quando comprovante é negado na prova", () => {
    const draft = `
RELATÓRIO
Trata-se de ação de cobrança. O réu alega pagamento mas não apresentou documentos válidos.
O réu sustenta que realizou pagamento via PIX mas não há comprovante de pagamento nos autos.
A autora afirma que a dívida não foi quitada e que o réu não comprovou nenhum pagamento.
A instrução foi regular com intimação das partes e análise dos documentos juntados nos autos.

FUNDAMENTAÇÃO
O réu afirma ter realizado pagamento via TED ou PIX mas não juntou qualquer comprovante válido.
A ausência de comprovante é determinante para o julgamento desta demanda. Não há comprovante
de pagamento nos autos que demonstre a quitação da dívida cobrada pela autora neste processo.
Sem comprovante de pagamento válido, não é possível acolher a tese defensiva do demandado.
Os extratos bancários do réu não foram juntados e o recibo alegado não existe nos autos.
A inexistência de recibo ou qualquer documento comprobatório inviabiliza a tese de quitação.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido. Não houve pagamento comprovado da dívida.
Condeno o réu ao pagamento do principal. Honorários de 10%. Custas processuais.
Apelação cabível no prazo de 15 dias úteis a partir da intimação desta sentença de mérito.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(
      errors.filter((e) => e.rule === "PAYMENT_PROOF_CONTRADICTION").length,
      0,
      "ausência de comprovante na prova não deve gerar PAYMENT_PROOF_CONTRADICTION",
    );
  });
});

describe("T28 — 5.9.1 Proteção contratual: instrumento contratual negado não deve gerar alerta", () => {
  it("NÃO deve emitir CONTRACT_EVIDENCE_CONTRADICTION quando contrato é negado na prova", () => {
    const draft = `
RELATÓRIO
Trata-se de ação de cobrança por suposta prestação de serviços. O réu nega a existência
de qualquer relação jurídica contratual entre as partes. A autora não juntou instrumento
contratual escrito. A instrução foi conduzida regularmente com oitiva das partes nestes autos.
Os documentos juntados pela autora são insuficientes para comprovar a relação alegada.

FUNDAMENTAÇÃO
Não há instrumento contratual nos autos que demonstre a relação jurídica alegada pela autora.
A ausência de instrumento contratual é elemento central para o julgamento desta demanda.
O contrato não foi assinado entre as partes, pois não há documento formal que comprove acordo.
A falta de instrumento contratual escrito fragiliza a tese da autora sobre a relação jurídica.
Os e-mails e mensagens juntados não suprem a ausência de contrato assinado entre as partes.
A inexistência de contrato formal impede o reconhecimento da relação jurídica pleiteada.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido por ausência de vínculo contratual comprovado.
Honorários de 10% sobre o valor da causa. Custas processuais pela parte autora da ação.
Apelação cabível no prazo de 15 dias úteis a partir da intimação desta sentença de mérito.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(
      errors.filter((e) => e.rule === "CONTRACT_EVIDENCE_CONTRADICTION").length,
      0,
      "instrumento contratual negado na prova não deve gerar CONTRACT_EVIDENCE_CONTRADICTION",
    );
  });
});

describe("T29 — 5.9.1 Proteção testemunhal: testemunha que não confirmou não deve gerar alerta", () => {
  it("NÃO deve emitir WITNESS_OVERTIME_CONTRADICTION quando testemunha não confirmou jornada", () => {
    const draft = `
RELATÓRIO
O reclamante pleiteia horas extras. Foram ouvidas testemunhas em audiência de instrução.
O reclamado nega a realização de trabalho extraordinário e sustenta que os registros de ponto
são fidedignos. A instrução trabalhista foi regular com oitiva das testemunhas indicadas.
Os registros de ponto foram apresentados pelo reclamado e analisados durante a instrução.

FUNDAMENTAÇÃO
A prova testemunhal foi colhida regularmente. A testemunha não confirmou a jornada extraordinária
alegada pelo reclamante, informando que a empresa respeitava os horários contratuais. As
testemunhas não confirmaram a prática de labor extraordinário habitual no setor do reclamante.
A jornada extraordinária alegada não encontra respaldo na prova testemunhal colhida em audiência.
Os registros de ponto são compatíveis com os depoimentos das testemunhas ouvidas no processo.
A prova produzida não demonstra a realização habitual de trabalho além da jornada contratual.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido de horas extras por ausência de prova suficiente.
Honorários de 10% sobre o valor arbitrado. Recurso ordinário no prazo de 8 dias úteis.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(
      errors.filter((e) => e.rule === "WITNESS_OVERTIME_CONTRADICTION").length,
      0,
      "testemunha que não confirmou jornada não deve gerar WITNESS_OVERTIME_CONTRADICTION",
    );
  });
});

describe("T30 — 5.9.1 Proteção dependência: dependência não comprovada não deve gerar alerta", () => {
  it("NÃO deve emitir DEPENDENCY_EVIDENCE_CONTRADICTION quando dependência é negada na prova", () => {
    const draft = `
RELATÓRIO
A requerente pleiteia pensão por morte. O INSS indeferiu o benefício por falta de comprovação
da condição de dependente econômico em relação ao falecido instituidor do benefício pleiteado.
A requerente afirma ser dependente do falecido, mas a instrução revelou ser independente.
Os documentos juntados foram analisados regularmente no curso da instrução processual.

FUNDAMENTAÇÃO
A requerente alega ser dependente do falecido. Contudo, os documentos juntados demonstram
que ela possuía renda própria e independência financeira no período anterior ao falecimento.
A dependência econômica não comprovada pelos documentos inviabiliza o deferimento da pensão.
A requerente não era dependente do falecido, pois mantinha vida financeira autônoma conforme
documentos juntados nos autos. A dependência não foi demonstrada pelos elementos probatórios.
O segurado falecido não era o único provedor do sustento da requerente conforme comprovado.

DISPOSITIVO
Ante o exposto, indefiro a pensão por morte por ausência de dependência econômica comprovada.
Honorários de 10% sobre as prestações vencidas calculadas. Custas processuais pela autora.
Recurso inominado cabível no prazo legal do Juizado Especial Federal desta comarca judicial.
`;
    const errors = validateEvidenceConclusion(draft);
    assert.equal(
      errors.filter((e) => e.rule === "DEPENDENCY_EVIDENCE_CONTRADICTION").length,
      0,
      "dependência não comprovada na prova não deve gerar DEPENDENCY_EVIDENCE_CONTRADICTION",
    );
  });
});

describe("T31 — 5.9.1 Details auditável — 6 campos obrigatórios presentes", () => {
  it("deve incluir evidenceMatched, conclusionMatched, evidenceSectionFound, dispositiveSectionFound, fallbackWindowUsed, skipped", () => {
    const draft = `
RELATÓRIO
O segurado pleiteia aposentadoria por incapacidade. O INSS indeferiu o pedido.
Os documentos médicos foram juntados com a petição inicial para comprovar o quadro.
A instrução foi regular com juntada de documentos e realização de perícia judicial.

FUNDAMENTAÇÃO
O laudo pericial confirma a incapacidade laboral total e permanente do requerente segurado.
A perícia médica realizada pelo perito judicial atesta a impossibilidade de exercer atividade.
A incapacidade laboral total está comprovada pelo laudo e pelos documentos médicos juntados.
O perito concluiu pelo estado total de incapacidade permanente para qualquer atividade laboral.
Os documentos corroboram as conclusões do laudo pericial realizado nestes autos do processo.
A incapacidade permanente foi confirmada por exame pericial com todos os laudos médicos.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido de aposentadoria por incapacidade permanente.
Honorários advocatícios de 10% sobre o valor da causa. Custas processuais pelo autor.
Recurso inominado cabível no prazo legal do Juizado Especial Federal desta comarca judicial.
`;
    const errors = validateEvidenceConclusion(draft);
    const err = errors.find((e) => e.rule === "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION");
    assert.ok(err, "MEDICAL_EVIDENCE_INCAPACITY_CONTRADICTION esperado");
    const d = err!.details as {
      evidenceMatched: unknown;
      conclusionMatched: unknown;
      evidenceSectionFound: unknown;
      dispositiveSectionFound: unknown;
      fallbackWindowUsed: unknown;
      skipped: unknown;
    };
    assert.ok(Array.isArray(d.evidenceMatched),            "evidenceMatched deve ser array");
    assert.ok(Array.isArray(d.conclusionMatched),          "conclusionMatched deve ser array");
    assert.equal(typeof d.evidenceSectionFound,    "boolean", "evidenceSectionFound deve ser boolean");
    assert.equal(typeof d.dispositiveSectionFound, "boolean", "dispositiveSectionFound deve ser boolean");
    assert.equal(typeof d.fallbackWindowUsed,      "boolean", "fallbackWindowUsed deve ser boolean");
    assert.equal(d.skipped, false,                          "skipped deve ser false");
  });
});

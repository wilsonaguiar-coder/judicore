import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateLegalContradictions } from "../../src/validators/legal-contradiction.validator.js";

// Helper local — exige que o draft tenha conteúdo útil ≥ 800 chars
// (validador hardenizado descarta peças muito curtas para evitar ruído).
function pad(draft: string): string {
  // Apenas garante o mínimo de 800 chars úteis; o conteúdo real já vem completo.
  return draft;
}

// ── TESTES POSITIVOS — cada regra deve disparar ───────────────────────────────

describe("PRESCRIPTION_PROCEDENCE_CONTRADICTION — prescrição + procedência", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = pad(`
FUNDAMENTAÇÃO
A pretensão do autor está fulminada pela prescrição. O prazo de cinco anos previsto no art. 206 §3º
do Código Civil já transcorreu integralmente, de modo que o direito de ação encontra-se extinto
pela prescrição bienal aplicável às verbas decorrentes da relação subjacente. A decadência do
direito potestativo também se consumou antes da propositura da demanda, conforme contagem
detalhada da cadeia temporal demonstrada nos autos, pois entre o termo inicial e a distribuição
transcorreram mais de oito anos sem qualquer causa interruptiva válida ou suspensiva da fluência.
Verifica-se que a inércia do titular do direito ultrapassou todos os limites legais aplicáveis,
não havendo notificação extrajudicial, protesto judicial, citação válida nem reconhecimento da
dívida pelo devedor capazes de interromper o lapso prescricional. A perda da pretensão é, portanto,
manifesta e deve ser pronunciada de ofício pelo juízo, nos termos do art. 487 II do CPC/2015.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido formulado pelo autor. Condeno o réu ao pagamento dos
valores pleiteados, com correção monetária pelo IPCA-E desde o vencimento e juros de mora desde
a citação. Honorários advocatícios fixados em 10% do valor da condenação. Apelação cabível no
prazo de 15 dias úteis, com efeito suspensivo legal.
`);
    const errors = validateLegalContradictions(draft);
    assert.ok(errors.some((e) => e.rule === "PRESCRIPTION_PROCEDENCE_CONTRADICTION"),
      `Esperado PRESCRIPTION_PROCEDENCE_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`);
    const err = errors.find((e) => e.rule === "PRESCRIPTION_PROCEDENCE_CONTRADICTION")!;
    assert.equal(err.fatal, false);
    assert.ok(Array.isArray((err.details as { reasoningMatched: string[] }).reasoningMatched));
    assert.ok(Array.isArray((err.details as { dispositiveMatched: string[] }).dispositiveMatched));
  });
});

describe("STANDING_CONTRADICTION — ilegitimidade passiva + condenação", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = pad(`
FUNDAMENTAÇÃO
O réu é parte ilegítima para figurar no polo passivo desta demanda. Há clara ilegitimidade passiva
no caso concreto, pois o responsável pelo evento danoso é terceiro alheio à lide, sequer integrante
da cadeia de fornecimento descrita na inicial. A ausência de legitimidade do requerido é manifesta
e está reconhecida na doutrina processual contemporânea, em especial na teoria da asserção mitigada
adotada pelo STJ. Os documentos juntados pelo próprio autor demonstram que a relação jurídica
material discutida envolve pessoa diversa do réu, sendo descabida sua manutenção no processo.
Ademais, a ilegitimidade passiva é matéria de ordem pública, cognoscível em qualquer grau de
jurisdição (art. 485 §3º CPC/2015), exigindo a extinção do processo sem resolução do mérito.
Não há, no caso, hipótese de litisconsórcio passivo necessário nem de solidariedade legal que
pudesse justificar a permanência do requerido no polo passivo da relação processual.

DISPOSITIVO
Ante o exposto, condeno o réu ao pagamento de indenização no valor de R$ 10.000,00, acrescido
de correção monetária e juros legais. Defiro o pedido de danos morais. Honorários sucumbenciais
de 15%. Apelação cabível no prazo legal de 15 dias úteis.
`);
    const errors = validateLegalContradictions(draft);
    assert.ok(errors.some((e) => e.rule === "STANDING_CONTRADICTION"),
      `Esperado STANDING_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`);
    const err = errors.find((e) => e.rule === "STANDING_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

describe("LACK_OF_EVIDENCE_CONTRADICTION — ausência de prova + procedência", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = pad(`
FUNDAMENTAÇÃO
O autor não trouxe aos autos elementos probatórios suficientes para demonstrar os fatos
constitutivos do direito alegado. Há ausência de prova quanto ao nexo causal supostamente
existente entre a conduta atribuída ao réu e o resultado lesivo descrito na inicial. A
insuficiência probatória é patente, pois os documentos apresentados não comprovado o vínculo
fático nem o quantum debeatur. Sequer há prova oral consistente: as duas testemunhas ouvidas
afirmaram desconhecer os fatos centrais da controvérsia. O conjunto probatório não demonstrado
de forma satisfatória nenhum dos requisitos legais. O ônus da prova competia ao autor, nos
termos do art. 373 I do CPC/2015, e dele não se desincumbiu mesmo após instrução probatória
amplamente franqueada. A perícia técnica, por sua vez, foi inconclusiva quanto a todos os
pontos relevantes, não permitindo o acolhimento da pretensão deduzida na petição inicial.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido. Condeno o réu ao pagamento das verbas pleiteadas
na inicial, com correção monetária e juros legais desde o evento danoso. Honorários de 12%.
Recurso de apelação no prazo legal, com efeito suspensivo.
`);
    const errors = validateLegalContradictions(draft);
    assert.ok(errors.some((e) => e.rule === "LACK_OF_EVIDENCE_CONTRADICTION"),
      `Esperado LACK_OF_EVIDENCE_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`);
    const err = errors.find((e) => e.rule === "LACK_OF_EVIDENCE_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

describe("MORAL_DAMAGE_CONTRADICTION — mero aborrecimento + dano moral", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = pad(`
FUNDAMENTAÇÃO
O transtorno sofrido pelo autor não configura dano moral indenizável segundo os parâmetros
consolidados pela jurisprudência do STJ. Trata-se de mero aborrecimento decorrente das
vicissitudes do cotidiano contemporâneo, situação que, embora desagradável, não atinge a
esfera dos direitos da personalidade tutelados pelo art. 5º X da Constituição Federal. A
inexistência de dano moral é clara no caso concreto, pois não há abalo psíquico grave nem
ofensa à honra, à imagem, à integridade física ou à intimidade do consumidor. Sem dano moral
reconhecível na hipótese dos autos, mostra-se descabida qualquer compensação pecuniária.
A doutrina consumerista contemporânea repele a banalização do instituto, exigindo prova
objetiva de violação significativa aos atributos da personalidade. Inexistente o dano moral,
fica afastada também a pretensão indenizatória autônoma deduzida pelo consumidor.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido. Condeno o réu ao pagamento de indenização moral
no valor de R$ 5.000,00 a título de dano moral, com correção monetária pelo IPCA-E e juros
de mora desde a citação. Honorários sucumbenciais de 10%. Apelação cabível em 15 dias.
`);
    const errors = validateLegalContradictions(draft);
    assert.ok(errors.some((e) => e.rule === "MORAL_DAMAGE_CONTRADICTION"),
      `Esperado MORAL_DAMAGE_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`);
    const err = errors.find((e) => e.rule === "MORAL_DAMAGE_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

describe("EMPLOYMENT_RELATION_CONTRADICTION — ausência de subordinação + vínculo", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = pad(`
FUNDAMENTAÇÃO
Não restou comprovada a subordinação jurídica entre as partes ao longo do período controvertido.
A inexistência de vínculo empregatício é evidente nos autos: o reclamante prestava serviços
de forma autônoma, organizava sua própria agenda, definia métodos de execução e recebia por
demanda concluída. Não caracterizada relação de emprego, uma vez que o reclamante prestava
serviços a múltiplos tomadores, sem pessoalidade nem onerosidade fixa. Os requisitos do art. 3º
da CLT exigem subordinação, pessoalidade, onerosidade e não-eventualidade simultâneas, e tais
elementos não emergem do contexto probatório. Os depoimentos colhidos em audiência confirmam
a autonomia operacional do prestador. Os contratos juntados pelas próprias partes descrevem
relação típica de prestação de serviços civil, regida pelo Código Civil e não pela CLT. Inexiste
contrato de trabalho, ainda que tácito, capaz de fundamentar o reconhecimento do vínculo.

DISPOSITIVO
Ante o exposto, reconheço o vínculo empregatício entre as partes durante todo o período
controvertido. Condeno a reclamada ao pagamento de verbas trabalhistas em sentido amplo
(férias, 13º, FGTS, aviso prévio) e determino a anotação em CTPS. Recurso ordinário cabível.
`);
    const errors = validateLegalContradictions(draft);
    assert.ok(errors.some((e) => e.rule === "EMPLOYMENT_RELATION_CONTRADICTION"),
      `Esperado EMPLOYMENT_RELATION_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`);
    const err = errors.find((e) => e.rule === "EMPLOYMENT_RELATION_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

describe("SPECIAL_ACTIVITY_CONTRADICTION — ausência de agente nocivo + tempo especial", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = pad(`
FUNDAMENTAÇÃO
Não comprovada exposição habitual e permanente a agentes nocivos durante o período em discussão.
A ausência de agente nocivo é patente no laudo técnico apresentado pelo autor, que descreve
ambientes administrativos comuns, sem ruído acima dos limites de tolerância, sem agentes químicos
de risco e sem agentes biológicos relevantes. O PPP insuficiente não comprova as condições
especiais alegadas, pois foi emitido com base em descrições genéricas das atividades, sem
medições periódicas devidamente registradas. LTCAT insuficiente para configurar atividade não
especial no período discutido — o documento sequer abrange todo o intervalo pleiteado e apresenta
metodologia de aferição incompatível com a NR-15. Os formulários DSS-8030 estão desatualizados.
A jurisprudência consolidada da TNU exige prova robusta da efetiva exposição, ônus do qual o
segurado não se desincumbiu, mesmo após dilação probatória ampla concedida nestes autos.

DISPOSITIVO
Ante o exposto, reconheço o tempo especial do período laborado entre 2002 e 2018. Determino a
conversão de tempo especial pelo fator aplicável (1,40) e a averbação no CNIS. Condeno o INSS
a reconhecer a atividade especial. Recurso inominado cabível no prazo legal aplicável ao JEF.
`);
    const errors = validateLegalContradictions(draft);
    assert.ok(errors.some((e) => e.rule === "SPECIAL_ACTIVITY_CONTRADICTION"),
      `Esperado SPECIAL_ACTIVITY_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`);
    const err = errors.find((e) => e.rule === "SPECIAL_ACTIVITY_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

// ── TESTES NEGATIVOS — cenário correto, nenhum alerta deve disparar ───────────

describe("Negativo: prescrição + extinção (sem procedência)", () => {
  it("NÃO deve emitir PRESCRIPTION_PROCEDENCE_CONTRADICTION", () => {
    const draft = pad(`
FUNDAMENTAÇÃO
A pretensão do autor está fulminada pela prescrição. O prazo de cinco anos previsto no art. 206
do Código Civil já transcorreu integralmente, de modo que o direito de ação encontra-se extinto
pela prescrição. Não há causas interruptivas ou suspensivas reconhecíveis no caso concreto.
Verifica-se que entre o termo inicial da fluência prescricional e o ajuizamento desta ação
transcorreram mais de sete anos sem qualquer ato apto a interromper o prazo. A inércia do
titular é manifesta e impõe o reconhecimento da prescrição, nos termos do art. 487 II CPC.
O reconhecimento da prescrição é matéria de ordem pública e pode ser pronunciada de ofício
pelo juízo, ainda que a parte requerida não a tenha arguido em sua peça de defesa formal.

DISPOSITIVO
Ante o exposto, julgo extinto o processo sem resolução do mérito, reconhecendo a prescrição
quinquenal. Condeno o autor ao pagamento das custas e honorários sucumbenciais de 10%.
Apelação cabível no prazo de 15 dias úteis a partir da intimação.
`);
    const errors = validateLegalContradictions(draft);
    assert.equal(
      errors.filter((e) => e.rule === "PRESCRIPTION_PROCEDENCE_CONTRADICTION").length,
      0,
      `Não esperado PRESCRIPTION_PROCEDENCE_CONTRADICTION, obtido: ${JSON.stringify(errors)}`,
    );
  });
});

describe("Negativo: ilegitimidade + extinção sem resolução do mérito", () => {
  it("NÃO deve emitir STANDING_CONTRADICTION", () => {
    const draft = pad(`
FUNDAMENTAÇÃO
O réu é parte ilegítima para figurar no polo passivo desta demanda. Há clara ilegitimidade
passiva, pois o responsável pelo dano descrito na inicial é terceiro alheio à lide, sequer
mencionado entre os documentos juntados aos autos. A ausência de legitimidade do requerido é
manifesta e exige a extinção do processo sem resolução do mérito (art. 485 VI CPC/2015).
Os elementos materiais juntados pelo próprio autor evidenciam que a relação jurídica de
direito material discutida envolve pessoa distinta do réu, sendo descabida sua manutenção
no polo passivo. Não se vislumbra hipótese de litisconsórcio passivo necessário capaz de
manter o requerido no processo, nem solidariedade legal aplicável à hipótese sob análise.

DISPOSITIVO
Ante o exposto, julgo extinto o processo sem resolução do mérito por ilegitimidade passiva
(art. 485 VI CPC/2015). Custas pelo autor. Honorários advocatícios de 10% sobre o valor da
causa. Apelação cabível no prazo de 15 dias úteis.
`);
    const errors = validateLegalContradictions(draft);
    assert.equal(
      errors.filter((e) => e.rule === "STANDING_CONTRADICTION").length,
      0,
    );
  });
});

describe("Negativo: insuficiência probatória + improcedência", () => {
  it("NÃO deve emitir LACK_OF_EVIDENCE_CONTRADICTION", () => {
    const draft = pad(`
FUNDAMENTAÇÃO
O autor não trouxe elementos probatórios suficientes para demonstrar os fatos constitutivos
do direito alegado. Há ausência de prova quanto ao nexo causal entre a conduta atribuída ao
réu e o resultado descrito na inicial. A insuficiência probatória é patente e o ônus da prova
competia ao autor, na forma do art. 373 I do CPC/2015. Sequer há prova oral consistente: as
testemunhas arroladas não confirmaram os fatos centrais da controvérsia. A perícia técnica
foi inconclusiva quanto aos pontos relevantes e nenhum documento juntado é capaz de suprir
essa lacuna. Diante da imprestabilidade do conjunto probatório, impõe-se a improcedência
da pretensão deduzida na inicial, na forma da jurisprudência dominante sobre o tema.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido formulado na inicial. Condeno o autor ao
pagamento das custas processuais e honorários sucumbenciais de 10% sobre o valor da causa.
Apelação no prazo de 15 dias.
`);
    const errors = validateLegalContradictions(draft);
    assert.equal(
      errors.filter((e) => e.rule === "LACK_OF_EVIDENCE_CONTRADICTION").length,
      0,
    );
  });
});

describe("Negativo: mero aborrecimento + improcedência do dano moral", () => {
  it("NÃO deve emitir MORAL_DAMAGE_CONTRADICTION", () => {
    const draft = pad(`
FUNDAMENTAÇÃO
O transtorno sofrido pelo autor não configura dano moral indenizável segundo os parâmetros
consolidados pela jurisprudência do STJ. Trata-se de mero aborrecimento decorrente das
vicissitudes do cotidiano contemporâneo, situação que, embora desagradável, não atinge a
esfera dos direitos da personalidade tutelados pelo art. 5º X da Constituição Federal. A
inexistência de dano moral afasta integralmente a pretensão indenizatória. A doutrina
consumerista contemporânea repele a banalização do instituto, exigindo prova objetiva de
violação significativa aos atributos da personalidade. Como não há prova de abalo concreto,
nem de exposição vexatória, nem de violação ao patrimônio imaterial, a improcedência se impõe.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido de indenização. Custas pelo autor. Honorários
sucumbenciais arbitrados em 10% sobre o valor da causa, a serem pagos pelo autor vencido.
Apelação cabível no prazo legal de 15 dias úteis.
`);
    const errors = validateLegalContradictions(draft);
    assert.equal(
      errors.filter((e) => e.rule === "MORAL_DAMAGE_CONTRADICTION").length,
      0,
    );
  });
});

describe("Negativo: relação de emprego comprovada + reconhecimento de vínculo", () => {
  it("NÃO deve emitir EMPLOYMENT_RELATION_CONTRADICTION", () => {
    const draft = pad(`
FUNDAMENTAÇÃO
Restou comprovada a subordinação jurídica entre as partes durante todo o período em discussão.
A relação de emprego foi demonstrada pelos documentos e depoimentos colhidos em instrução,
estando presentes os requisitos da pessoalidade, habitualidade, onerosidade e subordinação
exigidos pelos arts. 2º e 3º da CLT. As testemunhas ouvidas confirmaram a rotina diária do
reclamante, com horário fixo, ordens emanadas da reclamada e participação efetiva na estrutura
organizacional. Os documentos demonstram pagamentos regulares e uniforme da empresa. Diante
desse contexto, mostra-se imperioso o reconhecimento do vínculo empregatício pleiteado, com
todos os consectários legais decorrentes da relação de trabalho subordinado.

DISPOSITIVO
Ante o exposto, reconheço o vínculo empregatício entre as partes. Condeno a reclamada ao
pagamento de verbas trabalhistas (férias, 13º, FGTS, aviso prévio) e determino a anotação
em CTPS. Honorários de sucumbência de 10%. Recurso ordinário cabível no prazo legal.
`);
    const errors = validateLegalContradictions(draft);
    assert.equal(
      errors.filter((e) => e.rule === "EMPLOYMENT_RELATION_CONTRADICTION").length,
      0,
    );
  });
});

describe("Negativo: atividade especial comprovada + reconhecimento de tempo especial", () => {
  it("NÃO deve emitir SPECIAL_ACTIVITY_CONTRADICTION", () => {
    const draft = pad(`
FUNDAMENTAÇÃO
O PPP e o LTCAT demonstram a exposição habitual e permanente a agentes nocivos — ruído acima
de 85dB — no período discutido nestes autos. A atividade especial restou devidamente comprovada
pelos documentos técnicos apresentados. As medições periódicas foram realizadas conforme a NR-15
e abrangem todo o período controvertido. Os formulários DSS-8030 estão atualizados e refletem
fielmente as condições reais do ambiente de trabalho do segurado. A jurisprudência consolidada
da TNU admite a conversão em tais hipóteses. Não há, portanto, qualquer óbice ao reconhecimento
do tempo especial, devendo o INSS proceder à averbação no CNIS, com os reflexos sobre a renda
mensal inicial do benefício previdenciário pleiteado nestes autos.

DISPOSITIVO
Ante o exposto, reconheço o tempo especial do período laborado. Condeno o INSS a averbar a
atividade especial no CNIS e a conceder a aposentadoria especial. Recurso inominado cabível
no prazo legal aplicável ao rito do JEF.
`);
    const errors = validateLegalContradictions(draft);
    assert.equal(
      errors.filter((e) => e.rule === "SPECIAL_ACTIVITY_CONTRADICTION").length,
      0,
    );
  });
});

// ── Deduplicação — mesmo erro não deve aparecer duas vezes ────────────────────

describe("Deduplicação — code duplicado não emite duas vezes", () => {
  it("cada regra dispara no máximo uma vez por texto", () => {
    // Texto que repete os mesmos padrões de prescrição em ambas as seções
    const draft = pad(`
FUNDAMENTAÇÃO
A prescrição está configurada. A prescrição é manifesta. A decadência também é reconhecida.
A prescrição quinquenal incidiu. A prescrição bienal também. A perda da pretensão é cabal.
A extinção do direito impõe a improcedência da pretensão. Há prescrição em todos os pedidos
formulados na inicial. Não há causa interruptiva ou suspensiva que afaste a prescrição. Os
prazos previstos no art. 206 do CC já se esgotaram em sua integralidade no caso destes autos.

DISPOSITIVO
Ante o exposto, julgo procedente. Concedo o pedido. Defiro integralmente. Julgo procedente os
demais pleitos formulados. Condeno o réu ao pagamento. Procedência integral da pretensão.
Honorários de 15% sobre o valor da condenação. Apelação no prazo legal.
`);
    const errors = validateLegalContradictions(draft);
    const codes = errors.map((e) => e.rule);
    const unique = new Set(codes);
    assert.equal(codes.length, unique.size, `Duplicatas detectadas: ${JSON.stringify(codes)}`);
  });
});

// ── details: reasoningMatched e dispositiveMatched preenchidos ────────────────

describe("Details auditáveis — reasoningMatched e dispositiveMatched presentes", () => {
  it("deve incluir details com as expressões capturadas", () => {
    const draft = pad(`
FUNDAMENTAÇÃO
A prescrição quinquenal está configurada nos autos. Já transcorreram mais de cinco anos do
termo inicial sem qualquer causa interruptiva válida ou suspensiva da fluência do prazo
extintivo. A perda da pretensão é manifesta no caso concreto. O reconhecimento da prescrição
é matéria de ordem pública e impõe-se de ofício pelo juízo, nos termos do art. 487 II CPC/2015.
A decadência do direito potestativo também se consumou antes da propositura desta ação.
Não há controvérsia fática relevante: o próprio autor admite o decurso de prazo superior ao
quinquênio legal aplicável à hipótese. Os documentos juntados aos autos confirmam a inércia
do titular do direito ao longo de todo o período controvertido, sem qualquer ato interruptivo.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido formulado pelo autor. Condeno o réu ao pagamento
dos valores pleiteados, com correção monetária e juros desde o vencimento das obrigações.
Honorários sucumbenciais de 10%. Apelação cabível no prazo de 15 dias úteis a contar da
intimação da presente sentença, com efeito suspensivo legal.
`);
    const errors = validateLegalContradictions(draft);
    const err = errors.find((e) => e.rule === "PRESCRIPTION_PROCEDENCE_CONTRADICTION");
    assert.ok(err, "PRESCRIPTION_PROCEDENCE_CONTRADICTION não emitido");
    const d = err!.details as { reasoningMatched: string[]; dispositiveMatched: string[] };
    assert.ok(d.reasoningMatched.length > 0, "reasoningMatched vazio");
    assert.ok(d.dispositiveMatched.length > 0, "dispositiveMatched vazio");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FASE 5.7.1 — HARDENING (T15 a T21)
// ════════════════════════════════════════════════════════════════════════════

// T15 — Normalização sem acentos
describe("T15 — Texto sem acentos: prescricao + procedencia", () => {
  it("deve emitir PRESCRIPTION_PROCEDENCE_CONTRADICTION mesmo sem diacriticos", () => {
    const draft = `
FUNDAMENTACAO
A pretensao do autor esta fulminada pela prescricao. O prazo de cinco anos previsto no art. 206
do Codigo Civil ja transcorreu integralmente, de modo que o direito de acao encontra-se extinto
pela prescricao bienal aplicavel ao caso. A decadencia do direito potestativo tambem se consumou
antes da propositura desta demanda, conforme contagem precisa da cadeia temporal dos eventos.
Verifica-se que a inercia do titular ultrapassou todos os limites legais aplicaveis e nao houve
notificacao extrajudicial, protesto judicial, citacao valida ou reconhecimento da divida pelo
devedor que pudesse interromper o lapso prescricional. A perda da pretensao e manifesta e
impoe-se a pronuncia da prescricao de oficio pelo juizo (art. 487 II CPC). Reconheco a prescricao.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido formulado pelo autor. Condeno o reu ao pagamento dos
valores pleiteados, com correcao monetaria e juros legais desde o vencimento das obrigacoes.
Honorarios advocaticios de 10%. Apelacao cabivel no prazo de 15 dias uteis.
`;
    const errors = validateLegalContradictions(draft);
    assert.ok(
      errors.some((e) => e.rule === "PRESCRIPTION_PROCEDENCE_CONTRADICTION"),
      `Esperado PRESCRIPTION_PROCEDENCE_CONTRADICTION (texto sem acentos), obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
  });
});

// T16 — Texto muito curto: deve ser ignorado
describe("T16 — Texto curto (<800 chars): nenhum alerta", () => {
  it("não deve emitir alertas para drafts curtos", () => {
    const draft = `
FUNDAMENTAÇÃO
A prescrição está configurada. Direito extinto.

DISPOSITIVO
Julgo procedente. Condeno o réu.
`;
    const errors = validateLegalContradictions(draft);
    assert.equal(errors.length, 0, `Esperado nenhum alerta, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`);
  });
});

// T17 — Template incompleto: deve ser ignorado
describe("T17 — Template incompleto: nenhum alerta", () => {
  it("não deve emitir alertas em texto com markers de template", () => {
    const draft = `
FUNDAMENTAÇÃO
A pretensão do autor [PREENCHER] está fulminada pela prescrição. O prazo previsto no art. 206
do Código Civil já transcorreu integralmente. A decadência do direito também se consumou. As
provas dos autos são insuficientes. Não restou demonstrada a relação alegada. Mero aborrecimento.
Ausência de subordinação. Os requisitos não foram atendidos. Diversos fundamentos da peça apontam
a inviabilidade da pretensão deduzida. Tudo deve ser revisto e adequado conforme o caso concreto.
A peça segue padrão {{tipo_peca}} com campos a preencher como [NOME COMPLETO], [DATA NASCIMENTO]
e [CPF SEGURADO]. O dispositivo apresenta valores XXX a ajustar conforme o caso concreto.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido. Condeno o réu ao pagamento. Defiro a tutela. Concedo
o benefício. Reconheço o vínculo. Honorários de XXX %. Apelação no prazo legal.
`;
    const errors = validateLegalContradictions(draft);
    assert.equal(errors.length, 0, `Esperado nenhum alerta (template), obtido: ${JSON.stringify(errors.map((e) => e.rule))}`);
  });
});

// T18 — Jurisprudência isolada: deve ser ignorada
describe("T18 — Jurisprudência isolada: nenhum alerta", () => {
  it("não deve emitir alertas em texto que parece só ementa colada", () => {
    const draft = `
EMENTA. PRESCRIÇÃO. PROCEDÊNCIA. RECURSO ESPECIAL. STJ. STF. TRF. TST. Relator: Min. Fulano.
Turma: Terceira. Julgado em 10/05/2023. DJe 15/05/2023. Precedente firmado em sede de recurso
repetitivo. Acórdão da Terceira Turma do Superior Tribunal de Justiça. Ementa: prescrição
quinquenal aplicável às pretensões contra a Fazenda Pública, nos termos do Decreto 20.910/32.
Procedência do pedido reconhecida pela instância de origem. Acórdão mantido. Julgado em sessão
ordinária da Turma. Relator: Ministro de Souza. Acórdão unânime. Recurso especial provido em
parte. Precedente firmado. STJ, REsp 1234567, Rel. Min. Fulano, Terceira Turma, DJe 20/05/2023.
Idêntica posição se vê no STF, RE 7654321, Rel. Min. Beltrano, Plenário, DJe 30/06/2023.
Tribunal Regional Federal: TRF1, AC 9999999, Rel. Des. Sicrano, julgado em 12/07/2023.
`;
    const errors = validateLegalContradictions(draft);
    assert.equal(errors.length, 0, `Esperado nenhum alerta (jurisprudência isolada), obtido: ${JSON.stringify(errors.map((e) => e.rule))}`);
  });
});

// T19 — Deduplicação: mesmo erro repetido N vezes → 1 alerta
describe("T19 — Deduplicação: PRESCRIPTION_PROCEDENCE_CONTRADICTION repetido", () => {
  it("emite o alerta uma única vez mesmo com N matches", () => {
    const draft = `
FUNDAMENTAÇÃO
A prescrição está configurada. A prescrição é manifesta. A prescrição quinquenal incidiu sobre
todos os pedidos. A prescrição bienal afeta as verbas remuneratórias. A prescrição vintenária
não tem aplicação no caso. A decadência também é reconhecida em todas as pretensões deduzidas.
A perda da pretensão é cabal. A extinção do direito impõe a improcedência integral da demanda.
Não há causa interruptiva ou suspensiva que afaste a prescrição. Os prazos previstos no Código
Civil já se esgotaram em sua integralidade no caso destes autos, conforme detalhada cronologia.

DISPOSITIVO
Ante o exposto, julgo procedente. Julgo procedente os demais pleitos. Concedo o pedido. Defiro
integralmente. Condeno o réu ao pagamento. Procedência integral da pretensão. Honorários de
15% sobre o valor da condenação. Apelação cabível no prazo legal de 15 dias úteis.
`;
    const errors = validateLegalContradictions(draft);
    const presc = errors.filter((e) => e.rule === "PRESCRIPTION_PROCEDENCE_CONTRADICTION");
    assert.equal(presc.length, 1, `Esperado exatamente 1 alerta PRESCRIPTION_PROCEDENCE_CONTRADICTION, obtido: ${presc.length}`);
  });
});

// T20 — Fallback de split (sem cabeçalhos "Fundamentação" / "Dispositivo")
describe("T20 — Fallback de split via janela 80/20", () => {
  it("deve detectar contradição mesmo sem Fundamentação/Dispositivo literais", () => {
    // Sem "FUNDAMENTAÇÃO", sem "DISPOSITIVO", sem "ante o exposto", etc.
    // Prescrição aparece nos primeiros 80%. "Julgo procedente" aparece nos últimos 20%.
    const draft = `
A pretensão do autor encontra-se fulminada pela prescrição quinquenal. O prazo previsto no art. 206
do Código Civil já transcorreu integralmente sobre toda a cadeia obrigacional descrita na inicial.
A decadência do direito potestativo também se consumou antes da propositura desta demanda. Não há,
nos autos, qualquer notificação extrajudicial ou ato com força interruptiva do prazo prescricional
que pudesse beneficiar o titular do direito. Verifica-se inércia continuada do autor por mais de
sete anos entre o termo inicial e o ajuizamento da ação, situação incompatível com a manutenção
da pretensão. A perda da pretensão é manifesta. Os documentos juntados aos autos não comprovam
qualquer ato interruptivo válido. O reconhecimento da prescrição é matéria de ordem pública e
pode ser pronunciado de ofício pelo juízo (art. 487 II CPC/2015). Considerando o conjunto de
elementos, impõe-se o reconhecimento da prescrição como medida de coerência sistêmica do direito.
Em conclusão da análise, julgo procedente o pedido formulado pelo autor.
Condeno o réu ao pagamento. Honorários de 10%. Recurso cabível.
`;
    const errors = validateLegalContradictions(draft);
    const err = errors.find((e) => e.rule === "PRESCRIPTION_PROCEDENCE_CONTRADICTION");
    assert.ok(err, `Esperado PRESCRIPTION_PROCEDENCE_CONTRADICTION via fallback, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`);
    const d = err!.details as { fallbackWindowUsed: boolean };
    assert.equal(d.fallbackWindowUsed, true, "fallbackWindowUsed deveria ser true");
  });
});

// T21 — Details com todos os campos auditáveis
describe("T21 — Details auditável com 6 campos", () => {
  it("inclui reasoningMatched, dispositiveMatched, *SectionFound, fallbackWindowUsed, skipped", () => {
    const draft = `
FUNDAMENTAÇÃO
A pretensão está fulminada pela prescrição quinquenal. O prazo do art. 206 do Código Civil
transcorreu integralmente. A decadência do direito potestativo também se consumou. Não há causa
interruptiva ou suspensiva válida. Inércia do titular por mais de sete anos sem ato apto a
sustar o curso do prazo. O reconhecimento da prescrição se impõe de ofício pelo juízo, na forma
do art. 487 II CPC. Os elementos dos autos confirmam o decurso de prazo superior ao legal e
o autor sequer impugnou esse aspecto em sua manifestação aos embargos opostos pela parte ré.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido. Condeno o réu ao pagamento dos valores pleiteados.
Honorários sucumbenciais de 10% sobre o valor da condenação. Apelação cabível no prazo legal
de 15 dias úteis a contar da intimação desta sentença, com efeito suspensivo legal.
`;
    const errors = validateLegalContradictions(draft);
    const err = errors.find((e) => e.rule === "PRESCRIPTION_PROCEDENCE_CONTRADICTION");
    assert.ok(err, "alerta esperado não emitido");
    const d = err!.details as {
      reasoningMatched: unknown;
      dispositiveMatched: unknown;
      reasoningSectionFound: unknown;
      dispositiveSectionFound: unknown;
      fallbackWindowUsed: unknown;
      skipped: unknown;
    };
    assert.ok(Array.isArray(d.reasoningMatched),   "reasoningMatched ausente ou não-array");
    assert.ok(Array.isArray(d.dispositiveMatched), "dispositiveMatched ausente ou não-array");
    assert.equal(typeof d.reasoningSectionFound,   "boolean", "reasoningSectionFound ausente");
    assert.equal(typeof d.dispositiveSectionFound, "boolean", "dispositiveSectionFound ausente");
    assert.equal(typeof d.fallbackWindowUsed,      "boolean", "fallbackWindowUsed ausente");
    assert.equal(d.skipped, false, "skipped deveria ser false em alerta emitido");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FASE 5.7.2 — SEGUNDA ONDA DE CONTRADIÇÕES (T22 a T33)
// ════════════════════════════════════════════════════════════════════════════

// T22 — RES_JUDICATA_MERITS_CONTRADICTION (positivo)
describe("T22 — RES_JUDICATA_MERITS_CONTRADICTION — coisa julgada + procedência", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
FUNDAMENTAÇÃO
A ação não pode ser apreciada no mérito porque a questão controvertida já foi definitivamente
decidida por sentença transitada em julgado proferida nos autos do processo nº 1234567-89.
Há coisa julgada material sobre a mesma causa de pedir e o mesmo pedido ora renovado.
A coisa julgada é instituto de ordem pública, imutabilidade que protege o Estado Democrático
de Direito e garante a segurança jurídica nas relações processuais. O art. 502 do CPC/2015
define que a coisa julgada faz imutável e indiscutível a decisão de mérito não mais sujeita
a recurso. A tríplice identidade — partes, pedido e causa de pedir — está plenamente configurada
entre o processo anterior e a presente demanda. A litispendência também é reconhecível no caso,
pois outra ação idêntica segue em curso neste mesmo juízo, conforme certidão juntada aos autos.
A perempção igualmente incide, sendo esta a terceira demanda movida pelo mesmo autor sobre o
mesmo objeto jurídico. Todos esses obstáculos processuais são insuperáveis e obstam o julgamento
do mérito desta demanda, devendo o processo ser extinto sem apreciação do pedido formulado.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido formulado pelo autor. Condeno o réu ao pagamento dos
valores pleiteados, com correção monetária e juros legais. Honorários advocatícios de 10% do
valor da condenação. Apelação cabível no prazo de 15 dias úteis a partir da intimação.
`;
    const errors = validateLegalContradictions(draft);
    assert.ok(
      errors.some((e) => e.rule === "RES_JUDICATA_MERITS_CONTRADICTION"),
      `Esperado RES_JUDICATA_MERITS_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "RES_JUDICATA_MERITS_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

// T23 — LACK_OF_INTEREST_PROCEDENCE_CONTRADICTION (positivo)
describe("T23 — LACK_OF_INTEREST_PROCEDENCE_CONTRADICTION — falta de interesse + procedência", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
FUNDAMENTAÇÃO
O autor não possui interesse de agir na presente demanda, pois não há necessidade nem utilidade
no provimento jurisdicional pleiteado. Há ausência de interesse de agir porque o réu nunca
se opôs ao cumprimento espontâneo da pretensão, tornando desnecessária a via judicial.
A falta de interesse processual é patente: antes de ajuizar a demanda, o autor não esgotou
as vias administrativas disponíveis, conforme exige o princípio da subsidiariedade. A carência
de ação é manifesta no caso concreto, pois o pedido formulado é juridicamente impossível no
estado atual de fato e de direito dos autos. O interesse de agir ausente decorre da inexistência
de resistência do réu à pretensão. Segundo Fredie Didier Jr., o interesse processual exige
o binômio necessidade e utilidade, ambos ausentes no presente caso. A extinção do processo sem
resolução do mérito é a medida processualmente adequada, legalmente imposta pelo CPC/2015.
Não há utilidade alguma no prosseguimento desta demanda, diante da resolução extrajudicial.

DISPOSITIVO
Ante o exposto, julgo procedente o pedido. Condeno o réu ao cumprimento da obrigação pleiteada.
Defiro integralmente o pedido formulado na inicial. Honorários sucumbenciais de 10% sobre o
valor da causa. Apelação cabível no prazo legal de 15 dias úteis a partir da intimação.
`;
    const errors = validateLegalContradictions(draft);
    assert.ok(
      errors.some((e) => e.rule === "LACK_OF_INTEREST_PROCEDENCE_CONTRADICTION"),
      `Esperado LACK_OF_INTEREST_PROCEDENCE_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "LACK_OF_INTEREST_PROCEDENCE_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

// T24 — NO_DAMAGE_COMPENSATION_CONTRADICTION (positivo)
describe("T24 — NO_DAMAGE_COMPENSATION_CONTRADICTION — ausência de dano material + indenização", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
FUNDAMENTAÇÃO
O autor não demonstrou a existência de dano patrimonial decorrente do evento narrado na inicial.
A ausência de dano patrimonial é clara: nenhum documento comprova perda financeira concreta.
O dano material não configurado nos autos impede o acolhimento da pretensão indenizatória.
A inexistência de dano econômico é patente, pois as despesas alegadas não foram comprovadas
por recibos, notas fiscais ou qualquer outro meio de prova documental idôneo. Sem prejuízo
concreto demonstrado, não há base jurídica para a condenação indenizatória postulada. O
prejuízo não comprovado nos autos afasta a responsabilidade civil do réu na hipótese.
Segundo a doutrina majoritária de responsabilidade civil, o dano é pressuposto inafastável
da obrigação de indenizar (art. 186 CC). O ônus de provar o dano competia ao autor (art. 373
I CPC), do qual não se desincumbiu satisfatoriamente mesmo após ampla instrução probatória
concedida nestes autos e após todas as diligências regularmente realizadas na fase instrutória.

DISPOSITIVO
Ante o exposto, condeno o réu ao pagamento de indenização no valor de R$ 15.000,00. Fixo
indenização material pelos danos apurados nos autos. Honorários advocatícios de 12% sobre o
valor da condenação. Apelação cabível no prazo legal de 15 dias.
`;
    const errors = validateLegalContradictions(draft);
    assert.ok(
      errors.some((e) => e.rule === "NO_DAMAGE_COMPENSATION_CONTRADICTION"),
      `Esperado NO_DAMAGE_COMPENSATION_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "NO_DAMAGE_COMPENSATION_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

// T25 — NO_INCAPACITY_BENEFIT_CONTRADICTION (positivo)
describe("T25 — NO_INCAPACITY_BENEFIT_CONTRADICTION — ausência de incapacidade + auxílio-doença", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
FUNDAMENTAÇÃO
O laudo pericial conclusivo demonstra que o autor mantém capacidade laboral plena para o
exercício de suas atividades habituais. Há ausência de incapacidade que justifique a concessão
do benefício pleiteado. A incapacidade não comprovada é o fundamento central do indeferimento:
o perito judicial, após exame clínico detalhado, concluiu que o autor não apresenta limitações
funcionais relevantes para o trabalho. Não há incapacidade para o trabalho nos termos exigidos
pela Lei 8.213/91. A capacidade laboral preservada é atestada pelos exames clínicos realizados.
A perícia judicial, realizada por médico de confiança do juízo, é conclusiva: sem incapacidade
para o trabalho, total ou parcial, não há fundamento legal para o deferimento do benefício.
O segurado consegue exercer sua profissão habitual e funções equivalentes sem limitações
relevantes, o que afasta o direito ao benefício por incapacidade. Nenhuma incapacidade foi
demonstrada nos autos por qualquer meio de prova admitido em direito neste processo judicial.

DISPOSITIVO
Ante o exposto, concedo o auxílio-doença ao autor. Determino ao INSS a implantação do benefício
por incapacidade. Reconheço o direito ao benefício por incapacidade temporária. Honorários
advocatícios de 10%. Recurso inominado cabível no prazo legal aplicável ao rito do JEF.
`;
    const errors = validateLegalContradictions(draft);
    assert.ok(
      errors.some((e) => e.rule === "NO_INCAPACITY_BENEFIT_CONTRADICTION"),
      `Esperado NO_INCAPACITY_BENEFIT_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "NO_INCAPACITY_BENEFIT_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

// T26 — NO_QUALITY_INSURED_BENEFIT_CONTRADICTION (positivo)
describe("T26 — NO_QUALITY_INSURED_BENEFIT_CONTRADICTION — ausência de qualidade + concessão de benefício", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
FUNDAMENTAÇÃO
O autor não ostenta qualidade de segurado na data de início da incapacidade (DII), conforme
demonstrado pelo histórico de vínculos previdenciários extraído do CNIS. A ausência de qualidade
de segurado impede a concessão do benefício previdenciário, independentemente dos demais
requisitos. O período de graça expirou antes da ocorrência da incapacidade: o último recolhimento
foi efetuado há mais de vinte e quatro meses, ultrapassando o período máximo de manutenção da
qualidade de segurado previsto no art. 15 da Lei 8.213/91. Não mantém a qualidade de segurado
quem deixa de contribuir por período superior ao previsto na legislação previdenciária. A
carência não cumprida é obstáculo autônomo: mesmo que a qualidade estivesse presente, o autor
não completou o número mínimo de contribuições mensais exigidas para o benefício postulado.
A qualidade de segurado não comprovada é suficiente para o indeferimento do pedido, pois sem
ela nenhum benefício previdenciário pode ser deferido ao segurado nessas condições específicas.

DISPOSITIVO
Ante o exposto, concedo o benefício previdenciário ao autor. Defiro o benefício de aposentadoria
por invalidez. Determino a implantação do benefício pela autarquia. Honorários de 10% sobre o
valor das prestações vencidas. Recurso inominado no prazo do JEF.
`;
    const errors = validateLegalContradictions(draft);
    assert.ok(
      errors.some((e) => e.rule === "NO_QUALITY_INSURED_BENEFIT_CONTRADICTION"),
      `Esperado NO_QUALITY_INSURED_BENEFIT_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "NO_QUALITY_INSURED_BENEFIT_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

// T27 — ADMIN_NULLITY_MAINTAINED_ACT_CONTRADICTION (positivo)
describe("T27 — ADMIN_NULLITY_MAINTAINED_ACT_CONTRADICTION — nulidade de ato + manutenção", () => {
  it("deve emitir alerta não fatal", () => {
    const draft = `
FUNDAMENTAÇÃO
O ato administrativo objeto desta impetração é nulo de pleno direito. A nulidade do ato
administrativo decorre de vício formal insanável: ausência de motivação do ato praticado pelo
agente público, ferindo os princípios constitucionais da publicidade e da transparência.
O ato administrativo nulo não produz efeitos válidos e deve ser desconstituído pelo Judiciário.
Há vício de legalidade manifesto, pois o agente ultrapassou os limites de sua competência ao
editar o ato. A incompetência da autoridade que assinou o ato é evidente à luz dos atos
normativos internos que organizam a estrutura administrativa do órgão público. A violação à
legalidade é patente: o ato contraria expressamente o art. 2º da Lei 9.784/99, que exige
competência, finalidade e motivação. Segundo Hely Lopes Meirelles, ato nulo é aquele que nasce
sem condições de validade por ser praticado com infringência às normas de ordem pública.
A ausência de motivação do ato, por si só, acarreta sua nulidade insanável, que não pode ser
convalidada por nenhuma circunstância processual ou fática posterior ao momento de sua prática.

DISPOSITIVO
Ante o exposto, indefiro o pedido de anulação do ato administrativo. O ato é mantido em toda
a sua extensão. Mantem-se o ato impugnado pelos fundamentos expostos. Honorários advocatícios
de 10% sobre o valor da causa. Recurso de apelação cabível no prazo de 15 dias úteis.
`;
    const errors = validateLegalContradictions(draft);
    assert.ok(
      errors.some((e) => e.rule === "ADMIN_NULLITY_MAINTAINED_ACT_CONTRADICTION"),
      `Esperado ADMIN_NULLITY_MAINTAINED_ACT_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
    const err = errors.find((e) => e.rule === "ADMIN_NULLITY_MAINTAINED_ACT_CONTRADICTION")!;
    assert.equal(err.fatal, false);
  });
});

// ── Negativos FASE 5.7.2 ──────────────────────────────────────────────────────

// T28 — coisa julgada + extinção (sem procedência) — NEGATIVO
describe("T28 — Negativo: coisa julgada + extinção sem mérito", () => {
  it("NÃO deve emitir RES_JUDICATA_MERITS_CONTRADICTION", () => {
    const draft = `
FUNDAMENTAÇÃO
A ação não pode ser apreciada no mérito porque a questão controvertida já foi definitivamente
decidida por sentença transitada em julgado proferida nos autos do processo nº 1234567-89.
Há coisa julgada material sobre a mesma causa de pedir e o mesmo pedido ora renovado.
A coisa julgada é instituto de ordem pública que confere imutabilidade à decisão de mérito não
mais sujeita a recurso. O art. 502 do CPC/2015 define coisa julgada como autoridade que torna
imutável e indiscutível a decisão. A tríplice identidade — partes, pedido e causa de pedir —
está plenamente configurada entre o processo anterior e a presente demanda. A litispendência
foi identificada desde o recebimento da petição inicial, devendo ter sido apontada logo no exame
de admissibilidade. A perempção também incide no caso em tela, obstando novo julgamento.
Todos esses obstáculos processuais impedem o exame do mérito da pretensão deduzida na inicial.
Não cabe ao Poder Judiciário rever decisão já acobertada pela coisa julgada.

DISPOSITIVO
Ante o exposto, julgo extinto o processo sem resolução do mérito por força da coisa julgada
(art. 485 V CPC/2015). Custas pelo autor. Honorários advocatícios de 10% sobre o valor da
causa. Apelação cabível no prazo de 15 dias úteis.
`;
    const errors = validateLegalContradictions(draft);
    assert.equal(
      errors.filter((e) => e.rule === "RES_JUDICATA_MERITS_CONTRADICTION").length,
      0,
      `Não esperado RES_JUDICATA_MERITS_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
  });
});

// T29 — falta de interesse + extinção sem mérito — NEGATIVO
describe("T29 — Negativo: falta de interesse + extinção sem mérito", () => {
  it("NÃO deve emitir LACK_OF_INTEREST_PROCEDENCE_CONTRADICTION", () => {
    const draft = `
FUNDAMENTAÇÃO
O autor não possui interesse de agir na presente demanda, pois não há necessidade nem utilidade
no provimento jurisdicional pleiteado. Há ausência de interesse de agir porque o réu já cumpriu
espontaneamente a pretensão antes mesmo do ajuizamento da ação judicial. A falta de interesse
processual é manifesta: a questão foi resolvida extrajudicialmente, tornando inútil e
desnecessária a tutela jurisdicional. O interesse de agir ausente decorre da satisfação voluntária
do réu. A carência de ação torna inviável o prosseguimento desta demanda, conforme jurisprudência
do STJ que exige a manutenção do interesse ao longo de toda a relação processual. A extinção sem
resolução do mérito é a medida legalmente imposta quando constatada a ausência superveniente do
interesse processual. Segundo o art. 485 VI do CPC/2015, o juiz extinguirá o processo sem
resolução de mérito quando verificar ausência de interesse processual. A extinção respeita o
princípio da efetividade jurisdicional e a economicidade dos recursos do Poder Judiciário.

DISPOSITIVO
Ante o exposto, julgo extinto o processo sem resolução do mérito por ausência de interesse de
agir (art. 485 VI CPC/2015). Custas a cargo do autor. Honorários advocatícios de 10% sobre
o valor da causa. Apelação cabível no prazo de 15 dias úteis.
`;
    const errors = validateLegalContradictions(draft);
    assert.equal(
      errors.filter((e) => e.rule === "LACK_OF_INTEREST_PROCEDENCE_CONTRADICTION").length,
      0,
    );
  });
});

// T30 — ausência de dano material + improcedência — NEGATIVO
describe("T30 — Negativo: ausência de dano material + improcedência", () => {
  it("NÃO deve emitir NO_DAMAGE_COMPENSATION_CONTRADICTION", () => {
    const draft = `
FUNDAMENTAÇÃO
O autor não demonstrou a existência de dano patrimonial decorrente do evento narrado na inicial.
A ausência de dano patrimonial é clara: nenhum documento comprova perda financeira concreta.
O dano material não configurado nos autos afasta qualquer pretensão indenizatória. A inexistência
de dano econômico é patente, pois as despesas alegadas não foram comprovadas por recibos, notas
fiscais ou qualquer meio de prova documental idôneo. Sem prejuízo concreto demonstrado, não há
base jurídica para a condenação indenizatória postulada. O prejuízo não comprovado nos autos
afasta a responsabilidade civil do réu. Segundo a teoria clássica da responsabilidade civil, o
dano é pressuposto inafastável da obrigação de indenizar (art. 186 CC). O ônus de provar o dano
competia ao autor (art. 373 I CPC), do qual não se desincumbiu satisfatoriamente durante a
instrução probatória amplamente franqueada nestes autos. Nenhuma prova de dano efetivo foi
produzida, o que torna imperativa a improcedência da pretensão indenizatória deduzida.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido. Custas pelo autor. Honorários sucumbenciais
de 10% sobre o valor da causa. Apelação cabível no prazo de 15 dias úteis.
`;
    const errors = validateLegalContradictions(draft);
    assert.equal(
      errors.filter((e) => e.rule === "NO_DAMAGE_COMPENSATION_CONTRADICTION").length,
      0,
    );
  });
});

// T31 — ausência de incapacidade + improcedência — NEGATIVO
describe("T31 — Negativo: ausência de incapacidade + improcedência do benefício", () => {
  it("NÃO deve emitir NO_INCAPACITY_BENEFIT_CONTRADICTION", () => {
    const draft = `
FUNDAMENTAÇÃO
O laudo pericial conclusivo demonstra que o autor mantém capacidade laboral plena para o
exercício de suas atividades habituais. Há ausência de incapacidade que justifique a concessão
do benefício pleiteado. A incapacidade não comprovada é o fundamento central do indeferimento:
o perito judicial, após exame clínico detalhado, concluiu que o autor não apresenta limitações
funcionais relevantes. Não há incapacidade para o trabalho nos termos da Lei 8.213/91.
A capacidade laboral preservada é atestada pelos exames clínicos e laboratoriais realizados.
A perícia judicial é conclusiva: sem incapacidade, total ou parcial, não há fundamento para o
deferimento do benefício. O segurado consegue exercer sua profissão habitual sem limitações
relevantes, afastando o direito ao benefício por incapacidade. Nenhuma incapacidade foi
demonstrada nos autos. O INSS agiu corretamente ao indeferir o pedido na via administrativa,
decisão que merece ser confirmada pelo Poder Judiciário, mantendo o indeferimento do pedido.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido. Confirmo o indeferimento administrativo.
Custas pelo autor. Honorários sucumbenciais de 10% sobre o valor da causa.
Recurso inominado cabível no prazo legal do JEF.
`;
    const errors = validateLegalContradictions(draft);
    assert.equal(
      errors.filter((e) => e.rule === "NO_INCAPACITY_BENEFIT_CONTRADICTION").length,
      0,
    );
  });
});

// T32 — ausência de qualidade de segurado + improcedência — NEGATIVO
describe("T32 — Negativo: ausência de qualidade de segurado + improcedência", () => {
  it("NÃO deve emitir NO_QUALITY_INSURED_BENEFIT_CONTRADICTION", () => {
    const draft = `
FUNDAMENTAÇÃO
O autor não ostenta qualidade de segurado na data de início da incapacidade (DII), conforme
demonstrado pelo histórico de vínculos previdenciários extraído do CNIS. A ausência de qualidade
de segurado impede a concessão do benefício previdenciário, independentemente dos demais
requisitos. O período de graça expirou antes da ocorrência da incapacidade: o último recolhimento
foi efetuado há mais de vinte e quatro meses, ultrapassando o limite do art. 15 da Lei 8.213/91.
Não mantém a qualidade de segurado quem deixa de contribuir por período superior ao previsto.
A carência não cumprida também é obstáculo autônomo ao benefício previdenciário pleiteado.
A qualidade de segurado não comprovada é suficiente para o indeferimento do pedido. Não há como
conceder benefício sem que o segurado preencha esse requisito fundamental previsto em lei.
Todos os documentos confirmam a ausência de vínculo previdenciário ativo na data determinante
para o benefício, o que impõe a improcedência da pretensão deduzida nesta demanda judicial.

DISPOSITIVO
Ante o exposto, julgo improcedente o pedido. Confirmo o indeferimento do benefício previdenciário.
Custas pelo autor. Honorários sucumbenciais de 10% sobre as prestações vencidas.
Recurso inominado no prazo do JEF.
`;
    const errors = validateLegalContradictions(draft);
    assert.equal(
      errors.filter((e) => e.rule === "NO_QUALITY_INSURED_BENEFIT_CONTRADICTION").length,
      0,
    );
  });
});

// T33 — nulidade do ato + anulação correta — NEGATIVO
describe("T33 — Negativo: nulidade do ato + anulação (outcome correto)", () => {
  it("NÃO deve emitir ADMIN_NULLITY_MAINTAINED_ACT_CONTRADICTION", () => {
    const draft = `
FUNDAMENTAÇÃO
O ato administrativo objeto desta impetração é nulo de pleno direito. A nulidade do ato
administrativo decorre de vício formal insanável: ausência de motivação praticado pelo agente
público, ferindo os princípios constitucionais da publicidade e da transparência administrativa.
O ato administrativo nulo não produz efeitos jurídicos válidos e deve ser desconstituído.
Há vício de legalidade manifesto, pois o agente ultrapassou os limites de sua competência.
A incompetência da autoridade que assinou o ato é evidente à luz dos atos normativos internos
que organizam a estrutura administrativa do órgão público. A violação à legalidade é patente:
o ato contraria expressamente o art. 2º da Lei 9.784/99, que exige competência, finalidade e
motivação para todos os atos administrativos. A ausência de motivação do ato, por si só,
acarreta sua nulidade insanável. Segundo Hely Lopes Meirelles, ato nulo é aquele praticado com
infringência às normas de ordem pública. A Administração não pode convalidar ato editado com
tamanho vício de forma, devendo ser ele desconstituído com efeito ex tunc.

DISPOSITIVO
Ante o exposto, concedo a segurança. Anulo o ato administrativo impugnado por vício de
competência e ausência de motivação. Determino a prática de novo ato pelos órgãos competentes.
Custas pela parte impetrada. Honorários advocatícios de 10% sobre o valor da causa.
Apelação cabível no prazo de 15 dias úteis.
`;
    const errors = validateLegalContradictions(draft);
    assert.equal(
      errors.filter((e) => e.rule === "ADMIN_NULLITY_MAINTAINED_ACT_CONTRADICTION").length,
      0,
      `Não esperado ADMIN_NULLITY_MAINTAINED_ACT_CONTRADICTION, obtido: ${JSON.stringify(errors.map((e) => e.rule))}`,
    );
  });
});

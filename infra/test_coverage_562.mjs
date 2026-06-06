import { validateCoverage } from '/opt/judicore/packages/ai/dist/validators/coverage.validator.js';

const ec = (o={}) => ({ tipo_justica:'ESTADUAL',tipo_peca:'PETICAO_INICIAL',regime_juridico:'CIVIL',grau:'PRIMEIRO',tribunal_competente:'N/I',rito:null,assunto_principal:'Demanda Judicial',partes:{autor:'A',reu:'R'},confianca:0.6,...o });
const hasMissing = (errors) => errors.some(e => e.rule === 'MISSING_ESSENTIAL_TOPIC');
const row = (lbl, exp, found) => console.log(lbl+'|'+(exp?'DISPARA':'NAO')+'|'+(found?'DISPAROU':'NAO')+'|'+(exp===found?'PASS':'FAIL'));

// PAD longo (900+ chars úteis) para garantir que qualquer texto específico passe os 800 chars
const PAD = ' Diante do exposto, a parte autora vem respeitosamente à presença de Vossa Excelência requerer o deferimento dos pedidos formulados na presente peça processual inicial, com fundamento nos dispositivos legais citados e na jurisprudência consolidada dos Tribunais Superiores pátrios. Requer-se ainda a concessão dos benefícios da justiça gratuita, nos termos do art. 98 do Código de Processo Civil de 2015, em razão da insuficiência de recursos financeiros da parte autora para arcar com as custas e despesas processuais sem prejuízo do próprio sustento e de sua família. Requer-se a citação do réu para, querendo, apresentar contestação no prazo legal, sob pena de revelia e seus efeitos legais. Requer-se a produção de todas as provas em direito admitidas, especialmente prova documental, testemunhal, pericial e inspeção judicial. Pede-se o julgamento do pedido no mérito com a procedência integral da ação. Pede deferimento.';

// ─── RPPS ────────────────────────────────────────────────────────────────────
// T1: deve disparar — menciona paridade/RPPS mas sem requisitos específicos do benefício
const T1 = validateCoverage(
  'O servidor público efetivo pleiteia aposentadoria voluntária no regime próprio de previdência social com paridade e integralidade dos proventos. O RPPS garante ao servidor o direito à aposentadoria com paridade e integralidade. Requer o reconhecimento do direito à aposentadoria de servidor no regime próprio. A aposentadoria de servidor deve ser concedida com integralidade.' + PAD,
  ec({regime_juridico:'RPPS', assunto_principal:'RPPS aposentadoria servidor público paridade'}));
row('T1 RPPS deve disparar', true, hasMissing(T1));

// T2: não deve disparar — com tempo de contribuição e requisitos
const T2 = validateCoverage(
  'O servidor público efetivo, com trinta e cinco anos de contribuição ao regime próprio, cumpre os requisitos legais do benefício de aposentadoria voluntária. O tempo de serviço prestado é superior ao exigido pela legislação aplicável ao RPPS. O cargo efetivo por mais de dez anos confere o vínculo estatutário comprovado para o direito ao benefício. Requer a aposentadoria com integralidade.' + PAD,
  ec({regime_juridico:'RPPS', assunto_principal:'RPPS aposentadoria voluntária requisitos'}));
row('T2 RPPS nao deve disparar', false, hasMissing(T2));

// ─── TRABALHISTA — VÍNCULO ───────────────────────────────────────────────────
// T3: deve disparar — sem subordinação, pessoalidade, habitualidade, onerosidade
const T3 = validateCoverage(
  'O autor pleiteia o reconhecimento de vínculo de emprego com a empresa ré. A relação de emprego existiu por mais de dois anos de trabalho contínuo para a empresa demandada. Pede-se o reconhecimento de vínculo de emprego com a consequente anotação na CTPS e pagamento de todas as verbas trabalhistas devidas. Requer o reconhecimento do vínculo empregatício com todos os direitos daí decorrentes.' + PAD,
  ec({tipo_justica:'TRABALHO', regime_juridico:'CLT', assunto_principal:'Vínculo de emprego CLT trabalhista'}));
row('T3 TRAB vinculo deve disparar', true, hasMissing(T3));

// T4: não deve disparar — com subordinação, pessoalidade, habitualidade, onerosidade
const T4 = validateCoverage(
  'O autor pleiteia reconhecimento de vínculo de emprego. Há subordinação jurídica evidente, pois cumpria ordens diretas do preposto da ré. A pessoalidade é clara: o serviço era prestado exclusivamente pelo próprio reclamante, sem substituição. A habitualidade e nao eventualidade estão demonstradas pela prestação diária e contínua. A onerosidade manifesta-se pelo salário fixo mensal recebido.' + PAD,
  ec({tipo_justica:'TRABALHO', regime_juridico:'CLT', assunto_principal:'Vínculo de emprego CLT'}));
row('T4 TRAB vinculo nao deve disparar', false, hasMissing(T4));

// ─── TRABALHISTA — VERBAS RESCISÓRIAS ────────────────────────────────────────
// T5: deve disparar — sem modalidade da rescisão
const T5 = validateCoverage(
  'O reclamante pleiteia o pagamento de todas as verbas rescisórias devidas em razão do término do contrato de trabalho com a reclamada. O aviso prévio indenizado não foi pago pela empresa. O saldo de salário está em aberto. As férias proporcionais e o décimo terceiro proporcional não foram quitados. A multa de 40% do FGTS não foi recolhida no prazo legal. Requer o pagamento integral das verbas rescisórias.' + PAD,
  ec({tipo_justica:'TRABALHO', regime_juridico:'CLT', assunto_principal:'Verbas rescisórias trabalhista CLT'}));
row('T5 TRAB rescisao deve disparar', true, hasMissing(T5));

// T6: não deve disparar — com modalidade da rescisão
const T6 = validateCoverage(
  'O reclamante foi dispensado sem justa causa pela empresa reclamada. A modalidade da rescisão é a dispensa sem justa causa, o que gera direito ao aviso prévio indenizado, ao saldo de salário, às férias proporcionais, ao décimo terceiro proporcional e à multa de 40% do FGTS. A dispensa sem justa causa foi confirmada pelo próprio empregador em carta de demissão.' + PAD,
  ec({tipo_justica:'TRABALHO', regime_juridico:'CLT', assunto_principal:'Verbas rescisórias dispensa sem justa causa'}));
row('T6 TRAB rescisao nao deve disparar', false, hasMissing(T6));

// ─── AMBIENTAL ───────────────────────────────────────────────────────────────
// T7: deve disparar — sem nexo conduta nem reparação
const T7 = validateCoverage(
  'Houve supressão de vegetação em Área de Preservação Permanente — APP — sem autorização do IBAMA ou do órgão ambiental estadual competente. A degradação ambiental causou dano ambiental grave ao ecossistema local. A supressão em APP e o desmatamento ilegal violam o Código Florestal. O auto de infração ambiental foi lavrado pelo órgão ambiental competente. A multa ambiental foi aplicada em razão da supressão.' + PAD,
  ec({assunto_principal:'Ambiental APP supressão vegetação dano ambiental IBAMA'}));
row('T7 AMBIENTAL deve disparar', true, hasMissing(T7));

// T8: não deve disparar — com dano, nexo e reparação
const T8 = validateCoverage(
  'A supressão de vegetação em APP causou dano ambiental grave ao ecossistema. O nexo causal entre a conduta do réu e o dano ambiental está comprovado pelo laudo pericial. O réu é o causador direto do desmatamento ilegal na área. A atividade desenvolvida pelo empreendimento causou impacto ambiental severo. Requer a recuperação da área degradada e a indenização ambiental proporcional ao dano.' + PAD,
  ec({assunto_principal:'Ambiental dano APP supressão vegetação'}));
row('T8 AMBIENTAL nao deve disparar', false, hasMissing(T8));

// ─── CRIMINAL — FUNDAMENTOS PENAIS ───────────────────────────────────────────
// T9: deve disparar — sem materialidade, autoria, tipicidade
const T9 = validateCoverage(
  'O Ministério Público oferece denuncia criminal em face do réu acusado pelo crime praticado na data dos fatos narrados no boletim. O acusado deve ser condenado pelo crime descrito na denúncia. O crime narrado é grave e merece punição exemplar. Pede-se a condenação do acusado pelo crime previsto no Código Penal. A denúncia criminal está devidamente fundamentada nos fatos apurados.' + PAD,
  ec({tipo_justica:'CRIMINAL', assunto_principal:'Crime denúncia criminal acusado réu'}));
row('T9 CRIMINAL fundamentos deve disparar', true, hasMissing(T9));

// T10: não deve disparar — com materialidade, autoria, tipicidade
const T10 = validateCoverage(
  'A materialidade do crime está comprovada pelo laudo pericial e pelo boletim de ocorrência lavrado pela autoridade policial. A autoria delitiva é certa, confirmada pelo depoimento de testemunha e pelo reconhecimento pessoal pela vítima do crime. A tipicidade é evidente: a conduta praticada preenche todos os elementos do tipo penal, incluindo o dolo direto e o elemento subjetivo do tipo penal.' + PAD,
  ec({tipo_justica:'CRIMINAL', assunto_principal:'Crime autoria materialidade tipicidade dolo'}));
row('T10 CRIMINAL fundamentos nao deve disparar', false, hasMissing(T10));

// T11: deve disparar dosimetria — condena sem mencionar dosimetria
const T11 = validateCoverage(
  'Pelo exposto, condeno o réu pela prática do crime narrado na denúncia. A pena privativa de liberdade é imposta ao réu condenado. A condenação penal do acusado está fundamentada nas provas produzidas nos autos do processo criminal. O réu fica condenado à pena correspondente ao crime praticado. Fixo a condenação do réu conforme os fatos demonstrados durante a instrução do processo.' + PAD,
  ec({tipo_justica:'CRIMINAL', assunto_principal:'Condenação penal criminal sentença pena privativa'}));
const t11Issues = T11.filter(e=>e.details?.topic==='dosimetria_da_pena');
row('T11 CRIMINAL dosimetria deve disparar', true, t11Issues.length > 0);

// T12: não deve disparar dosimetria — com dosimetria completa
const T12 = validateCoverage(
  'Condeno o réu à pena de quatro anos de reclusão. Na dosimetria, a pena-base foi fixada acima do mínimo em razão das circunstâncias judiciais desfavoráveis. Não há agravante aplicável ao caso. A atenuante da confissão espontânea reduz a pena em um sexto. A causa de aumento não incide no caso concreto. O regime inicial semiaberto é o mais adequado para a pena fixada.' + PAD,
  ec({tipo_justica:'CRIMINAL', assunto_principal:'Condenação penal dosimetria pena regime'}));
const t12Issues = T12.filter(e=>e.details?.topic==='dosimetria_da_pena');
row('T12 CRIMINAL dosimetria nao deve disparar', false, t12Issues.length > 0);

// ─── FAZENDA PÚBLICA — CONCURSO ──────────────────────────────────────────────
// T13: deve disparar — sem direito subjetivo/vagas/preterição
const T13 = validateCoverage(
  'O candidato aprovado em concurso público pleiteia a nomeação ao cargo para o qual foi aprovado. O candidato foi aprovado no concurso público realizado pelo ente público e aguarda a nomeação ao cargo público. O candidato aprovado em concurso público requer a nomeação ao cargo. A nomeação ao cargo é devida ao candidato aprovado em concurso público regularmente realizado.' + PAD,
  ec({assunto_principal:'Concurso público nomeação candidato aprovado Fazenda Pública'}));
row('T13 FAZENDA concurso deve disparar', true, hasMissing(T13));

// T14: não deve disparar — com direito subjetivo e edital
const T14 = validateCoverage(
  'O candidato aprovado dentro das vagas previstas no edital tem direito subjetivo à nomeação ao cargo. A ordem de classificação demonstra que o candidato se encontra dentro do número de vagas do edital. A preterição é evidente: candidatos classificados depois do impetrante foram nomeados. O prazo de validade do concurso ainda não expirou conforme o edital de abertura.' + PAD,
  ec({assunto_principal:'Concurso público nomeação direito subjetivo edital vagas'}));
row('T14 FAZENDA concurso nao deve disparar', false, hasMissing(T14));

// T15: deve disparar ato administrativo — sem legalidade/motivação
const T15 = validateCoverage(
  'O requerente impugna ato administrativo praticado pela Administração Pública municipal. O ente público praticou ato administrativo lesivo ao requerente que não possui qualquer fundamento legal. A Fazenda Pública do Município é responsável pelo ato administrativo atacado nesta demanda. O ente público não pode praticar atos administrativos arbitrários e ilegais contra o cidadão.' + PAD,
  ec({assunto_principal:'Ato administrativo Fazenda Pública administração pública municipal'}));
row('T15 FAZENDA ato deve disparar', true, hasMissing(T15));

// T16: não deve disparar ato administrativo — com legalidade/motivação/vício
const T16 = validateCoverage(
  'O requerente impugna ato administrativo por vício de legalidade insanável. A motivação do ato é absolutamente insuficiente e contraditória. A competência do agente público para a prática do ato não estava demonstrada no processo. O vício formal e o vício material tornam o ato nulo de pleno direito. A razoabilidade e a proporcionalidade não foram observadas. A nulidade decorre do controle judicial do ato.' + PAD,
  ec({assunto_principal:'Ato administrativo legalidade motivação competência vício nulidade'}));
row('T16 FAZENDA ato nao deve disparar', false, hasMissing(T16));

// ─── REGRESSÃO ───────────────────────────────────────────────────────────────
console.log('---REGRESSAO---');

// R1: RGPS especial deve disparar (sem exposição/habitual/PPP)
const R1 = validateCoverage(
  'O segurado pleiteia aposentadoria especial em razão do tempo especial exercido em atividade especial com enquadramento especial. O tempo especial superior a vinte e cinco anos foi acumulado sem demonstração de exposição a agente nocivo. A aposentadoria especial é requerida com base no art. 57 da Lei 8.213/91 e no tempo especial demonstrado nos documentos juntados aos autos processuais.' + PAD,
  ec({regime_juridico:'RGPS', assunto_principal:'RGPS aposentadoria especial'}));
console.log('R1 RGPS_ESPECIAL dispara|'+(hasMissing(R1)?'DISPAROU':'NAO')+'|'+(hasMissing(R1)?'PASS':'FAIL'));

// R2: RPPS com requisitos NÃO deve disparar
const R2 = validateCoverage(
  'O servidor estatutário requer paridade e integralidade dos proventos. O tempo de contribuição ao regime próprio é de trinta e cinco anos. A idade mínima foi atingida. O cargo efetivo por mais de dez anos está comprovado.' + PAD,
  ec({regime_juridico:'RPPS', assunto_principal:'RPPS paridade integralidade requisitos'}));
console.log('R2 RPPS_COM_REQUISITOS nao dispara|'+(!hasMissing(R2)?'NAO_DISPAROU':'DISPAROU')+'|'+(!hasMissing(R2)?'PASS':'FAIL'));

// R3: Consumidor deve disparar (sem falha do serviço)
const R3 = validateCoverage(
  'O consumidor pleiteia a devolução dos valores pagos e reparação por dano moral consumerista decorrente da relação de consumo com o fornecedor de serviços. A relação de consumo é incontroversa entre o consumidor e o fornecedor. Requer-se a repetição do indébito e indenização por dano moral consumerista. O dano sofrido pelo consumidor justifica a reparação integral.' + PAD,
  ec({assunto_principal:'Consumidor dano moral restituição relação de consumo JEC'}));
console.log('R3 CONSUMIDOR dispara|'+(hasMissing(R3)?'DISPAROU':'NAO')+'|'+(hasMissing(R3)?'PASS':'FAIL'));

// R4: Cível geral sem coverage
const R4 = validateCoverage('Ação cível de indenização por danos materiais e morais. O autor pleiteia reparação civil.' + PAD, ec({assunto_principal:'Demanda Judicial cível geral'}));
console.log('R4 CIVEL_GERAL sem coverage|'+(!hasMissing(R4)?'SEM':'TEM_INDEVIDO')+'|'+(!hasMissing(R4)?'PASS':'FAIL'));

// R5: Texto curto — skip global funciona
const R5 = validateCoverage('Crime de roubo. O réu praticou crime.', ec({tipo_justica:'CRIMINAL'}));
console.log('R5 CRIMINAL_CURTO skip|'+(!hasMissing(R5)?'SKIP_OK':'DISPAROU_INDEVIDO')+'|'+(!hasMissing(R5)?'PASS':'FAIL'));

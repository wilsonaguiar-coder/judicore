import { validateCoverage } from '/opt/judicore/packages/ai/dist/validators/coverage.validator.js';

const ec = (o={}) => ({ tipo_justica:'ESTADUAL',tipo_peca:'PETICAO_INICIAL',regime_juridico:'CIVIL',grau:'PRIMEIRO',tribunal_competente:'N/I',rito:null,assunto_principal:'Demanda Judicial',partes:{autor:'A',reu:'R'},confianca:0.6,...o });
const hasRule = (errors) => errors.some(e => e.rule === 'MISSING_ESSENTIAL_TOPIC');
const row = (lbl, expected_fire, found_fire) =>
  console.log(lbl+'|'+(expected_fire?'DISPARA':'NAO_DISPARA')+'|'+(found_fire?'DISPAROU':'NAO_DISPAROU')+'|'+(expected_fire===found_fire?'PASS':'FAIL'));

// Texto realista com 800+ chars de conteúdo (sem padding artificial)
const COMMON = ' Conforme jurisprudência consolidada, os requisitos legais devem ser preenchidos cumulativamente. A parte autora demonstrou os fatos constitutivos do direito pleiteado. O conjunto probatório dos autos corrobora as alegações expostas. Requer-se, portanto, o deferimento dos pedidos na sua integralidade, com fundamento nos dispositivos legais citados e na jurisprudência aplicável ao caso concreto.';

// ─── T1: RGPS especial — deve disparar (sem exposição/habitualidade) ──────────
const T1 = validateCoverage(
  'O segurado pleiteia aposentadoria especial em razão de tempo especial exercido em condições insalubres. O enquadramento especial é devido conforme atividade exercida. Requer a concessão do benefício de aposentadoria especial com fundamento no art. 57 da Lei 8.213/91. O tempo especial acumulado é superior a 25 anos. Requer ainda a conversão de tempo especial em comum para fins de complementação do período necessário. A parte demonstrará os requisitos por meio dos documentos previdenciários juntados aos autos. Pede-se a concessão do benefício em caráter definitivo.' + COMMON,
  ec({regime_juridico:'RGPS'}));
row('T1 RGPS deve disparar', true, hasRule(T1));

// ─── T2: RGPS especial — NÃO deve disparar (exposição + habitual + PPP) ──────
const T2 = validateCoverage(
  'O segurado trabalhou exposto a agente nocivo de ruído acima de 85dB de forma habitual e permanente, não ocasional nem intermitente. O PPP e o LTCAT atestam a exposição habitual ao agente nocivo durante todo o período laborativo. A atividade especial exercida com exposição a agente nocivo químico justifica o enquadramento especial. O laudo técnico comprova a permanência da exposição ao agente nocivo de periculosidade. Requer aposentadoria especial com fundamento no art. 57 da Lei 8.213/91. O regime especial é devido em razão da insalubridade comprovada documentalmente.' + COMMON,
  ec({regime_juridico:'RGPS'}));
row('T2 RGPS nao deve disparar', false, hasRule(T2));

// ─── T3: TRIBUTÁRIO — deve disparar (sem lançamento/constituição) ─────────────
const T3 = validateCoverage(
  'A empresa demanda a anulação do débito fiscal inscrito na Certidão de Dívida Ativa. A execução fiscal foi ajuizada com base no crédito tributário. O débito fiscal questionado refere-se ao exercício de 2020. A empresa contesta o valor do débito fiscal cobrado. A inscrição na CDA foi realizada sem observância dos requisitos legais. A execução fiscal deve ser extinta em razão da irregularidade do título. Requer a extinção da execução fiscal e o cancelamento do crédito tributário inscrito na CDA. A empresa não reconhece o débito fiscal objeto da execução. Pede-se a extinção do feito executivo com julgamento de mérito.' + COMMON,
  ec({tipo_justica:'EXECUCAO_FISCAL', assunto_principal:'Débito fiscal execução CDA'}));
row('T3 TRIBUTARIO deve disparar', true, hasRule(T3));

// ─── T4: TRIBUTÁRIO — NÃO deve disparar (com lançamento + nulidade) ──────────
const T4 = validateCoverage(
  'A empresa impugna o lançamento tributário por vício formal. A constituição do crédito tributário se deu mediante auto de infração sem a devida motivação do ato administrativo. A constituição definitiva não observou o procedimento administrativo de notificação fiscal. O auto de infração foi lavrado sem fundamentação legal suficiente. A nulidade do lançamento decorre da ausência de motivação no ato constitutivo do crédito tributário. Requer a nulidade do lançamento e cancelamento do débito fiscal inscrito na CDA. A constituição do crédito não observou os requisitos do CTN. Pede-se a extinção da execução fiscal e o cancelamento da inscrição na Certidão de Dívida Ativa.' + COMMON,
  ec({tipo_justica:'EXECUCAO_FISCAL', assunto_principal:'Débito fiscal lançamento'}));
row('T4 TRIBUTARIO nao deve disparar', false, hasRule(T4));

// ─── T5: FAMÍLIA guarda — deve disparar (sem melhor interesse nem condições) ──
// Texto deliberadamente sem: melhor interesse, condições genitores, vínculo, rotina
const T5 = validateCoverage(
  'O requerente pleiteia a guarda unilateral do filho. Pede-se a regulamentação da guarda unilateral em seu favor. A disputa de guarda deve ser resolvida pelo Juízo. A guarda compartilhada não é adequada. Requer-se a guarda definitiva com fundamento no art. 1.583 do Código Civil. A guarda unilateral é a medida requerida. Pede-se também a fixação de alimentos e a regulamentação de visitas. O autor é pessoa capaz e reside no mesmo município. A guarda deve ser deferida ao requerente conforme requerido nesta peça inicial.' + COMMON,
  ec({assunto_principal:'Guarda unilateral filho Família'}));
row('T5 FAMILIA deve disparar', true, hasRule(T5));

// ─── T6: FAMÍLIA guarda — NÃO deve disparar (melhor interesse + condições) ───
const T6 = validateCoverage(
  'A requerente pleiteia a guarda unilateral do filho menor. O melhor interesse da criança aponta para a permanência com a genitora, que exerce os cuidados diários com dedicação. A rotina da criança está estabelecida com a mãe, que cuida do menor com amor e responsabilidade. O vínculo afetivo da criança com a genitora é sólido e estável. As condições de vida da genitora são adequadas ao desenvolvimento integral da criança. O bem-estar e o desenvolvimento da criança são prioridades absolutas nesta demanda. A capacidade parental da genitora foi atestada por laudo psicossocial favorável. O ambiente familiar proporcionado pela mãe é estável e saudável.' + COMMON,
  ec({assunto_principal:'Guarda criança Família'}));
row('T6 FAMILIA nao deve disparar', false, hasRule(T6));

// ─── T7: CONSUMIDOR — deve disparar (sem descrição da falha do serviço)
// Texto tem trigger (restituição + dano moral consumerista) mas sem: falha na prestação,
// serviço defeituoso, produto defeituoso, conduta ilícita
const T7 = validateCoverage(
  'O consumidor pleiteia a restituição de valores e indenização por dano moral consumerista. A empresa é fornecedora de serviços. O consumidor realizou pagamentos durante o contrato firmado. A relação de consumo entre as partes é evidente. Requer-se a devolução dos valores e a reparação por dano moral consumerista. O consumidor não obteve resposta adequada da empresa fornecedora. Pede-se a condenação da empresa à repetição do indébito nos termos do art. 42 do CDC. O dano moral consumerista merece reparação. Requer-se o deferimento dos pedidos.' + COMMON,
  ec({assunto_principal:'Consumidor relação de consumo dano moral'}));
row('T7 CONSUMIDOR deve disparar', true, hasRule(T7));

// ─── T8: CONSUMIDOR — NÃO deve disparar (falha + nexo) ───────────────────────
const T8 = validateCoverage(
  'O consumidor pleiteia restituição de valores pagos indevidamente e reparação por dano moral. A cobrança indevida foi o ilícito praticado pelo fornecedor na relação de consumo. O serviço defeituoso prestado pelo fornecedor gerou dano ao consumidor. A falha na prestação do serviço é evidente e comprovada pelos documentos juntados. O nexo causal entre a falha do fornecedor e o prejuízo sofrido pelo consumidor é direto e comprovado. O abalo moral decorrente da cobrança indevida é indenizável. O pagamento indevido gerou prejuízo financeiro ao consumidor. Requer-se a repetição do indébito em dobro e dano moral decorrente do nexo causal estabelecido.' + COMMON,
  ec({assunto_principal:'Consumidor relação de consumo cobrança indevida'}));
row('T8 CONSUMIDOR nao deve disparar', false, hasRule(T8));

console.log('---REGRESSAO---');

// R1: RPPS — não coberto nesta fase
const R1 = validateCoverage(
  'O servidor público estatutário requer paridade e integralidade dos proventos de aposentadoria com base no art. 40 da Constituição Federal. O regime próprio de previdência social assegura a paridade remuneratória para os servidores admitidos antes da EC 41/2003.' + COMMON,
  ec({regime_juridico:'RPPS', assunto_principal:'RPPS paridade integralidade'}));
console.log('R1 RPPS|SEM_MISSING|'+(R1.length===0?'NENHUM':'DISPAROU_INDEVIDO')+'|'+(R1.length===0?'PASS':'FAIL'));

// R2: Trabalhista — não coberto nesta fase
const R2 = validateCoverage(
  'O reclamante foi dispensado por justa causa sem comprovação de falta grave. A ausência de gradação das penalidades invalida a justa causa. Requer verbas rescisórias, aviso prévio e multa de 40% do FGTS conforme o art. 482 da CLT.' + COMMON,
  ec({tipo_justica:'TRABALHO', regime_juridico:'CLT', assunto_principal:'Justa causa trabalhista CLT'}));
console.log('R2 TRABALHISTA|SEM_MISSING|'+(R2.length===0?'NENHUM':'DISPAROU_INDEVIDO')+'|'+(R2.length===0?'PASS':'FAIL'));

// R3: Template com muitos placeholders — skip
const R3t = '[ENDEREÇAMENTO]\n[QUALIFICAÇÃO DAS PARTES]\n[INSERIR FATOS DO CASO]\n[A DETERMINAR]\n[PREENCHER DADOS REAIS]\n[FUNDAMENTAÇÃO JURÍDICA]\n[PEDIDOS]\naposentadoria especial tempo especial agente nocivo PPP LTCAT'.padEnd(1000);
const R3 = validateCoverage(R3t, ec({regime_juridico:'RGPS'}));
console.log('R3 TEMPLATE_SKIP|SEM_MISSING|'+(R3.length===0?'SKIP_OK':'DISPAROU_INDEVIDO')+'|'+(R3.length===0?'PASS':'FAIL'));

// R4: RGPS invalidez (não especial) — sem MISSING
const R4 = validateCoverage(
  'O segurado requer aposentadoria por invalidez em razão de incapacidade laborativa total e permanente. O laudo médico atesta a incapacidade total para o trabalho. Possui qualidade de segurado e cumpriu a carência de 12 meses. Requer a concessão do benefício com fundamento no art. 42 da Lei 8.213/91.' + COMMON,
  ec({regime_juridico:'RGPS'}));
console.log('R4 RGPS_INVALIDADE|SEM_MISSING|'+(!hasRule(R4)?'NENHUM':'DISPAROU_INDEVIDO')+'|'+(!hasRule(R4)?'PASS':'FAIL'));

// R5: Família alimentos (não guarda) — sem MISSING
const R5 = validateCoverage(
  'A requerente pleiteia alimentos em favor do filho menor. O binômio necessidade-possibilidade justifica a fixação dos alimentos. O alimentante possui capacidade financeira comprovada. Pede-se a fixação de alimentos provisórios com fundamento no art. 1.694 do Código Civil.' + COMMON,
  ec({assunto_principal:'Alimentos filho menor Família'}));
console.log('R5 FAMILIA_ALIMENTOS|SEM_MISSING|'+(!hasRule(R5)?'NENHUM':'DISPAROU_INDEVIDO')+'|'+(!hasRule(R5)?'PASS':'FAIL'));

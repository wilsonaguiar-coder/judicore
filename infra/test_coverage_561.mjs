import { validateCoverage, normalizeForCoverage } from '/opt/judicore/packages/ai/dist/validators/coverage.validator.js';

const ec = (o={}) => ({ tipo_justica:'ESTADUAL',tipo_peca:'PETICAO_INICIAL',regime_juridico:'CIVIL',grau:'PRIMEIRO',tribunal_competente:'N/I',rito:null,assunto_principal:'Demanda Judicial',partes:{autor:'A',reu:'R'},confianca:0.6,...o });
const hasRule = (errors) => errors.some(e => e.rule === 'MISSING_ESSENTIAL_TOPIC');
const row = (lbl, expected_fire, found_fire) =>
  console.log(lbl+'|'+(expected_fire?'DISPARA':'NAO')+'|'+(found_fire?'DISPAROU':'NAO')+'|'+(expected_fire===found_fire?'PASS':'FAIL'));

// Padding realista longo (800+ chars por si só) — simula final de peça jurídica real
const PAD = ' Diante do exposto, a parte autora vem respeitosamente à presença de Vossa Excelência requerer a procedência dos pedidos formulados na presente peça processual, com fundamento nos dispositivos legais e na jurisprudência consolidada dos Tribunais Superiores. Requer-se ainda a concessão dos benefícios da justiça gratuita, nos termos do art. 98 do CPC/2015, em razão da insuficiência de recursos financeiros da parte autora para arcar com as custas e despesas processuais sem prejuízo do próprio sustento e de sua família. Requer a citação do réu para, querendo, apresentar contestação no prazo legal, sob pena de revelia e seus efeitos legais. Requer a produção de todas as provas em direito admitidas, especialmente prova documental, testemunhal, pericial e inspeção judicial. Pede deferimento.';

// ─── TESTES 1-8 (regressão da FASE 5.6) ─────────────────────────────────────

// T1: RGPS especial — sem exposição, sem habitualidade, sem PPP  → DISPARA
const T1 = validateCoverage(
  'O segurado pleiteia aposentadoria especial em razão de tempo especial exercido durante vinte e sete anos. O enquadramento especial é devido conforme atividade exercida no período de contribuição. Requer a concessão do benefício de aposentadoria especial com fundamento no art. 57 da Lei 8.213/91 e Decreto 3.048/99. O tempo especial acumulado é superior ao exigido pela legislação previdenciária. Requer ainda a conversão de tempo especial em comum para complementação do período necessário à aposentadoria.' + PAD,
  ec({regime_juridico:'RGPS'}));
row('T1 RGPS dispara', true, hasRule(T1));

// T2: RGPS com exposição + habitual + PPP → NÃO DISPARA
const T2 = validateCoverage(
  'O segurado trabalhou exposto a agente nocivo de ruído acima de 85dB de forma habitual e permanente, não ocasional nem intermitente, conforme demonstrado pelo PPP e pelo LTCAT juntados aos autos. A exposição habitual ao agente nocivo químico e ao calor excessivo durante toda a jornada justifica o enquadramento especial. O laudo técnico pericial e o perfil profissiográfico atestam a permanência da exposição. Requer aposentadoria especial.' + PAD,
  ec({regime_juridico:'RGPS'}));
row('T2 RGPS nao dispara', false, hasRule(T2));

// T3: Tributário sem lançamento → DISPARA
const T3 = validateCoverage(
  'A empresa demanda a anulação do débito fiscal inscrito na Certidão de Dívida Ativa. A execução fiscal foi ajuizada com base no crédito tributário questionado pela contribuinte. O débito fiscal refere-se a exercícios passados e não foi devidamente notificado. A inscrição na CDA foi realizada sem observância dos requisitos legais cabíveis. Requer a extinção da execução fiscal e o cancelamento do crédito tributário inscrito, bem como a desconstituição do título executivo extrajudicial.' + PAD,
  ec({tipo_justica:'EXECUCAO_FISCAL', assunto_principal:'Débito fiscal CDA execução fiscal'}));
row('T3 TRIBUTARIO dispara', true, hasRule(T3));

// T4: Tributário com lançamento + nulidade → NÃO DISPARA
const T4 = validateCoverage(
  'A empresa impugna o lançamento tributário por vício formal insanável. A constituição do crédito tributário mediante auto de infração lavrado sem motivação viola o art. 148 do CTN. A constituição definitiva do crédito não observou o procedimento administrativo de notificação fiscal pessoal. A nulidade do lançamento decorre da ausência de motivação e da incompetência do agente fiscal. Requer a nulidade do lançamento e cancelamento do débito fiscal inscrito na CDA.' + PAD,
  ec({tipo_justica:'EXECUCAO_FISCAL', assunto_principal:'Débito fiscal lançamento tributário CDA'}));
row('T4 TRIBUTARIO nao dispara', false, hasRule(T4));

// T5: Família guarda sem melhor interesse nem condições → DISPARA
const T5 = validateCoverage(
  'O requerente pleiteia a guarda unilateral do filho nascido em quinze de março de dois mil e dezesseis. Pede-se a regulamentação da guarda unilateral em seu favor com base no art. 1.583 do Código Civil. A guarda compartilhada não se mostra adequada ao caso concreto. Requer-se a guarda definitiva do menor com fixação de regime de visitas ao outro cônjuge. Pede-se ainda a fixação de alimentos no valor de trinta por cento dos rendimentos do cônjuge adverso.' + PAD,
  ec({assunto_principal:'Guarda unilateral filho menor Família'}));
row('T5 FAMILIA dispara', true, hasRule(T5));

// T6: Família com melhor interesse e condições → NÃO DISPARA
const T6 = validateCoverage(
  'A requerente pleiteia a guarda unilateral do filho. O melhor interesse da criança aponta para a permanência com a mãe, que exerce os cuidados diários. O vínculo afetivo da criança com a genitora é sólido e estável. As condições de vida da genitora são adequadas ao desenvolvimento integral. A rotina da criança está bem estabelecida com a mãe. O cuidado cotidiano com o filho é exercido pela genitora. O ambiente familiar é propício ao crescimento saudável do menor.' + PAD,
  ec({assunto_principal:'Guarda criança Família melhor interesse'}));
row('T6 FAMILIA nao dispara', false, hasRule(T6));

// T7: Consumidor sem falha nem nexo → DISPARA
const T7 = validateCoverage(
  'O consumidor pleiteia a restituição de valores pagos à empresa e indenização por dano moral consumerista. A empresa é fornecedora de serviços ao consumidor pessoa física. O consumidor realizou pagamentos mensais ao longo do contrato. A relação de consumo entre as partes é evidente e incontroversa. Pede-se a repetição do indébito nos termos do art. 42 do CDC e a reparação por dano moral consumerista. O consumidor não obteve resposta satisfatória após múltiplas tentativas de solução extrajudicial.' + PAD,
  ec({assunto_principal:'Consumidor relação de consumo dano moral restituição'}));
row('T7 CONSUMIDOR dispara', true, hasRule(T7));

// T8: Consumidor com falha + nexo → NÃO DISPARA
const T8 = validateCoverage(
  'O consumidor pleiteia restituição de valores indevidamente cobrados. O serviço defeituoso prestado pelo fornecedor gerou dano real ao consumidor. A falha na prestação do serviço é comprovada pelos documentos juntados. O nexo causal entre a falha do fornecedor e o prejuízo sofrido é direto. O abalo moral decorrente da conduta do fornecedor é indenizável. Pede-se a repetição do indébito em dobro e dano moral com fundamento no nexo causal estabelecido.' + PAD,
  ec({assunto_principal:'Consumidor cobrança indevida falha serviço dano'}));
row('T8 CONSUMIDOR nao dispara', false, hasRule(T8));

// ─── NOVOS TESTES 5.6.1 ─────────────────────────────────────────────────────

// T9: Texto SEM ACENTO → dispara (normalizeForCoverage garante)
// Deliberadamente sem mencionar: exposicao, habitual, permanente, PPP, LTCAT
const T9 = validateCoverage(
  'O segurado pleiteia aposentadoria especial em razao de tempo especial acumulado durante atividade especial remunerada. O enquadramento especial e devido conforme o art. 57 da Lei 8.213/91 e o Decreto 3.048/99. O tempo especial de vinte e cinco anos foi exercido em condicoes desfavoraveis a saude. Requer a concessao definitiva da aposentadoria especial com conversao de tempo especial em comum para complementacao. O pedido e baseado unicamente no tempo especial comprovado pelos documentos juntados.' + PAD,
  ec({regime_juridico:'RGPS'}));
row('T9 RGPS sem acento dispara', true, hasRule(T9));

// T10: Texto CURTO → skip (< 800 chars)
const T10 = validateCoverage(
  'Peça inicial sobre aposentadoria especial. Requer procedência.',
  ec({regime_juridico:'RGPS'}));
row('T10 texto curto nao dispara', false, hasRule(T10));

// T11: Template com {{ }} → skip
const T11 = validateCoverage(
  '{{NOME_AUTOR}} pleiteia aposentadoria especial. O tempo especial é de {{ANOS}} anos. [PREENCHER] exposição.' + PAD,
  ec({regime_juridico:'RGPS'}));
row('T11 template marcadores nao dispara', false, hasRule(T11));

// T12: Jurisprudência isolada → skip
const T12 = validateCoverage(
  `EMENTA: APOSENTADORIA ESPECIAL. Relator: Min. Fulano. STJ. TRF. Acórdão unânime. Julgado em 15/03/2024. DJe 20/03/2024. STF precedente. Turma Especializada. TRT. TST. Precedente aplicável conforme ementa. Relator indicado no acórdão. STJ consolidou entendimento. TRF Regional. Acórdão definitivo. Relator do caso. Julgado pela turma especializada do STJ com fundamento no precedente do STF. DJe publicado. Ementa completa.`.padEnd(900, ' X'),
  ec({regime_juridico:'RGPS'}));
row('T12 jurisprudencia isolada nao dispara', false, hasRule(T12));

// T13: Deduplicação → apenas 1 alerta RGPS mesmo com múltiplas menções de aposentadoria especial
// Sem palavras de cobertura (sem exposicao, habitual, permanente, PPP, LTCAT)
const T13 = validateCoverage(
  'O segurado pleiteia aposentadoria especial. A aposentadoria especial é devida pelo tempo especial. A atividade especial e o enquadramento especial justificam o pedido de aposentadoria especial. O tempo especial de vinte e seis anos está demonstrado. A aposentadoria especial deve ser concedida. O enquadramento especial da atividade especial exercida pelo segurado é incontroverso. Requer-se a concessão da aposentadoria especial definitiva com base no tempo especial comprovado documentalmente.' + PAD,
  ec({regime_juridico:'RGPS'}));
const t13Count = T13.filter(e => e.rule === 'MISSING_ESSENTIAL_TOPIC').length;
console.log('T13 deduplicacao|MAX_1_ALERTA|count='+t13Count+'|'+(t13Count === 1 ? 'PASS' : 'FAIL'));

// T14: Details auditável → verificar campos obrigatórios
const T14 = validateCoverage(
  'O segurado pleiteia aposentadoria especial e tempo especial com enquadramento especial. PPP não foi apresentado adequadamente. Requer concessão da aposentadoria especial definitiva com base no art. 57.' + PAD,
  ec({regime_juridico:'RGPS'}));
const t14Issue = T14.find(e => e.rule === 'MISSING_ESSENTIAL_TOPIC');
const d = t14Issue?.details;
const hasDetails = d && typeof d.topic==='string' && Array.isArray(d.missing) && Array.isArray(d.matchedTriggers) && Array.isArray(d.checkedBlocks);
console.log('T14 details auditavel|HAS_topic+missing+triggers+blocks|topic:'+d?.topic+' missing:'+JSON.stringify(d?.missing)+'|'+(hasDetails?'PASS':'FAIL'));

console.log('---REGRESSAO---');
const R1 = validateCoverage('O servidor estatutário requer paridade e integralidade com base no art. 40 CF. O regime próprio de previdência social assegura a paridade remuneratória.' + PAD, ec({regime_juridico:'RPPS',assunto_principal:'RPPS paridade'}));
console.log('R1 RPPS|SEM_MISSING|'+(R1.length===0?'PASS':'FAIL'));
const R2 = validateCoverage('O reclamante foi dispensado por justa causa sem comprovação de falta grave. Requer verbas rescisórias, aviso prévio e multa de 40% do FGTS conforme art. 482 CLT.' + PAD, ec({tipo_justica:'TRABALHO',regime_juridico:'CLT',assunto_principal:'Justa causa CLT'}));
console.log('R2 TRABALHISTA|SEM_MISSING|'+(R2.length===0?'PASS':'FAIL'));
const R3 = validateCoverage('Segurado com carência cumprida requer aposentadoria por invalidez. Laudo médico atesta incapacidade total. Base: art. 42 Lei 8.213/91.' + PAD, ec({regime_juridico:'RGPS'}));
console.log('R3 RGPS_INVALIDADE|SEM_MISSING|'+(!hasRule(R3)?'PASS':'FAIL'));

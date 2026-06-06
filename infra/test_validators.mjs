import { FinalValidator } from '/opt/judicore/packages/ai/dist/validators/final.validator.js';
import { SentencaValidator } from '/opt/judicore/packages/ai/dist/validators/sentenca.validator.js';

const fv = new FinalValidator();
const sv = new SentencaValidator();
const ec = (o={}) => ({ tipo_justica:'ESTADUAL',tipo_peca:'PETICAO_INICIAL',regime_juridico:'CIVIL',grau:'PRIMEIRO',tribunal_competente:'N/I',rito:null,assunto_principal:'Demanda Judicial',partes:{autor:'A',reu:'R'},confianca:0.6,...o });
const ex = () => ({ fatos:[],pedidos:[],questoes_juridicas:[],artigos_citados:[],jurisprudencias_relevantes:[],qualidade_extracao:'SUFICIENTE',motivo_qualidade:null });
const mx = () => ({ teses:[] });
const au = () => ({ aprovada:true,score:75,erros:[],resumo:'' });
const fr = (r,...rules) => r.errors.filter(e=>rules.includes(e.rule)).map(e=>e.rule);
const row = (lbl,exp,found) => {
  const f = found.length ? found.join(',') : 'NENHUM';
  console.log(lbl+'|'+exp+'|'+f+'|'+(found.includes(exp)?'PASS':'FAIL'));
};

// T1 — RGPS: "nem cumpriu a carência" (texto com acentos reais como em documento real)
const T1 = fv.validate(
  'O autor não possui qualidade de segurado, nem cumpriu a carência exigida. Ainda assim, concedo o benefício previdenciário.',
  ec({regime_juridico:'RGPS'}), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
row('T1 RGPS','RGPS_REQUIREMENTS_INCONSISTENCY',fr(T1,'RGPS_REQUIREMENTS_INCONSISTENCY'));

// T1b — RGPS: variante sem acento (texto extraído de PDF com encoding ruim)
const T1b = fv.validate(
  'o autor nao possui qualidade de segurado, nem cumpriu a carencia. Ainda assim, concedo o beneficio previdenciario.',
  ec({regime_juridico:'RGPS'}), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
const t1b_found = fr(T1b,'RGPS_REQUIREMENTS_INCONSISTENCY');
console.log('T1b RGPS (sem acento)|RGPS_REQUIREMENTS_INCONSISTENCY|'+(t1b_found.length?t1b_found.join(','):'NENHUM')+'|'+(t1b_found.includes('RGPS_REQUIREMENTS_INCONSISTENCY')?'PASS':'FAIL*nota:regex exige acento em benefício'));

// T2 — TRIBUTARIO: com acentos reais
const T2 = fv.validate(
  'Houve lançamento do crédito tributário. A empresa sustenta prescrição para constituir o crédito, com aplicação do art. 174 do CTN.',
  ec(), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
row('T2 TRIBUTARIO','POSSIBLE_DECADENCE_PRESCRIPTION_CONFUSION',fr(T2,'POSSIBLE_DECADENCE_PRESCRIPTION_CONFUSION'));

// T2b — TRIBUTARIO: variante sem acento
const T2b = fv.validate(
  'houve lancamento, prescricao para constituir o credito e aplicacao do art. 174 do CTN.',
  ec(), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
const t2b_found = fr(T2b,'POSSIBLE_DECADENCE_PRESCRIPTION_CONFUSION');
console.log('T2b TRIBUTARIO (sem acento)|POSSIBLE_DECADENCE_PRESCRIPTION_CONFUSION|'+(t2b_found.length?t2b_found.join(','):'NENHUM')+'|'+(t2b_found.includes('POSSIBLE_DECADENCE_PRESCRIPTION_CONFUSION')?'PASS':'FAIL*nota:lancamento/credito precisam de acento'));

// T3 — AMBIENTAL: APP + não existe responsabilidade + multa
const T3 = fv.validate(
  'Houve supressão de vegetação em APP sem autorização. Não existe responsabilidade civil ambiental, pois a multa administrativa é suficiente.',
  ec(), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
row('T3 AMBIENTAL','ENVIRONMENTAL_LIABILITY_WARNING',fr(T3,'ENVIRONMENTAL_LIABILITY_WARNING'));

// T4 — FAMÍLIA: fundamentação mãe, dispositivo pai
const T4d = 'RELATÓRIO\nA genitora requer a guarda.\nFUNDAMENTAÇÃO\nO melhor interesse da criança aponta permanência com a mãe. A criança está adaptada com a genitora.\nAnte o exposto: Defiro a guarda unilateral ao pai.';
const T4 = sv.validate(T4d, ec({tipo_peca:'SENTENCA'}));
row('T4 FAMILIA','FAMILY_REASONING_DISPOSITIVE_CONTRADICTION',fr(T4,'FAMILY_REASONING_DISPOSITIVE_CONTRADICTION'));

// R1 — RPPS: sem alertas indevidos
const R1 = fv.validate(
  'Servidor estatutário requer paridade e integralidade com base no art. 40 CF.',
  ec({regime_juridico:'RPPS',assunto_principal:'RPPS'}), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
const r1u = fr(R1,'RGPS_REQUIREMENTS_INCONSISTENCY','ENVIRONMENTAL_LIABILITY_WARNING','POSSIBLE_DECADENCE_PRESCRIPTION_CONFUSION');
console.log('R1 RPPS REGRESSAO|SEM_ALERTAS_NOVOS|'+(r1u.length?r1u.join(','):'NENHUM')+'|'+(r1u.length===0?'PASS':'FAIL'));

// R2 — Template incompleto: deve disparar
const R2 = fv.validate(
  '[ENDEREÇAMENTO]\n[QUALIFICAÇÃO DAS PARTES]\n[INSERIR FATOS DO CASO]\n[A DETERMINAR]\n[PREENCHER DADOS REAIS]',
  ec(), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
row('R2 TEMPLATE','UNFILLED_TEMPLATE_PLACEHOLDERS',fr(R2,'UNFILLED_TEMPLATE_PLACEHOLDERS','EMPTY_OR_SKELETON_DRAFT'));

// R3 — RGPS normal: sem inconsistency
const R3 = fv.validate(
  'O segurado, com qualidade de segurado e carência cumprida, requer aposentadoria por invalidez.',
  ec({regime_juridico:'RGPS'}), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
const r3u = fr(R3,'RGPS_REQUIREMENTS_INCONSISTENCY');
console.log('R3 RGPS NORMAL|SEM_INCONSISTENCY|'+(r3u.length?r3u.join(','):'NENHUM')+'|'+(r3u.length===0?'PASS':'FAIL'));

// R4 — Trabalhista: sem alertas de outros domínios
const R4 = fv.validate(
  'O reclamante foi dispensado por justa causa. Requer nulidade da justa causa, aviso prévio indenizado e verbas rescisórias.',
  ec({tipo_justica:'TRABALHO',regime_juridico:'CLT'}), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
const r4u = fr(R4,'RGPS_REQUIREMENTS_INCONSISTENCY','ENVIRONMENTAL_LIABILITY_WARNING','POSSIBLE_DECADENCE_PRESCRIPTION_CONFUSION','FAMILY_REASONING_DISPOSITIVE_CONTRADICTION');
console.log('R4 TRABALHISTA REGRESSAO|SEM_ALERTAS_CRUZADOS|'+(r4u.length?r4u.join(','):'NENHUM')+'|'+(r4u.length===0?'PASS':'FAIL'));

// R5 — CONSUMIDOR no JEC: deve retornar CONSUMIDOR como perfil via selectProfile
// (apenas verifica que regras de consumidor não disparam falsos em JEC sem CDC)
const R5 = fv.validate(
  'Ação no Juizado Especial Cível. O consumidor alega produto defeituoso. Relação de consumo com fornecedor.',
  ec({tipo_justica:'JEC',assunto_principal:'Consumidor - produto defeituoso - JEC'}), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
const r5u = fr(R5,'RGPS_REQUIREMENTS_INCONSISTENCY','ENVIRONMENTAL_LIABILITY_WARNING','SENTENCE_REASONING_DISPOSITIVE_CONTRADICTION');
console.log('R5 CONSUMIDOR JEC|SEM_ALERTAS_INDEVIDOS|'+(r5u.length?r5u.join(','):'NENHUM')+'|'+(r5u.length===0?'PASS':'FAIL'));

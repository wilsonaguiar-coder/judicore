/**
 * BATERIA FINAL — FASE 5.6.2
 * Cobre: 16 testes novos + regressão completa (5.5.2, 5.6, 5.6.1, validators homologados)
 */
import { validateCoverage } from '/opt/judicore/packages/ai/dist/validators/coverage.validator.js';
import { FinalValidator }   from '/opt/judicore/packages/ai/dist/validators/final.validator.js';
import { SentencaValidator } from '/opt/judicore/packages/ai/dist/validators/sentenca.validator.js';
import { AuditReportEngine } from '/opt/judicore/packages/ai/dist/audit-report/audit-report.engine.js';

const fv  = new FinalValidator();
const sv  = new SentencaValidator();
const eng = new AuditReportEngine();

const ec = (o={}) => ({ tipo_justica:'ESTADUAL',tipo_peca:'PETICAO_INICIAL',regime_juridico:'CIVIL',grau:'PRIMEIRO',tribunal_competente:'N/I',rito:null,assunto_principal:'Demanda Judicial',partes:{autor:'A',reu:'R'},confianca:0.6,...o });
const ex = () => ({ fatos:[],pedidos:[],questoes_juridicas:[],artigos_citados:[],jurisprudencias_relevantes:[],qualidade_extracao:'SUFICIENTE',motivo_qualidade:null });
const mx = () => ({ teses:[] });
const au = () => ({ aprovada:true,score:75,erros:[],resumo:'' });
const hasMissing  = (e) => e.some(x => x.rule === 'MISSING_ESSENTIAL_TOPIC');
const hasRule     = (e, r) => e.some(x => x.rule === r);
const noRule      = (e, r) => !e.some(x => x.rule === r);
const rows = [];
const row = (lbl, esp, enc) => rows.push([lbl, esp?'DISPARA':'NAO_DISPARA', enc?'DISPAROU':'NAO_DISPAROU', esp===enc?'PASS':'FAIL']);

const PAD = ' Diante do exposto, a parte autora vem respeitosamente à presença de Vossa Excelência requerer o deferimento dos pedidos formulados na presente peça processual inicial, com fundamento nos dispositivos legais citados e na jurisprudência consolidada dos Tribunais Superiores pátrios. Requer-se ainda a concessão dos benefícios da justiça gratuita, nos termos do art. 98 do Código de Processo Civil de 2015, em razão da insuficiência de recursos financeiros da parte autora para arcar com as custas e despesas processuais sem prejuízo do próprio sustento e de sua família. Requer-se a citação do réu para, querendo, apresentar contestação no prazo legal, sob pena de revelia e seus efeitos legais previstos no art. 344 do CPC. Requer-se a produção de todas as provas em direito admitidas, especialmente prova documental, testemunhal, pericial e inspeção judicial quando necessário. Pede-se o julgamento do pedido no mérito com a procedência integral da ação. Nestes termos, pede e espera deferimento.';

// ═══════════════════════════════════════════════════════════════════
// BLOCO A — 16 testes novos da FASE 5.6.2
// ═══════════════════════════════════════════════════════════════════

// ── RPPS (2) ──────────────────────────────────────────────────────
const A1 = validateCoverage(
  'O servidor público efetivo pleiteia aposentadoria voluntária no regime próprio com paridade e integralidade. O RPPS garante o benefício ao servidor público. Requer o reconhecimento do direito à aposentadoria de servidor com integralidade e paridade dos proventos.' + PAD,
  ec({regime_juridico:'RPPS', assunto_principal:'RPPS aposentadoria servidor público paridade'}));
row('A1 RPPS dispara',          true,  hasMissing(A1));

const A2 = validateCoverage(
  'O servidor efetivo, com trinta e cinco anos de contribuição ao regime próprio, cumpre os requisitos legais do benefício. O tempo de serviço e a idade mínima foram atingidos. O vínculo estatutário comprovado pelo cargo efetivo por mais de dez anos assegura o direito.' + PAD,
  ec({regime_juridico:'RPPS', assunto_principal:'RPPS aposentadoria voluntária requisitos'}));
row('A2 RPPS nao dispara',       false, hasMissing(A2));

// ── TRABALHISTA (4) ───────────────────────────────────────────────
const A3 = validateCoverage(
  'O autor pleiteia o reconhecimento de vínculo de emprego com a empresa ré. A relação de emprego existiu por mais de dois anos de trabalho para a reclamada. Pede-se o reconhecimento do vínculo empregatício com anotação na CTPS. Requer o pagamento das verbas trabalhistas decorrentes do período trabalhado.' + PAD,
  ec({tipo_justica:'TRABALHO', regime_juridico:'CLT', assunto_principal:'Vínculo emprego CLT trabalhista'}));
row('A3 TRAB vínculo dispara',   true,  hasMissing(A3));

const A4 = validateCoverage(
  'Há subordinação jurídica evidente, pois o autor recebia ordens diretas do preposto da ré. A pessoalidade é clara: o serviço era prestado exclusivamente pelo próprio autor. A habitualidade e nao eventualidade estão demonstradas pela prestação diária. A onerosidade revela-se pelo salário fixo mensal recebido. Reconhecimento de vínculo de emprego.' + PAD,
  ec({tipo_justica:'TRABALHO', regime_juridico:'CLT', assunto_principal:'Vínculo emprego CLT'}));
row('A4 TRAB vínculo nao dispara',false, hasMissing(A4));

// A5: pede verbas rescisórias sem dizer COMO o contrato terminou (sem qualquer palavra de modalidade)
const A5 = validateCoverage(
  'O reclamante pleiteia o pagamento do aviso prévio indenizado não quitado pela empresa. O saldo de salário está em aberto. As férias proporcionais e o décimo terceiro proporcional não foram pagos. A multa de 40% do FGTS é devida. A empresa não realizou o acerto das parcelas rescisórias no prazo legal estabelecido.' + PAD,
  ec({tipo_justica:'TRABALHO', regime_juridico:'CLT', assunto_principal:'Verbas rescisórias CLT trabalhista'}));
row('A5 TRAB rescisão dispara',  true,  hasMissing(A5));

const A6 = validateCoverage(
  'O reclamante foi dispensado sem justa causa. A modalidade da rescisão — dispensa sem justa causa — gera aviso prévio indenizado, multa de 40% do FGTS, saldo de salário e décimo terceiro proporcional.' + PAD,
  ec({tipo_justica:'TRABALHO', regime_juridico:'CLT', assunto_principal:'Verbas rescisórias dispensa sem justa causa'}));
row('A6 TRAB rescisão nao dispara',false,hasMissing(A6));

// ── AMBIENTAL (2) ─────────────────────────────────────────────────
// A7: descreve o fato ambiental sem mencionar nexo, causador ou reparação
const A7 = validateCoverage(
  'Houve supressão de vegetação em APP sem autorização do órgão ambiental. O IBAMA lavrou auto de infração ambiental. A área de preservação permanente foi afetada pelo desmatamento irregular. Poluição identificada no local. Multa ambiental aplicada pelo órgão competente.' + PAD,
  ec({assunto_principal:'Ambiental APP supressão vegetação dano ambiental IBAMA'}));
row('A7 AMBIENTAL dispara',      true,  hasMissing(A7));

const A8 = validateCoverage(
  'Supressão em APP causou dano ambiental grave. O nexo causal entre a conduta do causador e o dano está comprovado. O réu é responsável. Requer a recuperação da área degradada e compensação ambiental.' + PAD,
  ec({assunto_principal:'Ambiental dano APP supressão vegetação'}));
row('A8 AMBIENTAL nao dispara',  false, hasMissing(A8));

// ── CRIMINAL (4) ──────────────────────────────────────────────────
// A9: denúncia criminal sem análise dos pilares — não menciona materialidade/autoria/tipicidade
const A9 = validateCoverage(
  'O Ministério Público oferece denuncia criminal em face do acusado pelo crime praticado na data dos fatos. O réu praticou o ilícito narrado na denúncia e deve ser responsabilizado. Pede-se a condenação do acusado à pena prevista em lei. O crime é grave e merece punição exemplar pelo Poder Judiciário.' + PAD,
  ec({tipo_justica:'CRIMINAL', assunto_principal:'Crime denúncia criminal acusado réu'}));
row('A9 CRIMINAL fund. dispara', true,  hasMissing(A9));

const A10 = validateCoverage(
  'A materialidade do crime está comprovada pelo laudo pericial e pelo boletim de ocorrência. A autoria delitiva é confirmada por testemunha e reconhecimento pessoal. A tipicidade preenche todos os elementos: dolo direto e elemento subjetivo do tipo penal.' + PAD,
  ec({tipo_justica:'CRIMINAL', assunto_principal:'Crime materialidade autoria tipicidade'}));
row('A10 CRIMINAL fund. nao dispara',false,hasMissing(A10));

// A11: condena sem qualquer elemento de dosimetria
const A11 = validateCoverage(
  'Pelo exposto, condeno o réu à pena privativa de liberdade pela prática do crime. A condenação penal do réu está fundamentada nas provas produzidas nos autos. O réu fica condenado nos termos da Lei Penal. A sentença condenatória é devidamente fundamentada nas provas e no direito aplicável ao caso em tela.' + PAD,
  ec({tipo_justica:'CRIMINAL', assunto_principal:'Condenação penal criminal sentença'}));
const a11d = A11.filter(e=>e.details?.topic==='dosimetria_da_pena');
row('A11 CRIMINAL dosim. dispara',true, a11d.length>0);

const A12 = validateCoverage(
  'Condeno o réu a quatro anos de reclusão. Na dosimetria, a pena-base foi fixada acima do mínimo pelas circunstâncias judiciais. Não há agravante aplicável. A atenuante reduz um sexto. O regime inicial semiaberto é adequado.' + PAD,
  ec({tipo_justica:'CRIMINAL', assunto_principal:'Condenação penal dosimetria pena regime'}));
const a12d = A12.filter(e=>e.details?.topic==='dosimetria_da_pena');
row('A12 CRIMINAL dosim. nao dispara',false,a12d.length>0);

// ── FAZENDA PÚBLICA (4) ───────────────────────────────────────────
// A13: concurso/nomeação sem direito subjetivo/vagas/preterição (não mencionar essas palavras)
const A13 = validateCoverage(
  'O candidato aprovado em concurso público pleiteia a nomeação ao cargo para o qual foi selecionado. O candidato aprovado aguarda a nomeação ao cargo público após aprovação no certame. A nomeação ao cargo é devida ao candidato aprovado no concurso público realizado pelo ente público. Pede-se a nomeação imediata ao cargo.' + PAD,
  ec({assunto_principal:'Concurso público nomeação candidato aprovado Fazenda Pública'}));
row('A13 FAZENDA concurso dispara',true,hasMissing(A13));

const A14 = validateCoverage(
  'O candidato aprovado dentro das vagas do edital tem direito subjetivo à nomeação. A preterição é evidente. A ordem de classificação demonstra o direito. O prazo de validade do concurso não expirou.' + PAD,
  ec({assunto_principal:'Concurso público direito subjetivo vagas edital preterição'}));
row('A14 FAZENDA concurso nao dispara',false,hasMissing(A14));

// A15: ato administrativo sem análise jurídica (não mencionar legalidade/motivação/vício)
const A15 = validateCoverage(
  'O requerente impugna ato administrativo praticado pela Administração Pública municipal. O ente público editou ato administrativo que prejudicou o requerente. A Fazenda Pública municipal é responsável pelo ato impugnado neste processo. O ato administrativo causou danos ao requerente e deve ser anulado pelo Poder Judiciário.' + PAD,
  ec({assunto_principal:'Ato administrativo Fazenda Pública administração pública municipal'}));
row('A15 FAZENDA ato dispara',   true,  hasMissing(A15));

const A16 = validateCoverage(
  'O requerente impugna ato administrativo por vício de legalidade. A motivação é insuficiente. A competência não estava demonstrada. O vício formal e o vício material tornam o ato nulo. A nulidade decorre do controle judicial do ato.' + PAD,
  ec({assunto_principal:'Ato administrativo legalidade motivação competência vício nulidade'}));
row('A16 FAZENDA ato nao dispara',false,hasMissing(A16));

// ═══════════════════════════════════════════════════════════════════
// BLOCO B — Regressão FASE 5.5.2 (validators materiais)
// ═══════════════════════════════════════════════════════════════════

const B1 = fv.validate('O autor não possui qualidade de segurado, nem cumpriu a carência exigida. Concedo o benefício previdenciário.', ec({regime_juridico:'RGPS'}), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
row('B1 RGPS nem cumpriu carência',        true,  hasRule(B1.errors,'RGPS_REQUIREMENTS_INCONSISTENCY'));

const B2 = fv.validate('Houve lançamento do crédito tributário. Prescrição para constituir o crédito. Art. 174 do CTN.', ec(), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
row('B2 TRIBUTARIO prescrição CTN',         true,  hasRule(B2.errors,'POSSIBLE_DECADENCE_PRESCRIPTION_CONFUSION'));

const B3 = fv.validate('Houve supressão de vegetação em APP. Não existe responsabilidade civil ambiental. A multa administrativa é suficiente.', ec(), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
row('B3 AMBIENTAL multa suficiente',        true,  hasRule(B3.errors,'ENVIRONMENTAL_LIABILITY_WARNING'));

const B4 = sv.validate('RELATÓRIO\nA genitora requer a guarda.\nFUNDAMENTAÇÃO\nO melhor interesse da criança aponta permanência com a mãe. A criança está adaptada com a genitora.\nAnte o exposto: Defiro a guarda unilateral ao pai.', ec({tipo_peca:'SENTENCA'}));
row('B4 FAMÍLIA contradição guarda',        true,  hasRule(B4.errors,'FAMILY_REASONING_DISPOSITIVE_CONTRADICTION'));

const B5 = fv.validate('O segurado possui qualidade de segurado e cumpriu a carência. Requer aposentadoria por invalidez.', ec({regime_juridico:'RGPS'}), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
row('B5 RGPS normal sem inconsistência',    false, hasRule(B5.errors,'RGPS_REQUIREMENTS_INCONSISTENCY'));

// ═══════════════════════════════════════════════════════════════════
// BLOCO C — Regressão FASE 5.6 (4 domínios originais coverage)
// ═══════════════════════════════════════════════════════════════════

const rgpsEsp = (d,c) => validateCoverage(d+PAD, ec({regime_juridico:'RGPS',...c}));
// C1: aposentadoria especial sem nenhuma palavra de cobertura
const C1 = rgpsEsp('O segurado pleiteia aposentadoria especial por tempo especial acumulado na atividade especial exercida por mais de vinte e cinco anos de labor. O enquadramento especial é devido conforme a legislação previdenciária aplicável ao período contributivo. Requer a concessão da aposentadoria especial definitiva.', {});
row('C1 RGPS especial sem cobertura dispara', true,  hasMissing(C1));

const C2 = rgpsEsp('Segurado exposto a ruído acima de 85dB de forma habitual e permanente. PPP e LTCAT comprovam.', {});
row('C2 RGPS especial com cobertura nao dispara',false, hasMissing(C2));

// C3: débito fiscal sem mencionar "lançamento"
const C3 = validateCoverage('A empresa impugna o débito fiscal inscrito na CDA e objeto de execução fiscal. O crédito tributário cobrado pela Fazenda é indevido. Requer a extinção da execução fiscal e o cancelamento do crédito tributário.'+PAD, ec({tipo_justica:'EXECUCAO_FISCAL',assunto_principal:'Débito fiscal CDA execução fiscal'}));
row('C3 TRIBUTARIO sem lançamento dispara',  true,  hasMissing(C3));

const C4 = validateCoverage('Lançamento tributário com vício formal. Constituição do crédito sem motivação. Nulidade do auto de infração.'+PAD, ec({tipo_justica:'EXECUCAO_FISCAL',assunto_principal:'Débito fiscal lançamento'}));
row('C4 TRIBUTARIO com lançamento nao dispara',false,hasMissing(C4));

// C5: guarda sem "melhor interesse" nem condições dos genitores
const C5 = validateCoverage('O requerente pleiteia a guarda unilateral do filho. A regulamentação da guarda compartilhada não é adequada ao caso. Pede-se a guarda definitiva do menor ao requerente com fixação de regime de visitas.'+PAD, ec({assunto_principal:'Guarda unilateral filho Família'}));
row('C5 FAMÍLIA guarda sem cobertura dispara',true,  hasMissing(C5));

const C6 = validateCoverage('Melhor interesse da criança. Vínculo afetivo com a mãe. Condições adequadas de vida. Ambiente familiar propício. Guarda unilateral.'+PAD, ec({assunto_principal:'Guarda criança Família'}));
row('C6 FAMÍLIA guarda com cobertura nao dispara',false,hasMissing(C6));

const C7 = validateCoverage('Restituição de valores e dano moral consumerista. Relação de consumo. Fornecedor. Sem falha do serviço.'+PAD, ec({assunto_principal:'Consumidor dano moral relação de consumo'}));
row('C7 CONSUMIDOR sem falha dispara',        true,  hasMissing(C7));

const C8 = validateCoverage('Falha na prestação do serviço defeituoso. Nexo causal entre o defeito e o dano sofrido. Abalo moral comprovado.'+PAD, ec({assunto_principal:'Consumidor falha serviço nexo causal'}));
row('C8 CONSUMIDOR com cobertura nao dispara',false, hasMissing(C8));

// ═══════════════════════════════════════════════════════════════════
// BLOCO D — Regressão FASE 5.6.1 (hardenings)
// ═══════════════════════════════════════════════════════════════════

// Skip texto curto
const D1 = validateCoverage('Crime de roubo. Réu. Denúncia criminal.', ec({tipo_justica:'CRIMINAL'}));
row('D1 texto curto skip',                  false, hasMissing(D1));

// Skip template com {{}}
const D2 = validateCoverage('{{NOME_AUTOR}} pleiteia aposentadoria especial.'+PAD, ec({regime_juridico:'RGPS'}));
row('D2 template marcador skip',            false, hasMissing(D2));

// Skip jurisprudência isolada
const D3 = validateCoverage('EMENTA: aposentadoria especial. STJ. TRF. Acórdão. Relator: Min. X. Julgado em 2024. DJe. TRT. TST. Precedente. Turma especializada.'.padEnd(900,'X'), ec({regime_juridico:'RGPS'}));
row('D3 jurisprudência isolada skip',       false, hasMissing(D3));

// D4: deduplicação — aposentadoria especial mencionada muitas vezes, max 1 alerta
const D4 = validateCoverage('O segurado pleiteia aposentadoria especial. A aposentadoria especial é devida pelo tempo especial. A atividade especial e o enquadramento especial justificam a aposentadoria especial. O tempo especial de vinte e seis anos demonstra o direito à aposentadoria especial definitiva.'+PAD, ec({regime_juridico:'RGPS'}));
const d4count = D4.filter(e=>e.rule==='MISSING_ESSENTIAL_TOPIC').length;
rows.push(['D4 deduplicação max 1 alerta', 'COUNT=1', 'COUNT='+d4count, d4count===1?'PASS':'FAIL']);

// D5: details auditável
const D5 = validateCoverage('O segurado pleiteia aposentadoria especial por tempo especial acumulado em atividade especial com enquadramento especial conforme o art. 57 da Lei 8.213/91. Requer a concessão da aposentadoria especial definitiva.'+PAD, ec({regime_juridico:'RGPS'}));
const d5 = D5.find(e=>e.rule==='MISSING_ESSENTIAL_TOPIC');
const d5ok = d5?.details?.topic && Array.isArray(d5?.details?.missing) && Array.isArray(d5?.details?.matchedTriggers) && Array.isArray(d5?.details?.checkedBlocks);
rows.push(['D5 details auditável (topic+missing+triggers+blocks)', 'COMPLETO', d5ok?'COMPLETO':'INCOMPLETO', d5ok?'PASS':'FAIL']);

// ═══════════════════════════════════════════════════════════════════
// BLOCO E — Templates incompletos continuam bloqueados
// ═══════════════════════════════════════════════════════════════════

const E1 = fv.validate('[ENDEREÇAMENTO]\n[QUALIFICAÇÃO]\n[INSERIR FATOS]\n[A DETERMINAR]\n[PREENCHER DADOS REAIS]', ec(), ex(), mx(), au(), [], 'FINAL_DRAFT', []);
row('E1 Template incompleto bloqueado',     true,  hasRule(E1.errors,'UNFILLED_TEMPLATE_PLACEHOLDERS'));

// ═══════════════════════════════════════════════════════════════════
// BLOCO F — Consumidor prevalece sobre JEC
// ═══════════════════════════════════════════════════════════════════
// Verifica que perfil CONSUMIDOR é selecionado quando assunto tem CDC em contexto JEC

const F1_assunto = 'Consumidor - produto defeituoso - relação de consumo - JEC';
const { validateCoverage: vc2 } = await import('/opt/judicore/packages/ai/dist/validators/coverage.validator.js');
const { DomainRichnessAnalyzer } = await import('/opt/judicore/packages/ai/dist/validators/domain-richness/domain-richness.analyzer.js');
const dra = new DomainRichnessAnalyzer();
const F1_class = ec({tipo_justica:'JEC', assunto_principal: F1_assunto});
const F1_profile = dra.analyze('texto consumidor fornecedor CDC', F1_class.tipo_justica, F1_class.regime_juridico, F1_class.assunto_principal, F1_class.tipo_peca).profile;
rows.push(['F1 CONSUMIDOR prevalece sobre JEC', 'CONSUMIDOR', F1_profile, F1_profile==='CONSUMIDOR'?'PASS':'FAIL']);

// ═══════════════════════════════════════════════════════════════════
// BLOCO G — Cível Geral sem coverage próprio
// ═══════════════════════════════════════════════════════════════════

const G1 = validateCoverage('Ação cível de indenização por danos materiais e morais. Relação civil comum. Autor pleiteia reparação civil geral.'+PAD, ec({assunto_principal:'Demanda Judicial'}));
row('G1 CIVEL_GERAL sem coverage',          false, hasMissing(G1));

// ═══════════════════════════════════════════════════════════════════
// BLOCO H — Score e classificação não afetados por MISSING_ESSENTIAL_TOPIC
// ═══════════════════════════════════════════════════════════════════

// Gera um relatório com MISSING_ESSENTIAL_TOPIC e verifica que viabilidade = 100 e classificação = VIAVEL
const h_draft = 'Aposentadoria especial por tempo especial sem exposição a agente nocivo.'+PAD;
const h_class = ec({regime_juridico:'RGPS'});
const h_vr = fv.validate(h_draft, h_class, ex(), mx(), au(), [], 'FINAL_DRAFT', []);
const h_report = eng.generate(h_draft, h_vr, h_class, ex(), mx(), au(), [], []);
const hasMissingInVr = hasRule(h_vr.errors, 'MISSING_ESSENTIAL_TOPIC');
const viabilidade100 = h_report.viabilidadeJuridica === 100;
const isViavel = h_report.classificacaoFinal === 'VIAVEL';
rows.push(['H1 MISSING_ESSENTIAL_TOPIC presente', 'true', hasMissingInVr?'true':'false', hasMissingInVr?'PASS':'FAIL']);
rows.push(['H2 viabilidadeJuridica = 100 (não afetada)', '100', String(h_report.viabilidadeJuridica), viabilidade100?'PASS':'FAIL']);
rows.push(['H3 classificacaoFinal = VIAVEL (não afetada)', 'VIAVEL', h_report.classificacaoFinal, isViavel?'PASS':'FAIL']);

// ═══════════════════════════════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════════════════════════════
const W = [50, 25, 25, 6];
const sep = '+'+W.map(w=>'-'.repeat(w+2)).join('+')+'+';
const fmt = (r) => '| '+r.map((c,i)=>String(c).padEnd(W[i])).join(' | ')+' |';

console.log(sep);
console.log(fmt(['TESTE','ESPERADO','ENCONTRADO','STATUS']));
console.log(sep);

const blocks = [
  ['─── BLOCO A: 16 testes FASE 5.6.2 ───────────────────────────────────'],
  ...rows.slice(0,16),
  ['─── BLOCO B: Regressão FASE 5.5.2 ───────────────────────────────────'],
  ...rows.slice(16,21),
  ['─── BLOCO C: Regressão FASE 5.6 (4 domínios originais) ─────────────'],
  ...rows.slice(21,29),
  ['─── BLOCO D: Regressão FASE 5.6.1 (hardenings) ─────────────────────'],
  ...rows.slice(29,34),
  ['─── BLOCO E: Templates incompletos ──────────────────────────────────'],
  ...rows.slice(34,35),
  ['─── BLOCO F: Consumidor > JEC ────────────────────────────────────────'],
  ...rows.slice(35,36),
  ['─── BLOCO G: Cível Geral sem coverage ───────────────────────────────'],
  ...rows.slice(36,37),
  ['─── BLOCO H: Score/classificação não afetados ───────────────────────'],
  ...rows.slice(37),
];

for (const item of blocks) {
  if (item.length===1) {
    console.log(sep);
    console.log('| '+item[0].padEnd(W.reduce((a,b)=>a+b,0)+W.length*3-2)+' |');
    console.log(sep);
  } else {
    console.log(fmt(item));
  }
}
console.log(sep);

const total = rows.length;
const passed = rows.filter(r=>r[3]==='PASS').length;
console.log(`\nRESULTADO FINAL: ${passed}/${total} PASS`);
if (passed===total) console.log('✓ Bateria completa aprovada.');
else console.log(`✗ ${total-passed} falha(s) detectada(s).`);

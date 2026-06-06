import type { DocumentElement } from "../gold-corpus-v2.types.js";
import { DocumentSection } from "../gold-corpus-v2.types.js";
import type { CaseSeedData } from "../gold-corpus-v2.types.js";
import type { TrabalhistaScenarioConfig } from "./trabalhista-scenario.types.js";

function h(s: string): number {
  let n = 2166136261;
  for (let i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619);
  return n >>> 0;
}

function dn(seed: CaseSeedData, salt: string, min: number, range: number): number {
  return min + (h(seed.cpf + salt) % range);
}

const GEN_DATE = "06 de junho de 2026";

function empresa(seed: CaseSeedData): string {
  const nomes = ["Alfa Indústria", "Beta Comércio", "Gama Serviços", "Delta Logística", "Ômega Construção"];
  const tipos = ["Ltda.", "S/A", "Eireli", "S.S."];
  return `${nomes[h(seed.cpf + "emp") % nomes.length]} ${tipos[h(seed.cpf + "ept") % tipos.length]}`;
}

function cnpj(seed: CaseSeedData): string {
  return `${String(dn(seed, "c1", 10, 89)).padStart(2, "0")}.${String(dn(seed, "c2", 100, 899)).padStart(3, "0")}.${String(dn(seed, "c3", 100, 899)).padStart(3, "0")}/0001-${String(dn(seed, "c4", 10, 89)).padStart(2, "0")}`;
}

function fmt(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

// ─── TRAB-001: HORAS_EXTRAS ────────────────────────────────────────────────────
function buildHorasExtras(seed: CaseSeedData): DocumentElement[] {
  const emp = empresa(seed);
  const cn = cnpj(seed);
  const cargo = ["operador de máquinas", "assistente de produção", "auxiliar administrativo", "técnico de manutenção"][h(seed.cpf + "cg") % 4];
  const extDia = dn(seed, "hed", 1, 2);
  const dias = dn(seed, "hdd", 200, 150);
  const totalH = extDia * dias;
  const salCents = dn(seed, "sc", 200000, 300000);
  const horaCents = Math.round(salCents / 220);
  const ext150 = Math.round(totalH * 0.8);
  const ext200 = totalH - ext150;
  const totalCents = ext150 * Math.round(horaCents * 1.5) + ext200 * Math.round(horaCents * 2);
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, vem propor\n\nRECLAMAÇÃO TRABALHISTA\n\nem face de ${emp}, CNPJ ${cn}\n\nProcesso n.º ${seed.processNumber} — Valor da causa: ${seed.causeValue}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, emp] },
    { id: "fatos_contrato", section: DocumentSection.DOS_FATOS, fullContent: `O reclamante foi admitido por ${emp} em ${seed.baseDate} para exercer a função de ${cargo}, com salário de ${fmt(salCents)} mensais e jornada contratual de 44 horas semanais (art. 7.º XIII CF/88; CLT art. 58). A relação perdurou até ${seed.derDate}.`, lightContent: `O reclamante trabalhou para a reclamada por período razoável, exercendo atividades sob sua direção. [datas e salário não especificados]`, omittedContent: `[datas de admissão/demissão e salário contratual não indicados]`, omissionDescription: "ausência de indicação de datas de admissão, demissão e salário contratual", correctPresenceKeywords: [seed.baseDate, seed.derDate, fmt(salCents)] },
    { id: "fatos_jornada", section: DocumentSection.DOS_FATOS, fullContent: `Não obstante a jornada contratual, o reclamante laborou habitualmente ${extDia}h extra(s) por dia ao longo de ${dias} dias, totalizando ${totalH} horas extras. As horas em dias úteis (${ext150}) fazem jus ao adicional de 50% e as prestadas em domingos/feriados (${ext200}) ao adicional de 100% (CLT art. 59 §1.º; CF/88 art. 7.º XVI). Valor apurado: ${fmt(totalCents)}.`, lightContent: `O reclamante laborou habitualmente além da jornada contratual. [quantificação não realizada]`, omittedContent: `[número de horas extras e valor total não quantificados na peça]`, omissionDescription: "ausência de quantificação das horas extras prestadas com cálculo do valor devido", correctPresenceKeywords: [String(totalH), String(dias), "CLT art. 59"] },
    { id: "provas_jornada", section: DocumentSection.DAS_PROVAS, fullContent: `Comprovam o alegado: (a) cartões de ponto de ${seed.baseDate} a ${seed.derDate} (CLT art. 74 §2.º); (b) contracheques sem pagamento de horas extras; (c) prova testemunhal de colegas.`, lightContent: `O reclamante produzirá prova documental e oral.`, omittedContent: `[meios de prova para demonstrar a jornada extraordinária não especificados]`, omissionDescription: "ausência de indicação dos meios de prova para demonstrar a jornada extraordinária", correctPresenceKeywords: ["cartões de ponto", "contracheques"] },
    { id: "pedidos_horas_extras", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer: (a) pagamento de ${totalH} horas extras no valor de ${fmt(totalCents)}, com adicional de 50%/100%; (b) reflexos em DSR, 13.º salário, férias+1/3, FGTS+40% e aviso prévio; (c) anotação da CTPS; (d) honorários advocatícios (CLT art. 791-A). Valor da causa: ${seed.causeValue}.`, lightContent: `Requer o pagamento das horas extras devidas com reflexos legais.`, omittedContent: `[pedido de horas extras sem quantificação e reflexos não especificados]`, omissionDescription: "pedido de horas extras sem quantificação do valor e dos reflexos nas demais verbas trabalhistas", correctPresenceKeywords: [fmt(totalCents), "FGTS", "reflexos"] },
  ];
}

// ─── TRAB-002: ADICIONAL_INSALUBRIDADE ────────────────────────────────────────
function buildAdicionalInsalubridade(seed: CaseSeedData): DocumentElement[] {
  const emp = empresa(seed);
  const cn = cnpj(seed);
  const agentes = ["ruído acima de 85 dB (NR-15, Anexo 1)", "agentes químicos — benzeno (NR-15, Anexo 13-A)", "calor (NR-15, Anexo 3)", "umidade excessiva (NR-15, Anexo 10)"];
  const agente = agentes[h(seed.cpf + "ag") % agentes.length];
  const grau = ["mínimo (10%)", "médio (20%)", "máximo (40%)"][h(seed.cpf + "gr") % 3];
  const pct = [10, 20, 40][h(seed.cpf + "gr") % 3];
  const smMensalCents = 141200;
  const addCents = Math.round(smMensalCents * pct / 100);
  const meses = dn(seed, "mes_ins", 12, 48);
  const totalCents = addCents * meses;
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, vem propor\n\nRECLAMAÇÃO TRABALHISTA\n\nem face de ${emp}, CNPJ ${cn}\n\nProcesso n.º ${seed.processNumber} — Valor da causa: ${seed.causeValue}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, emp] },
    { id: "fatos_exposicao", section: DocumentSection.DOS_FATOS, fullContent: `O reclamante labora desde ${seed.baseDate} exposto a ${agente}, sem equipamento de proteção individual eficaz, configurando insalubridade de grau ${grau} (CLT arts. 189-192). O adicional, calculado sobre o salário mínimo (Súm. 17 TST), equivale a ${fmt(addCents)} mensais; no período de ${meses} meses, totaliza ${fmt(totalCents)}.`, lightContent: `O reclamante laborou em condições insalubres sem o pagamento do respectivo adicional.`, omittedContent: `[agente nocivo, enquadramento na NR-15 e grau de insalubridade não identificados]`, omissionDescription: "ausência de identificação do agente nocivo, Anexo da NR-15 e grau de insalubridade", correctPresenceKeywords: [agente, grau, fmt(totalCents)] },
    { id: "laudo_insalubridade", section: DocumentSection.DOS_FATOS, fullContent: `Laudo pericial do Engenheiro de Segurança do Trabalho Crea n.º ${dn(seed, "crea", 100000, 899999)}, elaborado em ${seed.derDate}, confirma a exposição habitual e permanente do reclamante ao agente ${agente} em concentrações acima dos limites de tolerância da NR-15, classificando a atividade como insalubre de grau ${grau}.`, lightContent: `A insalubridade do local de trabalho é verificável mediante perícia técnica.`, omittedContent: `[laudo pericial ou indicação do agente nocivo e do Anexo da NR-15 ausentes na peça]`, omissionDescription: "ausência de laudo técnico ou identificação do agente nocivo com referência ao Anexo da NR-15 e ao grau de insalubridade", correctPresenceKeywords: [agente, "NR-15", "Crea"] },
    { id: "direito_insalubridade", section: DocumentSection.DO_DIREITO, fullContent: `CLT arts. 189-192 e a NR-15 do MTE garantem ao trabalhador exposto a agentes nocivos o adicional de insalubridade. A Súmula 448 do TST orienta que a substituição dos agentes nocivos exige efetiva eliminação do risco. A base de cálculo é o salário mínimo (Súm. 17 TST), representando ${fmt(addCents)}/mês.`, lightContent: `O adicional de insalubridade é garantido ao trabalhador exposto a agentes nocivos, nos termos da CLT.`, omittedContent: `[fundamento legal e base de cálculo do adicional de insalubridade não desenvolvidos]`, omissionDescription: "ausência de desenvolvimento do fundamento legal e da base de cálculo do adicional de insalubridade", correctPresenceKeywords: ["CLT art. 189", "Súmula 448", "NR-15"] },
    { id: "pedidos_insalubridade", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer: (a) adicional de insalubridade grau ${grau} sobre o salário mínimo, no montante de ${fmt(totalCents)} para o período de ${meses} meses; (b) reflexos; (c) fornecimento e uso efetivo de EPI adequado; (d) honorários.`, lightContent: `Requer o adicional de insalubridade com reflexos nas demais verbas.`, omittedContent: `[pedido de insalubridade sem especificação do grau e valor]`, omissionDescription: "pedido de adicional de insalubridade sem especificação do grau e valor monetário pretendido", correctPresenceKeywords: [fmt(totalCents), grau] },
  ];
}

// ─── TRAB-003: RESCISAO_INDIRETA ──────────────────────────────────────────────
function buildRescisaoIndireta(seed: CaseSeedData): DocumentElement[] {
  const emp = empresa(seed);
  const cn = cnpj(seed);
  const mesesAtraso = dn(seed, "mar", 3, 5);
  const salCents = dn(seed, "sc3", 180000, 250000);
  const devidoCents = salCents * mesesAtraso;
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, apresenta\n\nRECURSO ORDINÁRIO\n\nem face do acórdão proferido no processo n.º ${seed.processNumber} — ${emp}, CNPJ ${cn}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, emp] },
    { id: "decisao_recorrida_ri", section: DocumentSection.DOS_FATOS, fullContent: `O MM. Juízo a quo julgou improcedente o pedido de reconhecimento da rescisão indireta, entendendo que a mora salarial não configuraria falta grave do empregador (CLT art. 483 d). O recorrente insurgem contra tal decisão, pois o empregador reteve ${mesesAtraso} salários consecutivos, totalizando ${fmt(devidoCents)}, situação que configura inexoravelmente a hipótese do art. 483, d, da CLT.`, lightContent: `A decisão recorrida afastou indevidamente o reconhecimento da rescisão indireta por mora salarial.`, omittedContent: `[fatos e decisão recorrida não identificados com precisão]`, omissionDescription: "ausência de identificação precisa da decisão recorrida e dos fatos que fundamentam o recurso", correctPresenceKeywords: [String(mesesAtraso), fmt(devidoCents), "art. 483"] },
    { id: "fatos_rescisao_indireta", section: DocumentSection.DO_DIREITO, fullContent: `O recorrente comprova que o empregador deixou de pagar ${mesesAtraso} salários (${fmt(salCents)} mensais) entre ${seed.baseDate} e ${seed.derDate}, acumulando débito de ${fmt(devidoCents)}. A mora salarial por 3 ou mais meses configura falta grave do empregador (CLT art. 483 d), autorizando a ruptura indireta do contrato com todos os direitos da dispensa sem justa causa (CLT art. 487; STJ, Súm. 33 TRT).`, lightContent: `O empregador deixou de pagar salários por período prolongado, configurando rescisão indireta.`, omittedContent: `[fato grave imputado ao empregador e valor dos salários em atraso não identificados com precisão]`, omissionDescription: "ausência de identificação do fato grave que fundamenta a rescisão indireta com valores e período de mora salarial", correctPresenceKeywords: [String(mesesAtraso), fmt(devidoCents), "art. 483"] },
    { id: "notificacao_mora", section: DocumentSection.DOS_FATOS, fullContent: `Antes da rescisão, o recorrente notificou o empregador por escrito em ${seed.baseDate}, concedendo prazo de 48 horas para regularização dos salários em atraso, sem êxito. Tal notificação consta nos autos (fl. ${dn(seed, "fl", 10, 99)}).`, lightContent: `O recorrente comunicou ao empregador a mora salarial antes de rescindir o contrato.`, omittedContent: "", omissionDescription: "ausência de notificação prévia ao empregador demonstrando a mora antes da rescisão indireta", absentContent: null, correctPresenceKeywords: ["notificou", seed.baseDate] },
    { id: "pedido_recursal_ri", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer o provimento do recurso para: (a) reconhecer a rescisão indireta (CLT art. 483 d); (b) condenar a reclamada ao pagamento de aviso prévio, FGTS+40%, 13.º e férias proporcionais; (c) honorários advocatícios.`, lightContent: `Requer o reconhecimento da rescisão indireta com pagamento das verbas rescisórias.`, omittedContent: `[pedido recursal sem especificação das verbas rescisórias devidas]`, omissionDescription: "pedido recursal sem especificação das verbas rescisórias decorrentes do reconhecimento da rescisão indireta", correctPresenceKeywords: ["art. 483", "FGTS", "aviso prévio"] },
  ];
}

// ─── TRAB-004: DANO_MORAL_TRAB ────────────────────────────────────────────────
function buildDanoMoralTrab(seed: CaseSeedData): DocumentElement[] {
  const emp = empresa(seed);
  const cn = cnpj(seed);
  const condutas = ["constrangimentos públicos reiterados pelo superior hierárquico", "humilhações verbais em reunião de equipe", "exigência de metas abusivas sob ameaça de demissão", "exposição vexatória perante colegas de trabalho"];
  const conduta = condutas[h(seed.cpf + "cd") % condutas.length];
  const danoMoralCents = dn(seed, "dm", 500000, 2000000);
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, vem propor\n\nRECLAMAÇÃO TRABALHISTA\n\nem face de ${emp}, CNPJ ${cn}\n\nProcesso n.º ${seed.processNumber} — Valor da causa: ${seed.causeValue}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, emp] },
    { id: "fatos_conduta_patronal", section: DocumentSection.DOS_FATOS, fullContent: `Desde ${seed.baseDate}, o(a) autor(a) foi submetido(a) a ${conduta} pelo preposto da reclamada, Sr. ${["José", "Carlos", "Paulo", "André"][h(seed.cpf + "prep") % 4]} Rodrigues, de forma sistemática e reiterada. As condutas ocorreram em ${dn(seed, "ep", 5, 15)} episódios documentados entre ${seed.baseDate} e ${seed.derDate}.`, lightContent: `O(A) autor(a) foi submetido(a) a tratamento degradante pela reclamada no ambiente de trabalho.`, omittedContent: `[condutas patronais não identificadas com datas e episódios específicos]`, omissionDescription: "ausência de identificação específica das condutas patronais com datas e episódios documentados", correctPresenceKeywords: [seed.baseDate, seed.derDate, conduta.split(" ")[0]] },
    { id: "nexo_causal_dano", section: DocumentSection.DOS_FATOS, fullContent: `Em decorrência direta das condutas acima narradas, o(a) autor(a) desenvolveu síndrome ansiosa (CID F41.1), atestada pelo médico Dr. ${["Antônio", "Pedro", "Marcos", "Luiz"][h(seed.cpf + "med") % 4]} Silva (CRM ${dn(seed, "crm", 10000, 89999)}), que prescreveu afastamento de ${dn(seed, "afs", 15, 45)} dias. O nexo causal entre a conduta da empregadora e o dano psíquico sofrido é direto e inequívoco.`, lightContent: `O(A) autor(a) sofreu danos psicológicos em decorrência das condutas da reclamada.`, omittedContent: `[nexo causal entre a conduta patronal e o dano ao trabalhador não demonstrado com laudo ou documentação]`, omissionDescription: "ausência de demonstração do nexo causal entre a conduta patronal e o dano moral com laudo médico ou documentação específica", correctPresenceKeywords: ["CID F41.1", "nexo causal", "CRM"] },
    { id: "direito_dano_moral", section: DocumentSection.DO_DIREITO, fullContent: `A CF/88 (art. 5.º X) e o CC (arts. 186 e 927) asseguram indenização por dano moral. No âmbito trabalhista, a Lei 13.467/2017 introduziu os arts. 223-A a 223-G da CLT, que regem o dano moral nas relações de trabalho. O valor de ${fmt(danoMoralCents)} é proporcional à extensão do dano e à capacidade econômica da reclamada.`, lightContent: `A reclamada é responsável pelo dano moral sofrido pelo autor no ambiente de trabalho.`, omittedContent: `[fundamento legal e critérios de arbitramento do dano moral não desenvolvidos]`, omissionDescription: "ausência de desenvolvimento do fundamento legal da responsabilidade por dano moral trabalhista e dos critérios de arbitramento", correctPresenceKeywords: ["art. 223", "CLT", fmt(danoMoralCents)] },
    { id: "pedidos_dano_moral", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer: (a) indenização por danos morais no valor de ${fmt(danoMoralCents)} (CLT art. 223-G); (b) obrigação de fazer para cessação das condutas; (c) honorários advocatícios. Valor da causa: ${seed.causeValue}.`, lightContent: `Requer indenização por danos morais e cessação das condutas abusivas.`, omittedContent: `[pedido de dano moral sem valor especificado e critério de arbitramento]`, omissionDescription: "pedido de dano moral trabalhista sem valor especificado e critério de arbitramento indicado", correctPresenceKeywords: [fmt(danoMoralCents), "art. 223-G"] },
  ];
}

// ─── TRAB-005: FGTS_MULTA_40 ──────────────────────────────────────────────────
function buildFgtsMulta40(seed: CaseSeedData): DocumentElement[] {
  const emp = empresa(seed);
  const cn = cnpj(seed);
  const saldoFgtsCents = dn(seed, "sfg", 800000, 3200000);
  const multa40Cents = Math.round(saldoFgtsCents * 0.4);
  const meses = dn(seed, "mfg", 36, 48);
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, apresenta\n\nRECURSO ORDINÁRIO\n\nem face do acórdão proferido no processo n.º ${seed.processNumber} — ${emp}, CNPJ ${cn}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, emp] },
    { id: "decisao_recorrida_fgts", section: DocumentSection.DOS_FATOS, fullContent: `A sentença recorrida calculou a multa de 40% do FGTS (Lei 8.036/1990 art. 18 §1.º) sobre saldo de ${fmt(saldoFgtsCents)}, chegando a ${fmt(multa40Cents)}. O recorrente insurge-se contra a base de cálculo utilizada, que não considerou os depósitos em atraso de ${meses} meses, reduzindo artificialmente o saldo base.`, lightContent: `A sentença fixou incorretamente a multa de 40% do FGTS sobre base de cálculo menor que a devida.`, omittedContent: `[base de cálculo da multa de 40% e critérios de apuração não identificados]`, omissionDescription: "ausência de identificação precisa da base de cálculo da multa de 40% do FGTS e dos depósitos em atraso", correctPresenceKeywords: [fmt(saldoFgtsCents), fmt(multa40Cents), "Lei 8.036"] },
    { id: "fatos_multa_fgts", section: DocumentSection.DO_DIREITO, fullContent: `A multa rescisória de 40% do FGTS (Lei 8.036/1990 art. 18 §1.º; CLT art. 477 §8.º; ADCT art. 10 II b) deve incidir sobre todos os depósitos devidos no período contratual — não apenas sobre os efetuados. O reclamante trabalhou ${meses} meses; a reclamada recolheu apenas parcialmente o FGTS, como comprovam os extratos da conta vinculada. O saldo real, com depósitos em atraso, supera ${fmt(saldoFgtsCents)}.`, lightContent: `A multa de 40% do FGTS deve incidir sobre todos os depósitos devidos, incluindo os em atraso.`, omittedContent: `[demonstração dos depósitos em atraso e cálculo correto do saldo base para a multa não apresentados]`, omissionDescription: "ausência de demonstração dos depósitos de FGTS em atraso e do cálculo correto da base para a multa de 40%", correctPresenceKeywords: [String(meses), "art. 18", "Lei 8.036"] },
    { id: "provas_fgts", section: DocumentSection.DAS_PROVAS, fullContent: `Comprovam: (a) extrato da conta vinculada FGTS de ${seed.baseDate} a ${seed.derDate}; (b) CTPS com registros de admissão e demissão; (c) recibo de rescisão.`, lightContent: `O recorrente produzirá prova documental sobre os depósitos de FGTS.`, omittedContent: `[extratos da conta vinculada do FGTS não juntados ao recurso]`, omissionDescription: "ausência de extratos da conta vinculada do FGTS demonstrando os depósitos em atraso", correctPresenceKeywords: ["extrato", "FGTS", seed.baseDate] },
    { id: "pedido_recursal_fgts", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer o provimento do recurso para recalcular a multa de 40% sobre o saldo real de ${fmt(saldoFgtsCents)}, totalizando ${fmt(multa40Cents)}, com diferença a ser apurada em liquidação de sentença. Honorários recursais (CLT art. 791-A §3.º).`, lightContent: `Requer o recálculo da multa de 40% do FGTS sobre a base correta.`, omittedContent: `[pedido de recálculo sem indicação do saldo correto e da diferença devida]`, omissionDescription: "pedido recursal de multa de 40% sem indicação do saldo base correto e da diferença devida", correctPresenceKeywords: [fmt(multa40Cents), fmt(saldoFgtsCents)] },
  ];
}

// ─── TRAB-006: RECONHECIMENTO_VINCULO ─────────────────────────────────────────
function buildReconhecimentoVinculo(seed: CaseSeedData): DocumentElement[] {
  const emp = empresa(seed);
  const cn = cnpj(seed);
  const servicoCents = dn(seed, "svc", 150000, 200000);
  const meses = dn(seed, "mvnc", 18, 42);
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, vem propor\n\nRECLAMAÇÃO TRABALHISTA\n\nem face de ${emp}, CNPJ ${cn}\n\nProcesso n.º ${seed.processNumber} — Valor da causa: ${seed.causeValue}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, emp] },
    { id: "fatos_prestacao", section: DocumentSection.DOS_FATOS, fullContent: `Desde ${seed.baseDate}, o(a) reclamante prestou serviços para ${emp} de forma pessoal, habitual e onerosa, recebendo ${fmt(servicoCents)} mensais via nota fiscal de autônomo. A relação durou ${meses} meses, findo em ${seed.derDate}. A reclamada mascarou o vínculo empregatício sob a forma de pessoa jurídica/contrato de prestação de serviços (CLT art. 9.º — fraude).`, lightContent: `O reclamante prestou serviços à reclamada de forma reiterada, recebendo contraprestação mensal.`, omittedContent: `[natureza da prestação de serviços e indícios do vínculo empregatício não identificados]`, omissionDescription: "ausência de identificação da natureza da prestação de serviços e dos indícios caracterizadores do vínculo empregatício", correctPresenceKeywords: [seed.baseDate, seed.derDate, fmt(servicoCents)] },
    { id: "subordinacao_juridica", section: DocumentSection.DOS_FATOS, fullContent: `A subordinação jurídica restou evidente pelos seguintes fatos: (a) o reclamante recebia ordens diretas do gerente ${["Roberto", "Marcos", "Felipe", "André"][h(seed.cpf + "ger") % 4]} Alves; (b) cumpria horário fixo de segunda a sexta (08h às 18h); (c) usava uniforme e crachá da reclamada; (d) utilizava equipamentos e estrutura do empregador; (e) atendia exclusivamente a ${emp}, sem outros clientes (CLT art. 3.º; Súm. 212 TST).`, lightContent: `O reclamante trabalhava sob direção da reclamada, configurando subordinação.`, omittedContent: `[subordinação jurídica não demonstrada — relação pode ser interpretada como autônoma]`, omissionDescription: "ausência de demonstração da subordinação jurídica com fatos concretos que diferenciem a relação de emprego da prestação autônoma de serviços", correctPresenceKeywords: ["subordinação", "horário fixo", "CLT art. 3.º"] },
    { id: "pessoalidade_habitualidade", section: DocumentSection.DOS_FATOS, fullContent: `A pessoalidade é demonstrada pela prestação exclusiva e intransferível pelo próprio reclamante, sem possibilidade de substituição. A habitualidade decorre da frequência diária durante ${meses} meses. Presentes os quatro elementos do art. 3.º da CLT (pessoalidade, onerosidade, subordinação e não eventualidade), impõe-se o reconhecimento do vínculo (Súm. 212 TST).`, lightContent: `A habitualidade e pessoalidade dos serviços confirmam o vínculo empregatício.`, omittedContent: `[demonstração dos elementos da pessoalidade e habitualidade na prestação de serviços não realizada]`, omissionDescription: "ausência de demonstração da pessoalidade e habitualidade como elementos caracterizadores do vínculo empregatício", correctPresenceKeywords: ["pessoalidade", String(meses), "art. 3.º"] },
    { id: "pedidos_vinculo", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer: (a) reconhecimento do vínculo empregatício (CLT arts. 2.º e 3.º) de ${seed.baseDate} a ${seed.derDate}; (b) anotação da CTPS; (c) recolhimento do FGTS de ${meses} meses + multa de 40%; (d) 13.º salários e férias+1/3 do período; (e) aviso prévio; (f) honorários.`, lightContent: `Requer o reconhecimento do vínculo empregatício com pagamento de todas as verbas devidas.`, omittedContent: `[pedido de reconhecimento de vínculo sem especificação das verbas e do período]`, omissionDescription: "pedido de reconhecimento de vínculo empregatício sem especificação das verbas devidas e do período da relação", correctPresenceKeywords: [seed.baseDate, seed.derDate, "FGTS"] },
  ];
}

// ─── TRAB-007: ASSEDIO_MORAL_TRAB ─────────────────────────────────────────────
function buildAssedioMoralTrab(seed: CaseSeedData): DocumentElement[] {
  const emp = empresa(seed);
  const cn = cnpj(seed);
  const danoMoralCents = dn(seed, "dm7", 300000, 1500000);
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, vem propor\n\nRECLAMAÇÃO TRABALHISTA\n\nem face de ${emp}, CNPJ ${cn}\n\nProcesso n.º ${seed.processNumber} — Valor da causa: ${seed.causeValue}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, emp] },
    { id: "fatos_assedio", section: DocumentSection.DOS_FATOS, fullContent: `Desde ${seed.baseDate}, o superior hierárquico do(a) reclamante submeteu-o(a) a tratamento vexatório e degradante: críticas depreciativas em público, isolamento funcional, sobrecarga desproporcional de tarefas e ameaças veladas de demissão. A conduta, sistemática e reiterada, configura assédio moral (CF/88 art. 5.º X; CLT art. 223-B; Lei 14.457/2022).`, lightContent: `O(A) autor(a) foi vítima de assédio moral no ambiente de trabalho da reclamada.`, omittedContent: `[episódios específicos de assédio moral não narrados com datas e descrições concretas]`, omissionDescription: "ausência de narração de episódios específicos de assédio moral com datas e descrições concretas das condutas", correctPresenceKeywords: [seed.baseDate, "assédio moral", "CLT art. 223-B"] },
    { id: "provas_assedio", section: DocumentSection.DAS_PROVAS, fullContent: `Comprovam o alegado: (a) capturas de tela de mensagens do grupo de WhatsApp da equipe com ordens humilhantes; (b) e-mails corporativos com cobranças vexatórias; (c) atestado médico de síndrome ansiosa; (d) depoimento de ${dn(seed, "test", 2, 4)} testemunhas que presenciaram os episódios; (e) boletim de ocorrência n.º ${dn(seed, "bo", 100000, 899999)}.`, lightContent: `O(A) autor(a) produzirá prova documental e testemunhal sobre o assédio sofrido.`, omittedContent: `[provas do assédio moral não especificadas na petição inicial]`, omissionDescription: "ausência de especificação dos meios de prova do assédio moral (mensagens, e-mails, testemunhas, laudos)", correctPresenceKeywords: ["WhatsApp", "e-mails", "testemunhas"] },
    { id: "direito_assedio", section: DocumentSection.DO_DIREITO, fullContent: `O assédio moral trabalhista viola a dignidade da pessoa humana (CF/88 art. 1.º III) e o direito à honra e à imagem (CF/88 art. 5.º X). A CLT, nos arts. 223-A a 223-G (Lei 13.467/2017), regula a reparação por dano moral no trabalho. A indenização de ${fmt(danoMoralCents)} é proporcional à extensão do dano e ao porte da empresa.`, lightContent: `O assédio moral no ambiente de trabalho gera dever de indenizar nos termos da CLT.`, omittedContent: `[fundamento legal do assédio moral e critérios de arbitramento da indenização não desenvolvidos]`, omissionDescription: "ausência de desenvolvimento do fundamento legal do assédio moral e dos critérios de arbitramento da indenização", correctPresenceKeywords: ["art. 223", "dignidade", fmt(danoMoralCents)] },
    { id: "pedidos_assedio", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer: (a) indenização por danos morais decorrentes do assédio moral no valor de ${fmt(danoMoralCents)} (CLT art. 223-G); (b) danos materiais comprovados; (c) honorários advocatícios. Valor da causa: ${seed.causeValue}.`, lightContent: `Requer indenização pelo assédio moral sofrido no ambiente de trabalho.`, omittedContent: `[pedido de indenização por assédio moral sem valor especificado]`, omissionDescription: "pedido de indenização por assédio moral sem indicação do valor pretendido e dos critérios de arbitramento", correctPresenceKeywords: [fmt(danoMoralCents), "art. 223-G"] },
  ];
}

// ─── TRAB-008: DEPOSITOS_FGTS_EXEC ────────────────────────────────────────────
function buildDepositosFgtsExec(seed: CaseSeedData): DocumentElement[] {
  const emp = empresa(seed);
  const cn = cnpj(seed);
  const salCents = dn(seed, "sc8", 180000, 280000);
  const meses = dn(seed, "mes8", 24, 48);
  const fgts8pctCents = Math.round(salCents * 0.08);
  const totalFgtsCents = fgts8pctCents * meses;
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, apresenta\n\nCUMPRIMENTO DE SENTENÇA\n\nem face de ${emp}, CNPJ ${cn}\n\nProcesso n.º ${seed.processNumber}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, emp] },
    { id: "titulo_executivo", section: DocumentSection.DOS_FATOS, fullContent: `A sentença transitada em julgado em ${seed.baseDate} reconheceu o vínculo empregatício de ${meses} meses e condenou ${emp} ao recolhimento dos depósitos de FGTS de todo o período, à razão de 8% sobre o salário mensal de ${fmt(salCents)}.`, lightContent: `A sentença transitada em julgado reconheceu o vínculo e determinou o recolhimento do FGTS.`, omittedContent: `[título executivo e sentença não identificados com precisão]`, omissionDescription: "ausência de identificação precisa do título executivo e da sentença que determinou o recolhimento do FGTS", correctPresenceKeywords: [seed.baseDate, fmt(salCents), String(meses)] },
    { id: "parametros_julgado", section: DocumentSection.DO_DIREITO, fullContent: `Nos termos da sentença, o FGTS é calculado à razão de 8% (Lei 8.036/1990 art. 15) sobre o salário de ${fmt(salCents)}/mês × ${meses} meses, com correção pelo TRCT/FGTS. Período: ${seed.baseDate} a ${seed.derDate}.`, lightContent: `O FGTS é calculado conforme os parâmetros da sentença.`, omittedContent: `[parâmetros do julgado — percentual, salário base e período — não identificados]`, omissionDescription: "ausência de identificação dos parâmetros do julgado para cálculo do FGTS (percentual, salário base e período)", correctPresenceKeywords: ["8%", fmt(salCents), "Lei 8.036"] },
    { id: "memoria_calculo_fgts", section: DocumentSection.DAS_PROVAS, fullContent: `Memória de cálculo: ${meses} meses × ${fmt(fgts8pctCents)} (8% de ${fmt(salCents)}) = ${fmt(totalFgtsCents)} (principal), acrescido de correção pelo TRCT e juros de mora de 0,5%/mês (Lei 8.036/1990 art. 13). Total atualizado: ${fmt(Math.round(totalFgtsCents * 1.12))}.`, lightContent: `O valor dos depósitos de FGTS será apurado em liquidação.`, omittedContent: `[memória de cálculo dos depósitos de FGTS com base no salário, percentual e meses não apresentada]`, omissionDescription: "ausência de memória de cálculo dos depósitos de FGTS com detalhamento do salário base, percentual e número de meses", correctPresenceKeywords: [fmt(totalFgtsCents), String(meses), "8%"] },
    { id: "pedidos_execucao", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer: (a) citação de ${emp} para recolher ${fmt(Math.round(totalFgtsCents * 1.12))} à conta vinculada do FGTS do reclamante no prazo de 15 dias (CPC art. 523); (b) penhora e expropriação em caso de inadimplemento; (c) honorários executivos de 10%.`, lightContent: `Requer a intimação da executada para recolher o FGTS apurado em liquidação.`, omittedContent: `[pedido executivo sem valor e prazo especificados]`, omissionDescription: "pedido executivo de FGTS sem indicação do valor total atualizado e do prazo para cumprimento", correctPresenceKeywords: [fmt(Math.round(totalFgtsCents * 1.12)), "CPC art. 523"] },
  ];
}

// ─── TRAB-009: AVISO_PREVIO_PROP ──────────────────────────────────────────────
function buildAvisoPrevioProp(seed: CaseSeedData): DocumentElement[] {
  const emp = empresa(seed);
  const cn = cnpj(seed);
  const anosServico = dn(seed, "anos9", 3, 17);
  const diasProporcional = 30 + 3 * (anosServico - 1);
  const salCents = dn(seed, "sc9", 200000, 350000);
  const avisoCents = Math.round(salCents * diasProporcional / 30);
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, apresenta\n\nRECURSO ORDINÁRIO\n\nem face do acórdão proferido no processo n.º ${seed.processNumber} — ${emp}, CNPJ ${cn}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, emp] },
    { id: "decisao_recorrida_ap", section: DocumentSection.DOS_FATOS, fullContent: `A sentença recorrida reconheceu apenas 30 dias de aviso prévio, ignorando a proporcionalidade prevista na Lei 12.506/2011. O reclamante possuía ${anosServico} anos de serviço, fazendo jus a ${diasProporcional} dias de aviso prévio (30 + 3 dias por ano acima de um).`, lightContent: `A sentença fixou aviso prévio de 30 dias, sem aplicar a proporcionalidade legal.`, omittedContent: `[tempo de serviço e cálculo do aviso prévio proporcional não identificados na decisão]`, omissionDescription: "ausência de identificação do tempo de serviço e do cálculo correto do aviso prévio proporcional", correctPresenceKeywords: [String(anosServico), String(diasProporcional), "Lei 12.506"] },
    { id: "calculo_aviso_proporcional", section: DocumentSection.DO_DIREITO, fullContent: `A Lei 12.506/2011 estabelece aviso prévio proporcional: 30 dias base + 3 dias por ano trabalhado acima de 1 ano. Com ${anosServico} anos de serviço: 30 + 3 × ${anosServico - 1} = ${diasProporcional} dias. Sobre o salário de ${fmt(salCents)}, o aviso prévio proporcional vale ${fmt(avisoCents)}. A sentença pagou apenas ${fmt(Math.round(salCents))} (30 dias), gerando diferença de ${fmt(avisoCents - Math.round(salCents))}.`, lightContent: `O aviso prévio proporcional deve ser calculado conforme a Lei 12.506/2011 com base no tempo de serviço.`, omittedContent: `[cálculo do aviso prévio proporcional com base no tempo de serviço e na Lei 12.506/2011 não realizado]`, omissionDescription: "ausência de cálculo do aviso prévio proporcional com base no tempo de serviço e na Lei 12.506/2011", correctPresenceKeywords: [String(diasProporcional), fmt(avisoCents), "Lei 12.506"] },
    { id: "pedido_recursal_ap", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer o provimento do recurso para condenar a reclamada ao pagamento de ${diasProporcional} dias de aviso prévio proporcional, no valor de ${fmt(avisoCents)}, com reflexos em FGTS+40%, 13.º e férias.`, lightContent: `Requer o reconhecimento do aviso prévio proporcional nos termos da Lei 12.506/2011.`, omittedContent: `[pedido de aviso prévio proporcional sem valor especificado]`, omissionDescription: "pedido de aviso prévio proporcional sem indicação do número de dias e valor calculado", correctPresenceKeywords: [String(diasProporcional), fmt(avisoCents)] },
  ];
}

// ─── TRAB-010: ADICIONAL_PERICULOSIDADE ───────────────────────────────────────
function buildAdicionalPericulosidade(seed: CaseSeedData): DocumentElement[] {
  const emp = empresa(seed);
  const cn = cnpj(seed);
  const atividadesPerigosas = ["manuseio de explosivos (NR-16, Anexo 1)", "trabalho com inflamáveis acima do limite (NR-16, Anexo 2)", "atividades com energia elétrica em alta tensão (NR-16, Anexo 3)", "trabalho em motocicleta para entrega (NR-16, Anexo 5)"];
  const atividade = atividadesPerigosas[h(seed.cpf + "ap") % atividadesPerigosas.length];
  const salCents = dn(seed, "sc10", 200000, 400000);
  const addPericCents = Math.round(salCents * 0.3);
  const meses = dn(seed, "mes10", 12, 48);
  const totalCents = addPericCents * meses;
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, vem propor\n\nRECLAMAÇÃO TRABALHISTA\n\nem face de ${emp}, CNPJ ${cn}\n\nProcesso n.º ${seed.processNumber} — Valor da causa: ${seed.causeValue}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, emp] },
    { id: "fatos_atividade_perigosa", section: DocumentSection.DOS_FATOS, fullContent: `Desde ${seed.baseDate}, o(a) reclamante exerce atividade de ${atividade}, enquadrada como perigosa pela CLT arts. 193-196 e NR-16 do MTE. O adicional de periculosidade equivale a 30% do salário base (CLT art. 193 §1.º; Súm. 191 TST): ${fmt(addPericCents)}/mês. No período de ${meses} meses, o total devido é ${fmt(totalCents)}.`, lightContent: `O(A) reclamante exerce atividade perigosa sem o pagamento do respectivo adicional de periculosidade.`, omittedContent: `[atividade perigosa não identificada e enquadramento na NR-16 não realizado]`, omissionDescription: "ausência de identificação da atividade perigosa com enquadramento no Anexo específico da NR-16", correctPresenceKeywords: [atividade, "NR-16", fmt(totalCents)] },
    { id: "laudo_periculosidade", section: DocumentSection.DOS_FATOS, fullContent: `Laudo pericial elaborado pelo Eng. de Segurança Crea n.º ${dn(seed, "crea10", 50000, 499999)}, datado de ${seed.derDate}, confirma que o(a) reclamante exerce ${atividade} em condições de risco elevado de forma habitual e permanente, conforme enquadramento na NR-16.`, lightContent: `A periculosidade da atividade será confirmada por perícia técnica.`, omittedContent: `[laudo pericial de periculosidade não mencionado ou atividade perigosa não identificada com Anexo da NR-16]`, omissionDescription: "ausência de laudo pericial ou de identificação da atividade perigosa com referência ao Anexo específico da NR-16", correctPresenceKeywords: [atividade, "NR-16", "Crea"] },
    { id: "direito_periculosidade", section: DocumentSection.DO_DIREITO, fullContent: `A CLT, arts. 193-196, garante adicional de periculosidade de 30% sobre o salário base ao trabalhador que atua em condições perigosas. A Súmula 191 do TST consolida o adicional de 30% para as atividades listadas na NR-16. O valor do adicional é ${fmt(addPericCents)}/mês, totalizando ${fmt(totalCents)} em ${meses} meses.`, lightContent: `O adicional de periculosidade de 30% é garantido ao trabalhador em condições perigosas.`, omittedContent: `[fundamento legal do adicional de periculosidade e base de cálculo não desenvolvidos]`, omissionDescription: "ausência de desenvolvimento do fundamento legal do adicional de periculosidade e da base de cálculo com valor apurado", correctPresenceKeywords: ["30%", "Súmula 191", fmt(totalCents)] },
    { id: "pedidos_periculosidade", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer: (a) adicional de periculosidade de 30% sobre o salário base (${fmt(addPericCents)}/mês) por ${meses} meses, totalizando ${fmt(totalCents)}; (b) reflexos; (c) fornecimento de EPI; (d) honorários. Valor da causa: ${seed.causeValue}.`, lightContent: `Requer o adicional de periculosidade com reflexos nas demais verbas trabalhistas.`, omittedContent: `[pedido de adicional de periculosidade sem valor e base de cálculo especificados]`, omissionDescription: "pedido de adicional de periculosidade sem indicação do percentual, base de cálculo e valor total pretendido", correctPresenceKeywords: ["30%", fmt(totalCents), String(meses)] },
  ];
}

// ─── TRAB-011: EQUIPARACAO_SALARIAL ───────────────────────────────────────────
function buildEquiparacaoSalarial(seed: CaseSeedData): DocumentElement[] {
  const emp = empresa(seed);
  const cn = cnpj(seed);
  const funcao = ["analista de sistemas", "técnico de enfermagem", "assistente jurídico", "analista financeiro"][h(seed.cpf + "func11") % 4];
  const paradigmaName = ["Carlos Mendes", "Ana Ferreira", "Roberto Lima", "Patrícia Santos"][h(seed.cpf + "par") % 4];
  const salReclamanteCents = dn(seed, "sr11", 250000, 400000);
  const salParadigmaCents = salReclamanteCents + dn(seed, "sp11", 50000, 200000);
  const difCents = salParadigmaCents - salReclamanteCents;
  const meses = dn(seed, "mes11", 12, 36);
  const totalDifCents = difCents * meses;
  const anosReclamante = dn(seed, "ar11", 2, 8);
  const anosParadigma = anosReclamante + dn(seed, "diff11", 0, 2);
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, vem propor\n\nRECLAMAÇÃO TRABALHISTA\n\nem face de ${emp}, CNPJ ${cn}\n\nProcesso n.º ${seed.processNumber} — Valor da causa: ${seed.causeValue}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, emp] },
    { id: "fatos_identidade_funcional", section: DocumentSection.DOS_FATOS, fullContent: `O(A) reclamante exerce a função de ${funcao} para ${emp} desde ${seed.baseDate}, recebendo ${fmt(salReclamanteCents)} mensais. O paradigma ${paradigmaName}, admitido em ${seed.derDate.slice(3)}, exerce a mesma função de ${funcao} no mesmo estabelecimento em ${seed.city}, recebendo ${fmt(salParadigmaCents)} mensais — diferença de ${fmt(difCents)}/mês sem justificativa (CLT art. 461 §1.º).`, lightContent: `O(A) reclamante exerce função idêntica à do paradigma, mas recebe salário inferior.`, omittedContent: `[identidade funcional, salários do reclamante e do paradigma não especificados]`, omissionDescription: "ausência de identificação dos salários do reclamante e do paradigma com demonstração da identidade funcional", correctPresenceKeywords: [fmt(salReclamanteCents), fmt(salParadigmaCents), paradigmaName] },
    { id: "fatos_modelo_paradigma", section: DocumentSection.DOS_FATOS, fullContent: `Requisitos da equiparação salarial (CLT art. 461): (a) mesma função: ${funcao} ✓; (b) mesmo empregador: ${emp} ✓; (c) mesmo estabelecimento: ${seed.city} ✓; (d) diferença de tempo na função ≤ 2 anos: reclamante ${anosReclamante} anos, paradigma ${anosParadigma} anos — diferença de ${anosParadigma - anosReclamante} anos ✓; (e) simultaneidade de serviço ✓. Ausente qualquer causa excludente (CLT art. 461 §3.º).`, lightContent: `Os requisitos legais para a equiparação salarial estão presentes no caso concreto.`, omittedContent: `[requisitos da equiparação salarial não demonstrados de forma individualizada]`, omissionDescription: "ausência de demonstração individualizada de cada requisito legal da equiparação salarial (art. 461 CLT)", correctPresenceKeywords: [funcao, paradigmaName, "art. 461"] },
    { id: "calculo_diferenca_salarial", section: DocumentSection.DOS_FATOS, fullContent: `A diferença salarial mensal é de ${fmt(difCents)} (${fmt(salParadigmaCents)} − ${fmt(salReclamanteCents)}). No período de ${meses} meses (${seed.baseDate} a ${seed.derDate}), o total de diferenças devidas é ${fmt(totalDifCents)}, acrescido de reflexos em DSR, 13.º, férias+1/3, FGTS+40%.`, lightContent: `A diferença salarial será apurada em liquidação de sentença.`, omittedContent: `[cálculo da diferença salarial mensal e total do período não realizado]`, omissionDescription: "ausência de cálculo da diferença salarial mensal com apuração do total do período", correctPresenceKeywords: [fmt(difCents), fmt(totalDifCents), String(meses)] },
    { id: "pedidos_equiparacao", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer: (a) equiparação salarial ao paradigma ${paradigmaName} (CLT art. 461), com diferenças de ${fmt(difCents)}/mês por ${meses} meses, totalizando ${fmt(totalDifCents)}; (b) reflexos em DSR, 13.º, férias+1/3, FGTS+40%; (c) anotação da CTPS; (d) honorários. Valor da causa: ${seed.causeValue}.`, lightContent: `Requer a equiparação salarial ao paradigma com pagamento das diferenças e reflexos.`, omittedContent: `[pedido de equiparação sem identificação do paradigma, valor das diferenças e período]`, omissionDescription: "pedido de equiparação salarial sem identificação do paradigma, valor das diferenças mensais e período reclamado", correctPresenceKeywords: [paradigmaName, fmt(totalDifCents), "art. 461"] },
  ];
}

// ─── TRAB-012: INTERVALO_INTRAJORNADA ─────────────────────────────────────────
function buildIntervaloIntrajornada(seed: CaseSeedData): DocumentElement[] {
  const emp = empresa(seed);
  const cn = cnpj(seed);
  const minutosInterval = dn(seed, "mi12", 15, 30);
  const diasPorSemana = dn(seed, "ds12", 4, 2);
  const semanas = dn(seed, "sem12", 40, 80);
  const totalDias = diasPorSemana * semanas;
  const salCents = dn(seed, "sc12", 180000, 300000);
  const horaCents = Math.round(salCents / 220);
  const horaAdic = Math.round(minutosInterval / 60 * 100) / 100;
  const totalCents = Math.round(totalDias * horaCents * horaAdic * 1.5);
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, apresenta\n\nRECURSO ORDINÁRIO\n\nem face do acórdão proferido no processo n.º ${seed.processNumber} — ${emp}, CNPJ ${cn}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, emp] },
    { id: "decisao_recorrida_ii", section: DocumentSection.DOS_FATOS, fullContent: `A sentença recorrida julgou improcedente o pedido de horas extras por supressão do intervalo intrajornada, sob o argumento de que a reclamada comprovou a concessão integral do intervalo de 1 hora. O recorrente comprova que os cartões de ponto registravam intervalos de apenas ${minutosInterval} minutos, em ${totalDias} dias, configurando supressão parcial (CLT art. 71; Súm. 437 TST).`, lightContent: `A sentença recorrida afastou o pedido de horas extras por supressão do intervalo intrajornada.`, omittedContent: `[identificação da decisão recorrida e do período de supressão do intervalo não realizados]`, omissionDescription: "ausência de identificação precisa da decisão recorrida e do período de supressão do intervalo intrajornada", correctPresenceKeywords: [String(minutosInterval), String(totalDias), "Súm. 437"] },
    { id: "razoes_recurso_ii", section: DocumentSection.DO_DIREITO, fullContent: `A CLT, art. 71, garante intervalo de no mínimo 1 hora para jornada superior a 6 horas. A Súmula 437 do TST determina que a supressão, ainda que parcial, do intervalo intrajornada importa no pagamento integral do período correspondente acrescido de 50% (equivalente a extra). O intervalo suprimido (${60 - minutosInterval} minutos/dia) em ${totalDias} dias gera crédito de ${fmt(totalCents)}.`, lightContent: `A supressão do intervalo intrajornada gera pagamento de extra com adicional de 50%.`, omittedContent: `[fundamento jurídico e cálculo do valor da supressão do intervalo não desenvolvidos]`, omissionDescription: "ausência de desenvolvimento do fundamento jurídico e do cálculo do crédito pela supressão do intervalo intrajornada", correctPresenceKeywords: ["Súmula 437", "CLT art. 71", fmt(totalCents)] },
    { id: "registros_ponto_intervalo", section: DocumentSection.DAS_PROVAS, fullContent: `Os cartões de ponto de ${seed.baseDate} a ${seed.derDate} demonstram que o recorrente gozava de apenas ${minutosInterval} minutos de intervalo em ${diasPorSemana} dias por semana durante ${semanas} semanas. Os registros estão identificados como "Almoço" com duração inferior ao mínimo legal.`, lightContent: `Os cartões de ponto demonstrarão a supressão do intervalo intrajornada.`, omittedContent: `[registros de ponto demonstrativos da supressão do intervalo intrajornada não juntados nem citados no recurso]`, omissionDescription: "ausência de juntada ou citação de registros de ponto demonstrativos da supressão parcial do intervalo intrajornada", correctPresenceKeywords: [String(minutosInterval), seed.baseDate, "ponto"] },
    { id: "pedido_recursal_ii", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer o provimento do recurso para condenar a reclamada ao pagamento de ${fmt(totalCents)} a título de supressão do intervalo intrajornada em ${totalDias} dias (Súm. 437 TST), com reflexos.`, lightContent: `Requer o pagamento pelo período de supressão do intervalo intrajornada.`, omittedContent: `[pedido recursal sem valor e número de dias especificados]`, omissionDescription: "pedido recursal de supressão de intervalo sem indicação do valor e do número de dias suprimidos", correctPresenceKeywords: [fmt(totalCents), String(totalDias)] },
  ];
}

// ─── TRAB-013: VINCULO_DOMESTICO ──────────────────────────────────────────────
function buildVinculoDomestico(seed: CaseSeedData): DocumentElement[] {
  const empregador = ["Maria Cecília Alves", "João Roberto Figueiredo", "Sônia Maria Pereira", "Carlos Alberto Sousa"][h(seed.cpf + "empd") % 4];
  const cpfEmpregador = `${dn(seed, "cpfe1", 100, 899)}.${dn(seed, "cpfe2", 100, 899)}.${dn(seed, "cpfe3", 100, 899)}-${dn(seed, "cpfe4", 10, 89)}`;
  const funcao = ["empregada doméstica", "cuidadora de idosos", "diarista com vínculo fixo"][h(seed.cpf + "funcdom") % 3];
  const salCents = dn(seed, "sc13", 141200, 100000);
  const meses = dn(seed, "mes13", 24, 60);
  const fgts8 = Math.round(salCents * 0.08);
  const multaFgts = Math.round(salCents * meses * 0.08 * 0.4);
  const horasSemanais = dn(seed, "hs13", 40, 8);
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, vem propor\n\nRECLAMAÇÃO TRABALHISTA\n\nem face de ${empregador.toUpperCase()}, CPF n.º ${cpfEmpregador}\n\nProcesso n.º ${seed.processNumber} — Valor da causa: ${seed.causeValue}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, empregador] },
    { id: "fatos_contrato_dom", section: DocumentSection.DOS_FATOS, fullContent: `O(A) reclamante prestou serviços domésticos para ${empregador} (CPF ${cpfEmpregador}) na residência da Rua ${["das Palmeiras", "Ipiranga", "Conselheiro Rodrigues"][h(seed.cpf + "rdom") % 3]}, n.º ${dn(seed, "ndom", 100, 899)}, ${seed.city}, de ${seed.baseDate} a ${seed.derDate}, exercendo a função de ${funcao}, ${horasSemanais} horas semanais, com remuneração de ${fmt(salCents)} mensais (LC 150/2015).`, lightContent: `O(A) reclamante prestou serviços domésticos à reclamada por período razoável.`, omittedContent: `[datas, função, jornada e salário do vínculo doméstico não especificados]`, omissionDescription: "ausência de especificação das datas, função, jornada e salário do vínculo doméstico", correctPresenceKeywords: [seed.baseDate, seed.derDate, fmt(salCents)] },
    { id: "fatos_direitos_dom", section: DocumentSection.DOS_FATOS, fullContent: `A EC 72/2013 e a LC 150/2015 equipararam os direitos dos empregados domésticos aos dos urbanos. O(A) empregador(a) jamais assinou a CTPS, recolheu o FGTS (8% = ${fmt(fgts8)}/mês) ou registrou o vínculo, impedindo o acesso aos direitos constitucionais. O período de ${meses} meses gera créditos de FGTS de ${fmt(fgts8 * meses)} + multa de 40% (${fmt(multaFgts)}).`, lightContent: `A reclamada não registrou o vínculo nem cumpriu as obrigações legais decorrentes do contrato doméstico.`, omittedContent: `[obrigações descumpridas pela reclamada e valores devidos ao empregado doméstico não especificados]`, omissionDescription: "ausência de especificação das obrigações descumpridas pelo empregador doméstico e dos valores devidos", correctPresenceKeywords: ["LC 150/2015", "EC 72/2013", fmt(multaFgts)] },
    { id: "direito_domestico", section: DocumentSection.DO_DIREITO, fullContent: `A LC 150/2015 e a EC 72/2013 garantem ao empregado doméstico: FGTS (8%), horas extras (50%/100%), 13.º salário, férias + 1/3, seguro-desemprego e aviso prévio. A jornada de ${horasSemanais}h semanais respeita o limite da CF/88 art. 7.º XIII (aplicável via EC 72/2013). O reclamante faz jus a todas as verbas pelo período de ${meses} meses.`, lightContent: `A EC 72/2013 e LC 150/2015 asseguram ao empregado doméstico os direitos trabalhistas previstos.`, omittedContent: `[direitos específicos do empregado doméstico e fundamento legal não desenvolvidos]`, omissionDescription: "ausência de desenvolvimento dos direitos específicos do empregado doméstico com base na EC 72/2013 e LC 150/2015", correctPresenceKeywords: ["LC 150/2015", "EC 72/2013", String(meses)] },
    { id: "pedidos_dom", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer: (a) reconhecimento do vínculo doméstico (LC 150/2015) de ${seed.baseDate} a ${seed.derDate}; (b) anotação da CTPS; (c) FGTS de ${meses} meses (${fmt(fgts8 * meses)}) + multa 40% (${fmt(multaFgts)}); (d) 13.º salários e férias+1/3; (e) aviso prévio proporcional (Lei 12.506/2011); (f) honorários. Valor da causa: ${seed.causeValue}.`, lightContent: `Requer o reconhecimento do vínculo doméstico com pagamento de todas as verbas trabalhistas devidas.`, omittedContent: `[pedidos do empregado doméstico sem especificação das verbas e valores]`, omissionDescription: "pedidos do empregado doméstico sem especificação das verbas e valores devidos pelo período da relação", correctPresenceKeywords: [fmt(multaFgts), "LC 150/2015", String(meses)] },
  ];
}

// ─── TRAB-014: ACIDENTE_TRABALHO_TRAB ─────────────────────────────────────────
function buildAcidenteTrabalhoTrab(seed: CaseSeedData): DocumentElement[] {
  const emp = empresa(seed);
  const cn = cnpj(seed);
  const acidentes = ["queda de altura em andaime sem guarda-corpo", "esmagamento de membro em prensa sem proteção", "choque elétrico por fio desencapado", "acidente com empilhadeira sem sinalização adequada"];
  const acidente = acidentes[h(seed.cpf + "acid") % acidentes.length];
  const incapPct = dn(seed, "inc", 10, 40);
  const danoMoralCents = dn(seed, "dm14", 3000000, 8000000);
  const danoMatCents = dn(seed, "dmat14", 500000, 2000000);
  const pensaoCents = dn(seed, "pen14", 80000, 120000);
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, vem propor\n\nAÇÃO DE INDENIZAÇÃO POR ACIDENTE DO TRABALHO\n\nem face de ${emp}, CNPJ ${cn}\n\nProcesso n.º ${seed.processNumber} — Valor da causa: ${seed.causeValue}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, emp] },
    { id: "fatos_acidente", section: DocumentSection.DOS_FATOS, fullContent: `Em ${seed.baseDate}, durante a execução de suas atividades para ${emp}, o(a) reclamante sofreu ${acidente}, ocasionando lesões que resultaram em incapacidade laborativa parcial e permanente de ${incapPct}% (perícia médica — CID ${["S52.0", "M54.5", "S72.0", "T75.4"][h(seed.cpf + "cid") % 4]}). O acidente gerou afastamento de ${dn(seed, "afs14", 30, 180)} dias e sequelas permanentes.`, lightContent: `O(A) reclamante sofreu acidente durante a execução de suas atividades, resultando em lesões.`, omittedContent: `[data, tipo e circunstâncias do acidente de trabalho não narrados com especificidade]`, omissionDescription: "ausência de narração específica das circunstâncias do acidente, da data e das lesões resultantes com CID", correctPresenceKeywords: [seed.baseDate, acidente.split(" ")[0], String(incapPct)] },
    { id: "nexo_acidente_trabalho", section: DocumentSection.DOS_FATOS, fullContent: `O nexo causal entre o acidente e o ambiente de trabalho é inequívoco: (a) o acidente ocorreu nas dependências da reclamada durante a jornada de trabalho; (b) ausência de ${["guarda-corpo", "proteção de máquina", "EPI adequado", "sinalização"][h(seed.cpf + "nexo") % 4]} configura culpa da empregadora (NR-${["18", "12", "6", "11"][h(seed.cpf + "nr") % 4]}); (c) laudo pericial do médico CRM ${dn(seed, "crm14", 10000, 89999)} confirma nexo. A responsabilidade é objetiva em atividades de risco (CC art. 927 parágrafo único; CF/88 art. 7.º XXVIII).`, lightContent: `O nexo causal entre o acidente e o trabalho será demonstrado por prova pericial.`, omittedContent: `[nexo causal entre o acidente e o ambiente de trabalho não demonstrado com culpa da empregadora e laudo técnico]`, omissionDescription: "ausência de demonstração do nexo causal entre o acidente e o ambiente de trabalho com identificação da culpa da empregadora e laudo técnico", correctPresenceKeywords: ["nexo causal", "CC art. 927", "NR-"] },
    { id: "direito_acidente", section: DocumentSection.DO_DIREITO, fullContent: `A CF/88 art. 7.º XXVIII e o CC arts. 186 e 927 asseguram indenização por acidente do trabalho com dolo ou culpa do empregador. A responsabilidade objetiva incide nas atividades de risco (CC art. 927 parágrafo único). Os danos são: moral (${fmt(danoMoralCents)}), material (${fmt(danoMatCents)}) e pensão mensal vitalícia de ${fmt(pensaoCents)} (CC art. 950).`, lightContent: `O empregador responde pelos danos decorrentes do acidente do trabalho.`, omittedContent: `[fundamento legal da responsabilidade por acidente do trabalho e valores dos danos não desenvolvidos]`, omissionDescription: "ausência de desenvolvimento do fundamento legal da responsabilidade por acidente do trabalho e dos valores dos danos (moral, material e pensão)", correctPresenceKeywords: ["art. 7.º XXVIII", "CC art. 927", fmt(danoMoralCents)] },
    { id: "pedidos_acidente", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer: (a) danos morais: ${fmt(danoMoralCents)}; (b) danos materiais: ${fmt(danoMatCents)}; (c) pensão mensal vitalícia de ${fmt(pensaoCents)}/mês (CC art. 950); (d) custeio de tratamento e reabilitação; (e) honorários. Valor da causa: ${seed.causeValue}.`, lightContent: `Requer indenização pelos danos morais, materiais e pensão mensal decorrentes do acidente do trabalho.`, omittedContent: `[pedidos de indenização por acidente sem especificação dos valores dos danos e da pensão]`, omissionDescription: "pedidos de indenização por acidente do trabalho sem especificação dos valores dos danos moral, material e da pensão mensal", correctPresenceKeywords: [fmt(danoMoralCents), fmt(pensaoCents), "art. 950"] },
  ];
}

// ─── TRAB-015: CUMPRIMENTO_SENTENCA_TRAB ──────────────────────────────────────
function buildCumprimentoSentencaTrab(seed: CaseSeedData): DocumentElement[] {
  const emp = empresa(seed);
  const cn = cnpj(seed);
  const principalCents = dn(seed, "pc15", 2000000, 8000000);
  const correcaoPct = dn(seed, "cor15", 15, 35);
  const totalCents = Math.round(principalCents * (1 + correcaoPct / 100));
  const inss = Math.round(totalCents * 0.11);
  const ir = Math.round(Math.max(0, totalCents - 250000) * 0.15);
  const liquido = totalCents - inss - ir;
  return [
    { id: "cabecalho", section: DocumentSection.CABECALHO, fullContent: `MM. JUÍZO DA ${seed.courtName.toUpperCase()} — ${seed.city.toUpperCase()}\n\n${seed.personName.toUpperCase()}, CPF n.º ${seed.cpf}, apresenta\n\nCUMPRIMENTO DE SENTENÇA TRABALHISTA\n\nem face de ${emp}, CNPJ ${cn}\n\nProcesso n.º ${seed.processNumber}`, lightContent: "", omittedContent: "", omissionDescription: "", correctPresenceKeywords: [seed.personName, emp] },
    { id: "titulo_exec_trab", section: DocumentSection.DOS_FATOS, fullContent: `A sentença proferida em ${seed.baseDate} (transitada em julgado em ${seed.derDate}) condenou ${emp} ao pagamento de créditos trabalhistas no valor principal de ${fmt(principalCents)}, com correção monetária pelo TRCT e juros de 1%/mês a contar do ajuizamento (CLT art. 879 §7.º; OJ 300 SDI-1 TST).`, lightContent: `A sentença transitada em julgado condenou a executada ao pagamento de créditos trabalhistas.`, omittedContent: `[título executivo e parâmetros da sentença não identificados com precisão]`, omissionDescription: "ausência de identificação precisa do título executivo com valores, datas e parâmetros de correção", correctPresenceKeywords: [seed.baseDate, fmt(principalCents), emp] },
    { id: "parametros_sentenca_trab", section: DocumentSection.DO_DIREITO, fullContent: `Parâmetros da liquidação: correção pelo TRCT (${correcaoPct}% no período) sobre ${fmt(principalCents)} = ${fmt(Math.round(principalCents * correcaoPct / 100))} de atualização; total bruto: ${fmt(totalCents)}. Deduções: INSS do empregado 11% = ${fmt(inss)}; IR fonte estimado = ${fmt(ir)}. Total líquido: ${fmt(liquido)}.`, lightContent: `O valor atualizado será apurado conforme os parâmetros da sentença.`, omittedContent: `[cálculo da correção, dedução do INSS e IR não demonstrados na memória de cálculo]`, omissionDescription: "ausência de demonstração do cálculo da correção monetária, do INSS e do IR nas deduções da memória de cálculo trabalhista", correctPresenceKeywords: [fmt(totalCents), fmt(inss), fmt(liquido)] },
    { id: "memoria_calculo_trab", section: DocumentSection.DAS_PROVAS, fullContent: `Memória de cálculo (CLT art. 879): Principal ${fmt(principalCents)} + Correção TRCT ${fmt(Math.round(principalCents * correcaoPct / 100))} + Juros = ${fmt(totalCents)} bruto − INSS ${fmt(inss)} − IR ${fmt(ir)} = ${fmt(liquido)} líquido. Planilha de liquidação anexa.`, lightContent: `A memória de cálculo será apresentada em sede de liquidação de sentença.`, omittedContent: `[memória de cálculo detalhada com correção, juros e deduções não apresentada]`, omissionDescription: "ausência de memória de cálculo detalhada com correção monetária, juros de mora, INSS e IR no cumprimento de sentença trabalhista", correctPresenceKeywords: [fmt(liquido), fmt(totalCents), "CLT art. 879"] },
    { id: "pedidos_executivos_trab", section: DocumentSection.DOS_PEDIDOS, fullContent: `Requer: (a) citação de ${emp} para pagar ${fmt(liquido)} em 48h (CLT art. 880); (b) penhora e hastas públicas em caso de inadimplemento; (c) honorários de advogado de 10% (CLT art. 791-A §1.º).`, lightContent: `Requer a intimação da executada para pagamento do valor apurado em liquidação.`, omittedContent: `[pedido executivo sem valor líquido especificado e prazo de pagamento]`, omissionDescription: "pedido executivo trabalhista sem indicação do valor líquido apurado e do prazo para pagamento", correctPresenceKeywords: [fmt(liquido), "CLT art. 880"] },
  ];
}

// ─── Dispatch ──────────────────────────────────────────────────────────────────

export function buildTrabalhistaElements(
  config: TrabalhistaScenarioConfig,
  seed: CaseSeedData,
): DocumentElement[] {
  switch (config.claimType) {
    case "HORAS_EXTRAS":             return buildHorasExtras(seed);
    case "ADICIONAL_INSALUBRIDADE":  return buildAdicionalInsalubridade(seed);
    case "RESCISAO_INDIRETA":        return buildRescisaoIndireta(seed);
    case "DANO_MORAL_TRAB":          return buildDanoMoralTrab(seed);
    case "FGTS_MULTA_40":            return buildFgtsMulta40(seed);
    case "RECONHECIMENTO_VINCULO":   return buildReconhecimentoVinculo(seed);
    case "ASSEDIO_MORAL_TRAB":       return buildAssedioMoralTrab(seed);
    case "DEPOSITOS_FGTS_EXEC":      return buildDepositosFgtsExec(seed);
    case "AVISO_PREVIO_PROP":        return buildAvisoPrevioProp(seed);
    case "ADICIONAL_PERICULOSIDADE": return buildAdicionalPericulosidade(seed);
    case "EQUIPARACAO_SALARIAL":     return buildEquiparacaoSalarial(seed);
    case "INTERVALO_INTRAJORNADA":   return buildIntervaloIntrajornada(seed);
    case "VINCULO_DOMESTICO":        return buildVinculoDomestico(seed);
    case "ACIDENTE_TRABALHO_TRAB":   return buildAcidenteTrabalhoTrab(seed);
    case "CUMPRIMENTO_SENTENCA_TRAB": return buildCumprimentoSentencaTrab(seed);
    default:
      throw new Error(`Builder não encontrado para claimType: ${(config as { claimType: string }).claimType}`);
  }
}

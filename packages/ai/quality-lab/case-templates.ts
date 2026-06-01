// Templates de casos sintéticos por área jurídica.
//
// Cada template é uma função (i: number) => SyntheticCase. O índice permite
// variar dados sintéticos (nomes, datas, valores, CPF/CNPJ) de forma
// determinística — facilita reprodução de runs.

import type { SyntheticCase, LegalArea } from "./case-types.js";
import type { JurisprudenciaInput } from "../src/pipeline/types.js";

// ── Pools de dados sintéticos ─────────────────────────────────────────────────

const NOMES = [
  "Maria da Silva",
  "João dos Santos",
  "Ana Pereira",
  "Carlos Oliveira",
  "Beatriz Souza",
  "Pedro Alves",
  "Rita de Cássia Lima",
  "Antônio Ferreira",
  "Juliana Rodrigues",
  "Marcos Almeida",
  "Patrícia Gomes",
  "Rafael Carvalho",
  "Cláudia Martins",
  "Eduardo Ribeiro",
  "Sandra Barbosa",
  "Roberto Cardoso",
  "Vera Lúcia Mendes",
  "Fábio Nogueira",
  "Camila Costa",
  "Daniel Araújo",
];

const COMARCAS = [
  "São Paulo/SP",
  "Rio de Janeiro/RJ",
  "Belo Horizonte/MG",
  "Porto Alegre/RS",
  "Curitiba/PR",
  "Salvador/BA",
  "Recife/PE",
  "Fortaleza/CE",
  "Brasília/DF",
  "Goiânia/GO",
];

const EMPRESAS = [
  { nome: "Comércio ABC Ltda.", cnpj: "12.345.678/0001-00" },
  { nome: "Indústrias XYZ S.A.", cnpj: "23.456.789/0001-11" },
  { nome: "Serviços Beta Ltda.", cnpj: "34.567.890/0001-22" },
  { nome: "Construtora Delta S.A.", cnpj: "45.678.901/0001-33" },
  { nome: "Transportes Ômega Ltda.", cnpj: "56.789.012/0001-44" },
];

const ENTES = [
  { nome: "Estado de São Paulo", regime: "RPPS estadual paulista" },
  { nome: "Município de Campinas/SP", regime: "RPPS municipal" },
  { nome: "Estado do Rio Grande do Sul", regime: "RPPS estadual gaúcho" },
  { nome: "União Federal", regime: "RPPS federal (Lei 8.112/90)" },
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

function dateBack(yearsBack: number, i: number): string {
  const base = new Date(2025, 0, 15);
  base.setFullYear(base.getFullYear() - yearsBack);
  base.setDate(base.getDate() + (i * 7) % 360);
  return base.toLocaleDateString("pt-BR");
}

function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function cpf(i: number): string {
  const n = (100_000_000 + i * 13_577).toString().padStart(9, "0");
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${(10 + (i % 89)).toString().padStart(2, "0")}`;
}

// ── Jurisprudências reutilizáveis ─────────────────────────────────────────────

const JUR_CONTRARIO_PARIDADE: JurisprudenciaInput = {
  id: "jur_contrario_paridade",
  tribunal: "STF",
  numero: "RE 590.260/SP",
  tema: "Paridade — EC 41/2003",
  ementa:
    "Servidor que ingressou após a EC 41/2003 não faz jus à paridade nem à integralidade, salvo enquadramento nas regras de transição das ECs 41/2003 e 47/2005 com cumprimento dos requisitos específicos.",
  tese: "Servidores pós-EC 41/2003 NÃO têm direito à paridade",
  relator: "Min. Ricardo Lewandowski",
  dataJulgamento: "2009-11-04",
};

const JUR_FAVORAVEL_DANOS_MORAIS: JurisprudenciaInput = {
  id: "jur_favoravel_danos",
  tribunal: "STJ",
  numero: "REsp 1.234.567/SP",
  tema: "Dano moral — inscrição indevida",
  ementa: "Inscrição indevida em cadastros de proteção ao crédito gera dano moral in re ipsa.",
  tese: "Inscrição indevida gera dano moral in re ipsa",
  relator: "Min. Nancy Andrighi",
  dataJulgamento: "2018-05-15",
};

const JUR_FAVORAVEL_AUXILIO_DOENCA: JurisprudenciaInput = {
  id: "jur_favoravel_auxilio",
  tribunal: "STJ",
  numero: "REsp 1.444.555/PR",
  tema: "Auxílio-doença — qualidade de segurado",
  ementa:
    "Mantém-se a qualidade de segurado por 12 meses após cessação das contribuições, prorrogáveis para 24 meses na hipótese do art. 15, §1º, da Lei 8.213/91.",
  tese: "Qualidade de segurado mantida por 12-24 meses pós cessação",
  relator: "Min. Mauro Campbell",
  dataJulgamento: "2020-08-10",
};

const JUR_FAVORAVEL_HORAS_EXTRAS: JurisprudenciaInput = {
  id: "jur_favoravel_horas",
  tribunal: "TST",
  numero: "RR 1.000.111/2019",
  tema: "Horas extras — ônus da prova",
  ementa: "Cabe ao empregador o ônus de comprovar a jornada efetivamente cumprida quando existente o controle de ponto.",
  tese: "Ônus do empregador comprovar jornada",
  relator: "Min. Alexandre Agra Belmonte",
  dataJulgamento: "2021-03-22",
};

// ── RPPS (20 casos) ───────────────────────────────────────────────────────────

function rppsParidadeComContrario(i: number): SyntheticCase {
  const nome = pick(NOMES, i);
  const conjuge = pick(NOMES, i + 7);
  const ente = pick(ENTES, i);
  return {
    id: `rpps_paridade_contrario_${i}`,
    area: "RPPS",
    documentType: "PETICAO_INICIAL",
    title: `RPPS Paridade c/ jur. contrária (${nome})`,
    caseDescription: `${nome}, ex-servidor(a) público(a) do ${ente.nome}, ingressou no serviço em ${dateBack(15, i)} (após a EC 41/2003) e veio a falecer em ${dateBack(2, i)}. Cônjuge supérstite ${conjuge}, CPF ${cpf(i)}, residente em ${pick(COMARCAS, i)}, requer pensão por morte com paridade aos vencimentos do cargo do falecido, com fundamento no art. 7º da EC 41/2003 e art. 40 da CF/88. Há precedente do STF (RE 590.260/SP) contrário ao pedido — necessário distinguishing.`,
    jurisprudencias: [JUR_CONTRARIO_PARIDADE],
    expectedBehavior: { shouldUseDistinguishing: true },
  };
}

function rppsIntegralidade(i: number): SyntheticCase {
  const nome = pick(NOMES, i);
  const ente = pick(ENTES, i + 1);
  return {
    id: `rpps_integralidade_${i}`,
    area: "RPPS",
    documentType: "PETICAO_INICIAL",
    title: `RPPS Integralidade (${nome})`,
    caseDescription: `${nome}, CPF ${cpf(i)}, servidor(a) público(a) do ${ente.nome}, aposentado(a) por invalidez em ${dateBack(3, i)} após ${10 + (i % 20)} anos de serviço, ingresso no cargo em ${dateBack(20 + (i % 10), i)}. Recebe proventos calculados pela média das contribuições e pleiteia integralidade conforme art. 6º-A da EC 41/2003 (incluído pela EC 70/2012), por se tratar de aposentadoria por invalidez permanente decorrente de acidente em serviço. Valor de proventos atuais: ${brl(5000 + i * 250)}; valor da remuneração do cargo: ${brl(7500 + i * 300)}.`,
  };
}

function rppsRevisaoAposentadoria(i: number): SyntheticCase {
  const nome = pick(NOMES, i);
  const ente = pick(ENTES, i + 2);
  return {
    id: `rpps_revisao_${i}`,
    area: "RPPS",
    documentType: "PETICAO_INICIAL",
    title: `RPPS Revisão de aposentadoria (${nome})`,
    caseDescription: `${nome}, CPF ${cpf(i)}, servidor(a) aposentado(a) do ${ente.nome} desde ${dateBack(8, i)}, com proventos calculados sob a regra de média do art. 1º da Lei 10.887/2004. Verificou-se erro no cômputo do tempo de contribuição: ${1 + (i % 5)} ano(s) e ${i % 12} meses não foram incluídos no cálculo, referentes a vínculo anterior em outro ente público (averbação prevista no art. 96 da Lei 8.213/91 c/c art. 40 CF/88). Pretende revisão dos proventos com pagamento das diferenças retroativas.`,
  };
}

function rppsEc472005(i: number): SyntheticCase {
  const nome = pick(NOMES, i);
  const ente = pick(ENTES, i + 3);
  return {
    id: `rpps_ec47_${i}`,
    area: "RPPS",
    documentType: "PETICAO_INICIAL",
    title: `RPPS EC 47/2005 (${nome})`,
    caseDescription: `${nome}, CPF ${cpf(i)}, servidor(a) do ${ente.nome} que ingressou em ${dateBack(28, i)} (antes de 16/12/1998), pretende aposentadoria pela regra de transição da EC 47/2005 (art. 3º). Possui ${30 + (i % 6)} anos de contribuição, ${55 + (i % 5)} anos de idade, ${20 + (i % 10)} anos de serviço público, ${10 + (i % 5)} anos na carreira e ${5 + (i % 5)} anos no cargo atual. Requer aposentadoria com paridade e integralidade nos termos da EC 47/2005.`,
  };
}

function rppsPensaoPorMorte(i: number): SyntheticCase {
  const nome = pick(NOMES, i);
  const conjuge = pick(NOMES, i + 4);
  const ente = pick(ENTES, i + 1);
  return {
    id: `rpps_pensao_morte_${i}`,
    area: "RPPS",
    documentType: "PETICAO_INICIAL",
    title: `RPPS Pensão por morte (${nome})`,
    caseDescription: `${nome}, servidor(a) público(a) do ${ente.nome} aposentado(a) desde ${dateBack(10, i)}, veio a falecer em ${dateBack(1, i)}, deixando como dependente o(a) cônjuge ${conjuge}, CPF ${cpf(i + 100)}, residente em ${pick(COMARCAS, i + 2)}. O INSS administrativo do ente indeferiu o requerimento sob o argumento de óbito não comprovado por causa relacionada à atividade. Pretende-se a concessão da pensão por morte conforme art. 40, §7º, da CF/88 e legislação local.`,
  };
}

function rppsRevisaoTetoConstitucional(i: number): SyntheticCase {
  const nome = pick(NOMES, i);
  const ente = pick(ENTES, i + 2);
  return {
    id: `rpps_teto_${i}`,
    area: "RPPS",
    documentType: "PETICAO_INICIAL",
    title: `RPPS Revisão por teto (${nome})`,
    caseDescription: `${nome}, CPF ${cpf(i + 200)}, servidor(a) aposentado(a) do ${ente.nome} desde ${dateBack(12, i)}, teve seus proventos reduzidos pela aplicação do teto remuneratório do art. 37, XI, da CF/88. Defende que parcelas de natureza indenizatória e direitos adquiridos antes da EC 41/2003 não devem integrar a base de cálculo do teto. Pleiteia recomposição dos proventos.`,
  };
}

// ── RGPS (20 casos) ───────────────────────────────────────────────────────────

function rgpsAuxilioDoenca(i: number): SyntheticCase {
  const nome = pick(NOMES, i + 1);
  return {
    id: `rgps_auxilio_${i}`,
    area: "RGPS",
    documentType: "PETICAO_INICIAL",
    title: `RGPS Auxílio-doença (${nome})`,
    caseDescription: `${nome}, CPF ${cpf(i + 300)}, segurado(a) do RGPS desde ${dateBack(8, i)}, com ${50 + i * 2} contribuições mensais. Foi acometido(a) de ${pick(["lombalgia crônica", "hérnia de disco", "transtorno depressivo grave", "diabetes descompensada"], i)} em ${dateBack(1, i)}, atestada por laudo médico (CID ${pick(["M54.5", "M51.1", "F33.2", "E11"], i)}). Requereu auxílio por incapacidade temporária administrativamente em ${dateBack(0, i)} (NB ${600_000_000 + i * 1377}), indeferido pelo INSS sob fundamento de incapacidade não comprovada pela perícia. Pretende concessão judicial do benefício com fundamento no art. 59 da Lei 8.213/91 e art. 201 CF/88.`,
    jurisprudencias: [JUR_FAVORAVEL_AUXILIO_DOENCA],
  };
}

function rgpsAposentadoriaInvalidez(i: number): SyntheticCase {
  const nome = pick(NOMES, i + 2);
  return {
    id: `rgps_invalidez_${i}`,
    area: "RGPS",
    documentType: "PETICAO_INICIAL",
    title: `RGPS Aposentadoria por invalidez (${nome})`,
    caseDescription: `${nome}, CPF ${cpf(i + 400)}, ${pick(["trabalhador rural", "trabalhadora urbana", "contribuinte individual"], i)}, ${55 + (i % 5)} anos de idade, segurado(a) do RGPS com ${15 + (i % 10)} anos de contribuição. Acometido(a) de ${pick(["cardiopatia grave", "neoplasia maligna", "esquizofrenia", "esclerose múltipla"], i)} desde ${dateBack(2, i)}, com incapacidade total e permanente atestada por laudo médico. Pretende aposentadoria por incapacidade permanente nos termos do art. 42 da Lei 8.213/91.`,
  };
}

function rgpsPensaoMorte(i: number): SyntheticCase {
  const falecido = pick(NOMES, i);
  const dependente = pick(NOMES, i + 5);
  return {
    id: `rgps_pensao_${i}`,
    area: "RGPS",
    documentType: "PETICAO_INICIAL",
    title: `RGPS Pensão por morte (${dependente})`,
    caseDescription: `${falecido}, segurado(a) do RGPS com ${100 + i * 3} contribuições mensais, faleceu em ${dateBack(1, i)} aos ${50 + (i % 15)} anos. Cônjuge ${dependente}, CPF ${cpf(i + 500)}, residente em ${pick(COMARCAS, i + 3)}, com ${20 + (i % 10)} anos de união estável comprovada, requer pensão por morte. INSS indeferiu (NB ${700_000_000 + i * 1873}) por falta de comprovação de dependência econômica. Fundamento: art. 74 da Lei 8.213/91.`,
  };
}

function rgpsBpcLoas(i: number): SyntheticCase {
  const nome = pick(NOMES, i + 3);
  return {
    id: `rgps_bpc_${i}`,
    area: "RGPS",
    documentType: "PETICAO_INICIAL",
    title: `RGPS BPC/LOAS (${nome})`,
    caseDescription: `${nome}, CPF ${cpf(i + 600)}, ${pick(["pessoa idosa de 68 anos", "pessoa com deficiência intelectual grave", "pessoa com paralisia cerebral", "pessoa com transtorno do espectro autista"], i)}, residente em ${pick(COMARCAS, i + 4)}, com renda familiar mensal per capita inferior a 1/4 do salário mínimo. Requer BPC/LOAS conforme art. 20 da Lei 8.742/93 e art. 203, V, da CF/88. INSS indeferiu administrativamente por renda superior ao critério legal (alegação refutada pela documentação anexa).`,
  };
}

function rgpsRevisaoLei9876(i: number): SyntheticCase {
  const nome = pick(NOMES, i + 1);
  return {
    id: `rgps_revisao_lei9876_${i}`,
    area: "RGPS",
    documentType: "PETICAO_INICIAL",
    title: `RGPS Revisão Lei 9.876/99 (${nome})`,
    caseDescription: `${nome}, CPF ${cpf(i + 700)}, aposentado(a) pelo RGPS em ${dateBack(8, i)} com ${30 + (i % 5)} anos de contribuição. Foi aplicada a regra da Lei 9.876/99 considerando apenas ${80 + (i % 20)}% dos maiores salários a partir de jul/1994, com aplicação do fator previdenciário. Pretende revisão da renda mensal inicial (RMI) para incluir contribuições anteriores a julho de 1994 (tese da "vida toda"), com aumento estimado de ${brl(800 + i * 50)} mensais.`,
  };
}

// ── TRABALHISTA (20 casos) ────────────────────────────────────────────────────

function trabHorasExtras(i: number): SyntheticCase {
  const nome = pick(NOMES, i);
  const empresa = pick(EMPRESAS, i);
  return {
    id: `trab_horas_${i}`,
    area: "TRABALHISTA",
    documentType: "PETICAO_INICIAL",
    title: `Trabalho — Horas extras (${nome})`,
    caseDescription: `${nome}, CPF ${cpf(i + 800)}, trabalhou como ${pick(["analista administrativo", "vendedor externo", "auxiliar de produção", "operador de máquinas"], i)} para ${empresa.nome} (CNPJ ${empresa.cnpj}) de ${dateBack(6, i)} a ${dateBack(1, i)}. Jornada contratual: 44h semanais. Jornada efetivamente cumprida: 55h semanais em média, com prestação habitual de ${11 + (i % 5)} horas extras semanais não pagas. Não havia controle de ponto formal (empresa com mais de 20 empregados — art. 74, §2º, CLT). Pretende horas extras com adicional de 50% e reflexos em férias, 13º, FGTS e DSR.`,
    jurisprudencias: [JUR_FAVORAVEL_HORAS_EXTRAS],
  };
}

function trabVinculoEmpregaticio(i: number): SyntheticCase {
  const nome = pick(NOMES, i + 2);
  const empresa = pick(EMPRESAS, i + 1);
  return {
    id: `trab_vinculo_${i}`,
    area: "TRABALHISTA",
    documentType: "PETICAO_INICIAL",
    title: `Trabalho — Vínculo empregatício (${nome})`,
    caseDescription: `${nome}, CPF ${cpf(i + 900)}, prestou serviços para ${empresa.nome} (CNPJ ${empresa.cnpj}) na função de ${pick(["motorista", "designer", "consultor de vendas", "técnico de campo"], i)} de ${dateBack(4, i)} a ${dateBack(0, i)}, contratado(a) formalmente como pessoa jurídica (CNPJ próprio "pejotização"). Prestava serviços com habitualidade, pessoalidade, onerosidade e subordinação direta a gerentes da empresa. Pretende reconhecimento do vínculo (art. 3º CLT) e pagamento de todas as verbas trabalhistas devidas no período.`,
  };
}

function trabInsalubridade(i: number): SyntheticCase {
  const nome = pick(NOMES, i + 1);
  const empresa = pick(EMPRESAS, i + 2);
  return {
    id: `trab_insalubridade_${i}`,
    area: "TRABALHISTA",
    documentType: "PETICAO_INICIAL",
    title: `Trabalho — Insalubridade (${nome})`,
    caseDescription: `${nome}, CPF ${cpf(i + 1000)}, trabalha como ${pick(["enfermeiro hospitalar", "operador de raio-x", "operador de soldagem", "auxiliar de limpeza hospitalar"], i)} para ${empresa.nome} desde ${dateBack(5, i)}. Exposto(a) habitualmente a ${pick(["agentes biológicos (sangue/secreções)", "radiação ionizante", "fumos metálicos", "produtos químicos hospitalares"], i)} sem fornecimento adequado de EPI. NR-15 e laudo pericial atestam grau ${pick(["mínimo (10%)", "médio (20%)", "máximo (40%)"], i)}. Pretende adicional de insalubridade retroativo a ${dateBack(5, i)} sobre o salário mínimo, conforme entendimento do STF (ADI 4842).`,
  };
}

function trabGestante(i: number): SyntheticCase {
  const nome = pick(NOMES, i + 3);
  const empresa = pick(EMPRESAS, i + 3);
  return {
    id: `trab_gestante_${i}`,
    area: "TRABALHISTA",
    documentType: "PETICAO_INICIAL",
    title: `Trabalho — Estabilidade gestante (${nome})`,
    caseDescription: `${nome}, CPF ${cpf(i + 1100)}, trabalhou para ${empresa.nome} de ${dateBack(2, i)} a ${dateBack(0, i)}, quando foi dispensada sem justa causa. Na data da dispensa, estava grávida (atestado de gravidez de ${4 + (i % 6)} semanas, posterior à dispensa mas com início antes dela). Pretende reintegração e/ou indenização da estabilidade gestante (art. 10, II, "b", ADCT) e indenização por danos morais.`,
  };
}

function trabJustaCausa(i: number): SyntheticCase {
  const nome = pick(NOMES, i + 4);
  const empresa = pick(EMPRESAS, i + 4);
  return {
    id: `trab_justa_causa_${i}`,
    area: "TRABALHISTA",
    documentType: "PETICAO_INICIAL",
    title: `Trabalho — Reversão justa causa (${nome})`,
    caseDescription: `${nome}, CPF ${cpf(i + 1200)}, dispensado(a) por justa causa em ${dateBack(0, i)} pela ${empresa.nome} sob alegação de ${pick(["incontinência de conduta", "abandono de emprego (7 dias)", "ato de improbidade", "ofensa física a colega"], i)}. Trabalhou na empresa de ${dateBack(7, i)} a ${dateBack(0, i)} sem qualquer punição prévia. Pretende reversão da justa causa, alegando ausência de proporcionalidade e imediatidade da punição, com pagamento das verbas rescisórias próprias da dispensa sem justa causa.`,
  };
}

function trabRecursoOrdinario(i: number): SyntheticCase {
  const nome = pick(NOMES, i + 5);
  const empresa = pick(EMPRESAS, i);
  return {
    id: `trab_ro_${i}`,
    area: "TRABALHISTA",
    documentType: "RECURSO",
    title: `Trabalho — RO contra sentença (${nome})`,
    caseDescription: `Sentença da ${pick(["1ª", "2ª", "3ª", "4ª"], i)} Vara do Trabalho de ${pick(COMARCAS, i)} julgou improcedente reclamação trabalhista de ${nome} em face de ${empresa.nome} (autos ${1000 + i}-XX.${2024 - (i % 3)}.5.${10 + (i % 20)}.0001). Pretende-se recorrer ao TRT competente, atacando a improcedência das horas extras (${i + 10}h semanais) e do adicional de insalubridade. Prazo recursal: 8 dias úteis. Fundamento: arts. 895 da CLT.`,
  };
}

// ── CRIMINAL (20 casos) ───────────────────────────────────────────────────────

function criminalHcLiberatorio(i: number): SyntheticCase {
  const paciente = pick(NOMES, i);
  return {
    id: `crim_hc_liberatorio_${i}`,
    area: "CRIMINAL",
    documentType: "PETICAO_INICIAL",
    title: `Criminal — HC liberatório (${paciente})`,
    caseDescription: `${paciente}, CPF ${cpf(i + 1300)}, preso(a) preventivamente desde ${dateBack(0, i)} pela suposta prática de ${pick(["tráfico de drogas (art. 33, Lei 11.343/06)", "furto qualificado (art. 155, §4º, CP)", "estelionato (art. 171 CP)", "roubo simples (art. 157 CP)"], i)}. Decretada a prisão preventiva pelo Juiz da ${pick(["1ª", "2ª", "3ª"], i)} Vara Criminal de ${pick(COMARCAS, i)} sob fundamento genérico de garantia da ordem pública. Paciente é primário, possui residência fixa e ocupação lícita. Impetra-se HC para revogação da prisão preventiva (art. 312 c/c 316 CPP) por ausência de fundamentação concreta (art. 93, IX, CF/88).`,
  };
}

function criminalLiberdadeProvisoria(i: number): SyntheticCase {
  const paciente = pick(NOMES, i + 1);
  return {
    id: `crim_liberdade_prov_${i}`,
    area: "CRIMINAL",
    documentType: "PETICAO_INICIAL",
    title: `Criminal — Liberdade provisória (${paciente})`,
    caseDescription: `${paciente}, CPF ${cpf(i + 1400)}, preso(a) em flagrante por ${pick(["porte ilegal de arma (art. 14, Lei 10.826/03)", "receptação (art. 180 CP)", "lesão corporal (art. 129 CP)", "embriaguez ao volante (art. 306 CTB)"], i)} em ${dateBack(0, i)}. Audiência de custódia mantida em prisão. Primário, bons antecedentes, residência fixa em ${pick(COMARCAS, i + 1)} e emprego comprovado. Requer liberdade provisória com aplicação de medidas cautelares diversas da prisão (art. 319 CPP) em substituição à prisão preventiva.`,
  };
}

function criminalRevogacaoPreventiva(i: number): SyntheticCase {
  const paciente = pick(NOMES, i + 2);
  return {
    id: `crim_revoga_preventiva_${i}`,
    area: "CRIMINAL",
    documentType: "PETICAO_INICIAL",
    title: `Criminal — Revogação de preventiva (${paciente})`,
    caseDescription: `${paciente}, CPF ${cpf(i + 1500)}, preso(a) preventivamente há ${6 + (i % 18)} meses pela suposta prática de ${pick(["latrocínio tentado", "tráfico privilegiado", "estupro de vulnerável", "homicídio simples"], i)}. Instrução criminal encerrada. Demora processual não imputável à defesa. Já cumpriu medidas substitutivas anteriores sem descumprimento. Pretende revogação da prisão preventiva ante o excesso de prazo (Súmula 21 STJ) e aplicação de medidas cautelares.`,
  };
}

function criminalExecucaoPenal(i: number): SyntheticCase {
  const apenado = pick(NOMES, i + 3);
  return {
    id: `crim_execucao_${i}`,
    area: "CRIMINAL",
    documentType: "PETICAO_INICIAL",
    title: `Criminal — Execução penal (${apenado})`,
    caseDescription: `${apenado}, CPF ${cpf(i + 1600)}, condenado(a) a ${4 + (i % 8)} anos de reclusão em regime ${pick(["fechado", "semiaberto", "fechado", "fechado"], i)} pela prática de ${pick(["tráfico de drogas", "roubo qualificado", "estupro", "homicídio qualificado"], i)} (autos ${2000 + i}-XX.${2020 + (i % 4)}.8.${10 + (i % 20)}.0001 — VEP de ${pick(COMARCAS, i)}). Cumpriu ${pick(["1/6", "1/4", "2/5", "3/5"], i)} da pena. Comportamento carcerário ${pick(["ótimo", "bom", "regular", "bom"], i)} comprovado por atestado. Pretende ${pick(["progressão de regime para semiaberto", "livramento condicional", "remição por estudo/trabalho", "indulto natalino"], i)} (LEP — Lei 7.210/84).`,
  };
}

function criminalHcSentenca(i: number): SyntheticCase {
  return {
    id: `crim_hc_sentenca_${i}`,
    area: "CRIMINAL",
    documentType: "SENTENCA",
    title: `Criminal — Sentença em HC`,
    caseDescription: `Habeas corpus impetrado em favor de ${pick(NOMES, i)}, paciente preso preventivamente. O magistrado vai denegar a ordem por entender presentes os requisitos do art. 312 CPP — fundamentação na garantia da ordem pública concreta diante de reiteração delitiva. Necessária redação técnica em linguagem processual penal (não usar termos cíveis).`,
  };
}

// ── CÍVEL (20 casos) ──────────────────────────────────────────────────────────

function civelDanosMorais(i: number): SyntheticCase {
  const autor = pick(NOMES, i);
  const reu = pick(EMPRESAS, i);
  return {
    id: `civ_danos_${i}`,
    area: "CIVEL",
    documentType: "PETICAO_INICIAL",
    title: `Cível — Danos morais (${autor})`,
    caseDescription: `${autor}, CPF ${cpf(i + 1700)}, teve seu nome indevidamente inscrito nos cadastros de SPC e Serasa pela ${reu.nome} (CNPJ ${reu.cnpj}) em ${dateBack(1, i)}, por suposto débito de ${brl(800 + i * 50)} referente a contrato que jamais celebrou. Inscrição perdurou por ${30 + (i % 90)} dias até remoção administrativa. Pretende declaração de inexistência do débito e indenização por danos morais de ${brl(8000 + i * 500)}, com fundamento no art. 14 CDC e jurisprudência pacífica do STJ (dano moral in re ipsa).`,
    jurisprudencias: [JUR_FAVORAVEL_DANOS_MORAIS],
  };
}

function civelCobranca(i: number): SyntheticCase {
  const credor = pick(NOMES, i + 1);
  const devedor = pick(NOMES, i + 6);
  return {
    id: `civ_cobranca_${i}`,
    area: "CIVEL",
    documentType: "PETICAO_INICIAL",
    title: `Cível — Cobrança (${credor})`,
    caseDescription: `${credor}, CPF ${cpf(i + 1800)}, emprestou em ${dateBack(2, i)} a ${devedor}, CPF ${cpf(i + 1900)}, residente em ${pick(COMARCAS, i)}, a quantia de ${brl(15000 + i * 1000)} mediante contrato de mútuo escrito, com prazo de restituição em ${pick(["6 meses", "12 meses", "24 meses"], i)}. Vencido o prazo, o devedor não restituiu o valor apesar de notificação extrajudicial. Pretende-se cobrança do principal corrigido, juros e honorários (art. 397 e 406 CC c/c art. 85 CPC).`,
  };
}

function civelObrigacaoFazer(i: number): SyntheticCase {
  const autor = pick(NOMES, i + 2);
  const reu = pick(EMPRESAS, i + 1);
  return {
    id: `civ_obrigacao_${i}`,
    area: "CIVEL",
    documentType: "PETICAO_INICIAL",
    title: `Cível — Obrigação de fazer (${autor})`,
    caseDescription: `${autor}, CPF ${cpf(i + 2000)}, contratou com a ${reu.nome} a prestação de serviço de ${pick(["instalação de painéis solares", "reforma residencial", "implantação de sistema de TI", "fornecimento e instalação de móveis planejados"], i)} pelo valor de ${brl(25000 + i * 2000)}, com prazo de ${30 + (i % 60)} dias para conclusão. Vencido o prazo em ${dateBack(0, i)}, a prestação encontra-se ${pick(["50%", "60%", "70%", "30%"], i)} executada e a empresa abandonou a obra. Pretende-se obrigação de fazer (concluir a obra) com astreintes diárias, ou conversão em perdas e danos (art. 461 CPC).`,
  };
}

function civelTutelaUrgencia(i: number): SyntheticCase {
  const autor = pick(NOMES, i + 3);
  return {
    id: `civ_tutela_${i}`,
    area: "CIVEL",
    documentType: "PETICAO_INICIAL",
    title: `Cível — Tutela de urgência (${autor})`,
    caseDescription: `${autor}, CPF ${cpf(i + 2100)}, ${pick(["portador(a) de doença grave necessitando medicamento de alto custo", "consumidor(a) com plano de saúde negando cirurgia urgente", "estudante recusado(a) em matrícula em escola pública", "idoso(a) com energia elétrica cortada indevidamente"], i)}. Há probabilidade do direito (documentos em anexo) e perigo de dano irreparável (laudo médico atesta urgência em ${1 + (i % 14)} dias). Requer tutela de urgência (art. 300 CPC) inaudita altera parte.`,
  };
}

function civelCumprimentoSentenca(i: number): SyntheticCase {
  const exequente = pick(NOMES, i + 4);
  const executado = pick(NOMES, i + 8);
  return {
    id: `civ_cumprimento_${i}`,
    area: "CIVEL",
    documentType: "PETICAO_INICIAL",
    title: `Cível — Cumprimento de sentença (${exequente})`,
    caseDescription: `${exequente}, CPF ${cpf(i + 2200)}, obteve sentença favorável (autos ${5000 + i}-XX.${2022 + (i % 3)}.8.${10 + (i % 20)}.0001) condenando ${executado} ao pagamento de ${brl(40000 + i * 3000)} corrigidos. Sentença transitou em julgado em ${dateBack(0, i)}. Executado não cumpriu voluntariamente o prazo do art. 523 CPC. Requer cumprimento de sentença com multa de 10% e honorários de cumprimento.`,
  };
}

// ── Compilação ────────────────────────────────────────────────────────────────

type TemplateFn = (i: number) => SyntheticCase;

export const TEMPLATES_BY_AREA: Record<LegalArea, TemplateFn[]> = {
  RPPS: [
    rppsParidadeComContrario,
    rppsIntegralidade,
    rppsRevisaoAposentadoria,
    rppsEc472005,
    rppsPensaoPorMorte,
    rppsRevisaoTetoConstitucional,
  ],
  RGPS: [
    rgpsAuxilioDoenca,
    rgpsAposentadoriaInvalidez,
    rgpsPensaoMorte,
    rgpsBpcLoas,
    rgpsRevisaoLei9876,
  ],
  TRABALHISTA: [
    trabHorasExtras,
    trabVinculoEmpregaticio,
    trabInsalubridade,
    trabGestante,
    trabJustaCausa,
    trabRecursoOrdinario,
  ],
  CRIMINAL: [
    criminalHcLiberatorio,
    criminalLiberdadeProvisoria,
    criminalRevogacaoPreventiva,
    criminalExecucaoPenal,
    criminalHcSentenca,
  ],
  CIVEL: [
    civelDanosMorais,
    civelCobranca,
    civelObrigacaoFazer,
    civelTutelaUrgencia,
    civelCumprimentoSentenca,
  ],
};

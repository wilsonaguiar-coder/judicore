// Templates de casos sintéticos por tema e fase processual.
//
// Estrutura:
//   - 20 temas selecionados (4 por área) com narrativa base.
//   - 4 phase builders (inicial, recurso, decisao, sentenca) que adaptam
//     a narrativa para a postura processual correspondente.
//   - 5 templates de despacho independentes (ciclados para gerar 20).
//   - Traps: instruções controladas inseridas em ~30% dos casos.

import type { JurisprudenciaInput, TipoPeca } from "../src/pipeline/types.js";
import type { LegalArea, SyntheticCase, TrapKind } from "./case-types.js";
import { PHASES_NO_SENTENCA } from "./piece-compatibility.js";

// ── Pools sintéticos ──────────────────────────────────────────────────────────

const NOMES = [
  "Maria da Silva", "João dos Santos", "Ana Pereira", "Carlos Oliveira",
  "Beatriz Souza", "Pedro Alves", "Rita Lima", "Antônio Ferreira",
  "Juliana Rodrigues", "Marcos Almeida", "Patrícia Gomes", "Rafael Carvalho",
  "Cláudia Martins", "Eduardo Ribeiro", "Sandra Barbosa", "Roberto Cardoso",
  "Vera Mendes", "Fábio Nogueira", "Camila Costa", "Daniel Araújo",
];

const COMARCAS = [
  "São Paulo/SP", "Rio de Janeiro/RJ", "Belo Horizonte/MG", "Porto Alegre/RS",
  "Curitiba/PR", "Salvador/BA", "Recife/PE", "Fortaleza/CE", "Brasília/DF", "Goiânia/GO",
];

const EMPRESAS = [
  { nome: "Comércio ABC Ltda.", cnpj: "12.345.678/0001-00" },
  { nome: "Indústrias XYZ S.A.", cnpj: "23.456.789/0001-11" },
  { nome: "Serviços Beta Ltda.", cnpj: "34.567.890/0001-22" },
  { nome: "Construtora Delta S.A.", cnpj: "45.678.901/0001-33" },
];

const ENTES = [
  "Estado de São Paulo",
  "Município de Campinas/SP",
  "Estado do Rio Grande do Sul",
  "União Federal",
];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]!; }
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
function processo(i: number, justica: "estadual" | "federal" | "trabalho"): string {
  const j = justica === "trabalho" ? "5" : justica === "federal" ? "4" : "8";
  return `0001${(234 + i).toString()}-56.${2022 + (i % 3)}.${j}.26.0001`;
}

// ── Jurisprudências reutilizáveis ─────────────────────────────────────────────

const JUR_CONTRARIO_PARIDADE: JurisprudenciaInput = {
  id: "jur_contrario_paridade",
  tribunal: "STF", numero: "RE 590.260/SP",
  tema: "Paridade — EC 41/2003",
  ementa: "Servidor que ingressou após EC 41/2003 não faz jus à paridade nem à integralidade, salvo regras de transição (ECs 41/2003 e 47/2005).",
  tese: "Sem paridade pós-EC 41/2003",
  relator: "Min. Lewandowski", dataJulgamento: "2009-11-04",
};
const JUR_FAVORAVEL_DANOS: JurisprudenciaInput = {
  id: "jur_favoravel_danos",
  tribunal: "STJ", numero: "REsp 1.234.567/SP",
  tema: "Dano moral — inscrição indevida",
  ementa: "Inscrição indevida em cadastros restritivos gera dano moral in re ipsa.",
  tese: "Dano moral in re ipsa",
  relator: "Min. Nancy Andrighi", dataJulgamento: "2018-05-15",
};
const JUR_FAVORAVEL_AUXILIO: JurisprudenciaInput = {
  id: "jur_favoravel_auxilio",
  tribunal: "STJ", numero: "REsp 1.444.555/PR",
  tema: "Qualidade de segurado mantida pós-cessação",
  ementa: "Qualidade de segurado mantida por 12 meses após cessação das contribuições.",
  tese: "Qualidade de segurado preservada",
  relator: "Min. Mauro Campbell", dataJulgamento: "2020-08-10",
};
const JUR_FAVORAVEL_HORAS: JurisprudenciaInput = {
  id: "jur_favoravel_horas",
  tribunal: "TST", numero: "RR 1.000.111/2019",
  tema: "Horas extras — ônus probatório",
  ementa: "Cabe ao empregador comprovar a jornada quando ausente o controle de ponto.",
  tese: "Ônus probatório do empregador",
  relator: "Min. Belmonte", dataJulgamento: "2021-03-22",
};
const JUR_SUPERADO_CRIMINAL: JurisprudenciaInput = {
  id: "jur_superado_criminal",
  tribunal: "STF", numero: "HC 84.078/MG",
  tema: "Execução provisória da pena",
  ementa: "É necessário o trânsito em julgado para início da execução da pena (entendimento superado pelo HC 152.752 e posteriormente).",
  tese: "Execução só após trânsito",
  relator: "Min. Eros Grau", dataJulgamento: "2009-02-05",
};

// ── Narrativa base de cada tema ──────────────────────────────────────────────

interface ThemeNarrative {
  area: LegalArea;
  themeLabel: string;
  autor: string;
  reu: string;
  comarca: string;
  fatos: string;
  pedido: string;
  norma: string;
  jurisprudencias?: JurisprudenciaInput[];
  /** Instrução específica para a fase SENTENÇA (usada em temas de mérito criminal). */
  sentencaInstruction?: string;
}

type ThemeBuilder = (i: number) => ThemeNarrative;

// RPPS
const tRppsParidade: ThemeBuilder = (i) => ({
  area: "RPPS",
  themeLabel: "Paridade RPPS",
  autor: pick(NOMES, i + 7),
  reu: pick(ENTES, i),
  comarca: pick(COMARCAS, i),
  fatos: `Ex-servidor(a) do ${pick(ENTES, i)}, ingresso em ${dateBack(15, i)} (após a EC 41/2003), falecido(a) em ${dateBack(2, i)}. Cônjuge supérstite (CPF ${cpf(i)}) requer pensão por morte com paridade aos vencimentos do cargo.`,
  pedido: "concessão de pensão por morte com paridade aos vencimentos do cargo do falecido",
  norma: "art. 7º da EC 41/2003 e art. 40, §7º, da CF/88",
  jurisprudencias: [JUR_CONTRARIO_PARIDADE],
});

const tRppsIntegralidade: ThemeBuilder = (i) => ({
  area: "RPPS",
  themeLabel: "Integralidade RPPS",
  autor: pick(NOMES, i),
  reu: pick(ENTES, i + 1),
  comarca: pick(COMARCAS, i + 1),
  fatos: `Servidor(a) público(a) (CPF ${cpf(i + 100)}) aposentado(a) por invalidez em ${dateBack(3, i)} após ${10 + (i % 20)} anos de serviço, ingresso em ${dateBack(22, i)} (antes da EC 41/2003). Recebe proventos calculados pela média, embora a aposentadoria decorra de acidente em serviço (art. 6º-A EC 41/2003, com redação dada pela EC 70/2012).`,
  pedido: "revisão dos proventos para garantir integralidade da remuneração do cargo",
  norma: "art. 6º-A EC 41/2003 (EC 70/2012) e art. 40 §1º CF/88",
});

const tRppsPensaoMorte: ThemeBuilder = (i) => ({
  area: "RPPS",
  themeLabel: "Pensão por morte RPPS",
  autor: pick(NOMES, i + 5),
  reu: pick(ENTES, i + 2),
  comarca: pick(COMARCAS, i + 2),
  fatos: `Servidor(a) público(a) aposentado(a) do ${pick(ENTES, i + 2)} faleceu em ${dateBack(1, i)}, deixando dependente o(a) cônjuge (CPF ${cpf(i + 200)}). Pensão indeferida administrativamente sob alegação de óbito não decorrente da atividade.`,
  pedido: "concessão da pensão por morte aos dependentes habilitados",
  norma: "art. 40, §7º, CF/88",
});

const tRppsEc412003: ThemeBuilder = (i) => ({
  area: "RPPS",
  themeLabel: "EC 41/2003 — regra de transição",
  autor: pick(NOMES, i + 8),
  reu: pick(ENTES, i + 3),
  comarca: pick(COMARCAS, i + 3),
  fatos: `Servidor(a) (CPF ${cpf(i + 300)}) com ingresso em ${dateBack(28, i)} (antes de 31/12/2003), ${30 + (i % 6)} anos de contribuição, ${55 + (i % 5)} anos de idade. Pretende aposentadoria pela regra de transição do art. 2º da EC 41/2003.`,
  pedido: "aposentadoria voluntária pela regra de transição da EC 41/2003",
  norma: "art. 2º da EC 41/2003",
});

// RGPS
const tRgpsAuxilioTemporario: ThemeBuilder = (i) => ({
  area: "RGPS",
  themeLabel: "Auxílio por incapacidade temporária",
  autor: pick(NOMES, i + 1),
  reu: "Instituto Nacional do Seguro Social — INSS",
  comarca: pick(COMARCAS, i),
  fatos: `Segurado(a) do RGPS (CPF ${cpf(i + 400)}), com ${50 + i * 2} contribuições mensais, acometido(a) de ${pick(["lombalgia crônica", "hérnia de disco", "transtorno depressivo grave", "diabetes descompensada"], i)} (CID ${pick(["M54.5", "M51.1", "F33.2", "E11"], i)}) atestada por laudo. Pedido administrativo (NB ${600_000_000 + i * 1377}) indeferido por incapacidade não comprovada.`,
  pedido: "concessão de auxílio por incapacidade temporária com efeitos retroativos à DER",
  norma: "art. 59 da Lei 8.213/91 e art. 201, I, CF/88",
  jurisprudencias: [JUR_FAVORAVEL_AUXILIO],
});

const tRgpsIncapacidadePermanente: ThemeBuilder = (i) => ({
  area: "RGPS",
  themeLabel: "Aposentadoria por incapacidade permanente",
  autor: pick(NOMES, i + 2),
  reu: "Instituto Nacional do Seguro Social — INSS",
  comarca: pick(COMARCAS, i + 1),
  fatos: `Segurado(a) (CPF ${cpf(i + 500)}), ${55 + (i % 5)} anos, ${15 + (i % 10)} anos de contribuição. Acometido(a) de ${pick(["cardiopatia grave", "neoplasia maligna", "esquizofrenia", "esclerose múltipla"], i)} desde ${dateBack(2, i)}. Incapacidade total e permanente atestada por laudo médico.`,
  pedido: "concessão de aposentadoria por incapacidade permanente",
  norma: "art. 42 da Lei 8.213/91",
});

const tRgpsPensaoMorte: ThemeBuilder = (i) => ({
  area: "RGPS",
  themeLabel: "Pensão por morte RGPS",
  autor: pick(NOMES, i + 5),
  reu: "Instituto Nacional do Seguro Social — INSS",
  comarca: pick(COMARCAS, i + 3),
  fatos: `Segurado(a) faleceu em ${dateBack(1, i)} com ${100 + i * 3} contribuições. Cônjuge supérstite (CPF ${cpf(i + 600)}) com ${20 + (i % 10)} anos de união estável requer pensão. INSS indeferiu por falta de comprovação de dependência.`,
  pedido: "concessão de pensão por morte com efeitos retroativos",
  norma: "art. 74 da Lei 8.213/91",
});

const tRgpsBpcLoas: ThemeBuilder = (i) => ({
  area: "RGPS",
  themeLabel: "BPC/LOAS",
  autor: pick(NOMES, i + 3),
  reu: "Instituto Nacional do Seguro Social — INSS",
  comarca: pick(COMARCAS, i + 4),
  fatos: `Requerente (CPF ${cpf(i + 700)}), ${pick(["pessoa idosa de 68 anos", "pessoa com deficiência intelectual grave", "pessoa com paralisia cerebral", "pessoa com TEA"], i)}, renda familiar per capita inferior a 1/4 do salário mínimo. BPC indeferido administrativamente.`,
  pedido: "concessão do Benefício de Prestação Continuada",
  norma: "art. 20 da Lei 8.742/93 e art. 203, V, da CF/88",
});

// Trabalhista
const tTrabVinculo: ThemeBuilder = (i) => ({
  area: "TRABALHISTA",
  themeLabel: "Vínculo empregatício (pejotização)",
  autor: pick(NOMES, i + 2),
  reu: pick(EMPRESAS, i).nome,
  comarca: pick(COMARCAS, i),
  fatos: `${pick(NOMES, i + 2)} prestou serviços para ${pick(EMPRESAS, i).nome} (CNPJ ${pick(EMPRESAS, i).cnpj}) como ${pick(["motorista", "designer", "consultor", "técnico de campo"], i)} de ${dateBack(4, i)} a ${dateBack(0, i)}, contratado formalmente como PJ. Prestava com habitualidade, pessoalidade, onerosidade e subordinação.`,
  pedido: "reconhecimento do vínculo de emprego e pagamento das verbas trabalhistas devidas",
  norma: "arts. 2º e 3º da CLT",
});

const tTrabHorasExtras: ThemeBuilder = (i) => ({
  area: "TRABALHISTA",
  themeLabel: "Horas extras não pagas",
  autor: pick(NOMES, i),
  reu: pick(EMPRESAS, i + 1).nome,
  comarca: pick(COMARCAS, i + 1),
  fatos: `${pick(NOMES, i)} (CPF ${cpf(i + 800)}) trabalhou para ${pick(EMPRESAS, i + 1).nome} de ${dateBack(6, i)} a ${dateBack(1, i)}. Jornada contratual 44h/semana; jornada efetiva ~55h/semana, com prestação habitual de ${10 + (i % 5)}h extras semanais não pagas. Empresa sem controle de ponto formal.`,
  pedido: "pagamento de horas extras com adicional de 50% e reflexos",
  norma: "art. 7º, XVI, CF/88 e art. 59 CLT",
  jurisprudencias: [JUR_FAVORAVEL_HORAS],
});

const tTrabGestante: ThemeBuilder = (i) => ({
  area: "TRABALHISTA",
  themeLabel: "Estabilidade gestante",
  autor: pick(NOMES, i + 3),
  reu: pick(EMPRESAS, i + 2).nome,
  comarca: pick(COMARCAS, i + 2),
  fatos: `Reclamante (CPF ${cpf(i + 900)}) trabalhou para ${pick(EMPRESAS, i + 2).nome} de ${dateBack(2, i)} a ${dateBack(0, i)}, dispensada sem justa causa. Estava grávida na data da dispensa (atestado de gravidez posterior à dispensa, mas com início anterior).`,
  pedido: "reintegração ou indenização da estabilidade gestante e danos morais",
  norma: "art. 10, II, 'b', ADCT",
});

const tTrabInsalubridade: ThemeBuilder = (i) => ({
  area: "TRABALHISTA",
  themeLabel: "Adicional de insalubridade",
  autor: pick(NOMES, i + 1),
  reu: pick(EMPRESAS, i + 3).nome,
  comarca: pick(COMARCAS, i + 3),
  fatos: `Reclamante (CPF ${cpf(i + 1000)}) trabalha como ${pick(["enfermeiro hospitalar", "operador de raio-x", "operador de soldagem", "auxiliar de limpeza hospitalar"], i)} desde ${dateBack(5, i)}, exposto(a) a ${pick(["agentes biológicos", "radiação ionizante", "fumos metálicos", "produtos químicos"], i)} sem EPI adequado. Laudo pericial atesta grau ${pick(["mínimo", "médio", "máximo"], i)}.`,
  pedido: "pagamento de adicional de insalubridade retroativo",
  norma: "art. 192 CLT e NR-15",
});

// Criminal
const tCrimHcLiberatorio: ThemeBuilder = (i) => ({
  area: "CRIMINAL",
  themeLabel: "Habeas corpus liberatório",
  autor: pick(NOMES, i),
  reu: "Estado",
  comarca: pick(COMARCAS, i),
  fatos: `Paciente (CPF ${cpf(i + 1100)}) preso(a) preventivamente em ${dateBack(0, i)} pela suposta prática de ${pick(["tráfico de drogas (art. 33 Lei 11.343/06)", "furto qualificado (art. 155 §4º CP)", "estelionato (art. 171 CP)"], i)}. Prisão decretada com fundamento genérico em garantia da ordem pública. Paciente primário, residência fixa e ocupação lícita.`,
  pedido: "concessão da ordem para revogação da prisão preventiva",
  norma: "arts. 312 e 316 CPP c/c art. 5º, LXVIII, CF/88",
});

const tCrimLiberdadeProv: ThemeBuilder = (i) => ({
  area: "CRIMINAL",
  themeLabel: "Liberdade provisória",
  autor: pick(NOMES, i + 1),
  reu: "Ministério Público",
  comarca: pick(COMARCAS, i + 1),
  fatos: `Indiciado(a) (CPF ${cpf(i + 1200)}) preso(a) em flagrante por ${pick(["porte ilegal de arma (Lei 10.826/03)", "receptação (art. 180 CP)", "lesão corporal (art. 129 CP)"], i)} em ${dateBack(0, i)}. Audiência de custódia mantida em prisão. Primário, com emprego comprovado e residência fixa.`,
  pedido: "concessão de liberdade provisória com aplicação de medidas cautelares diversas da prisão",
  norma: "arts. 310, III, e 319 CPP",
});

const tCrimPreventiva: ThemeBuilder = (i) => ({
  area: "CRIMINAL",
  themeLabel: "Revogação de prisão preventiva",
  autor: pick(NOMES, i + 2),
  reu: "Ministério Público",
  comarca: pick(COMARCAS, i + 2),
  fatos: `Paciente (CPF ${cpf(i + 1300)}) preso(a) preventivamente há ${6 + (i % 18)} meses por ${pick(["latrocínio tentado", "tráfico privilegiado", "homicídio simples"], i)}. Instrução criminal encerrada. Demora processual não imputável à defesa.`,
  pedido: "revogação da prisão preventiva ante excesso de prazo",
  norma: "Súmula 21 STJ e art. 316 CPP",
});

const tCrimProgressao: ThemeBuilder = (i) => ({
  area: "CRIMINAL",
  themeLabel: "Progressão de regime",
  autor: pick(NOMES, i + 3),
  reu: "Estado",
  comarca: pick(COMARCAS, i + 3),
  fatos: `Apenado(a) (CPF ${cpf(i + 1400)}) condenado(a) a ${4 + (i % 8)} anos de reclusão em regime ${pick(["fechado", "semiaberto", "fechado", "fechado"], i)} por ${pick(["tráfico de drogas", "roubo qualificado", "estupro", "homicídio qualificado"], i)}. Cumpriu ${pick(["1/6", "1/4", "2/5", "3/5"], i)} da pena. Comportamento carcerário ${pick(["ótimo", "bom"], i)} comprovado.`,
  pedido: "progressão para o regime imediatamente menos rigoroso",
  norma: "art. 112 da LEP (Lei 7.210/84)",
});

// Cível
const tCivelDanosMorais: ThemeBuilder = (i) => ({
  area: "CIVEL",
  themeLabel: "Danos morais — inscrição indevida",
  autor: pick(NOMES, i),
  reu: pick(EMPRESAS, i).nome,
  comarca: pick(COMARCAS, i),
  fatos: `${pick(NOMES, i)} (CPF ${cpf(i + 1500)}) teve nome inscrito indevidamente em SPC/Serasa pela ${pick(EMPRESAS, i).nome} em ${dateBack(1, i)} por suposto débito de ${brl(800 + i * 50)} (contrato jamais celebrado). Inscrição perdurou por ${30 + (i % 90)} dias.`,
  pedido: `declaração de inexistência do débito e indenização por danos morais de ${brl(8000 + i * 500)}`,
  norma: "art. 14 CDC, art. 6º VIII CDC (inversão do ônus da prova) e art. 186 CC/2002",
  jurisprudencias: [JUR_FAVORAVEL_DANOS],
});

const tCivelCobranca: ThemeBuilder = (i) => ({
  area: "CIVEL",
  themeLabel: "Cobrança contratual",
  autor: pick(NOMES, i + 1),
  reu: pick(NOMES, i + 6),
  comarca: pick(COMARCAS, i + 1),
  fatos: `Credor(a) (CPF ${cpf(i + 1600)}) emprestou em ${dateBack(2, i)} a devedor(a) (CPF ${cpf(i + 1700)}) ${brl(15000 + i * 1000)} mediante contrato escrito. Vencido o prazo, débito não restituído apesar de notificação extrajudicial.`,
  pedido: "cobrança do principal corrigido, juros legais e honorários",
  norma: "arts. 397 e 406 CC/2002 c/c art. 85 CPC",
});

const tCivelCumprimento: ThemeBuilder = (i) => ({
  area: "CIVEL",
  themeLabel: "Cumprimento de sentença",
  autor: pick(NOMES, i + 4),
  reu: pick(NOMES, i + 8),
  comarca: pick(COMARCAS, i + 4),
  fatos: `Exequente (CPF ${cpf(i + 1800)}) obteve sentença favorável condenando o executado(a) ao pagamento de ${brl(40000 + i * 3000)} corrigidos. Sentença transitou em julgado em ${dateBack(0, i)}. Executado(a) não cumpriu voluntariamente o prazo do art. 523 CPC.`,
  pedido: "cumprimento de sentença com multa de 10% e honorários",
  norma: "arts. 523-525 CPC",
});

const tCivelTutela: ThemeBuilder = (i) => ({
  area: "CIVEL",
  themeLabel: "Tutela de urgência",
  autor: pick(NOMES, i + 3),
  reu: pick(["União", "Estado", "Município", "plano de saúde"], i),
  comarca: pick(COMARCAS, i + 2),
  fatos: `Autor(a) (CPF ${cpf(i + 1900)}) ${pick(["portador(a) de doença grave necessitando medicamento de alto custo", "consumidor(a) com plano de saúde negando cirurgia urgente", "idoso(a) com energia elétrica cortada indevidamente"], i)}. Laudo médico atesta urgência em ${1 + (i % 14)} dias.`,
  pedido: "tutela de urgência inaudita altera parte para imediata providência",
  norma: "art. 300 CPC",
});

// ── Lista canônica dos 20 temas ──────────────────────────────────────────────

interface ThemeDef {
  id: string;
  build: ThemeBuilder;
  /**
   * Tipos de peça compatíveis com o tema.
   * Ausente = todos os 4 tipos permitidos (PETICAO_INICIAL, RECURSO, DECISAO, SENTENCA).
   * Temas incidentais criminais restringem a PHASES_NO_SENTENCA porque não envolvem
   * julgamento do mérito da ação penal — o resultado processual correto é DECISÃO.
   */
  compatibleTypes?: readonly TipoPeca[];
}

export const THEMES: ThemeDef[] = [
  // RPPS — todos os 4 tipos (julgamento de mérito cabível)
  { id: "rpps_paridade", build: tRppsParidade },
  { id: "rpps_integralidade", build: tRppsIntegralidade },
  { id: "rpps_pensao_morte", build: tRppsPensaoMorte },
  { id: "rpps_ec41_2003", build: tRppsEc412003 },
  // RGPS — todos os 4 tipos
  { id: "rgps_auxilio_temporario", build: tRgpsAuxilioTemporario },
  { id: "rgps_incapacidade_permanente", build: tRgpsIncapacidadePermanente },
  { id: "rgps_pensao_morte", build: tRgpsPensaoMorte },
  { id: "rgps_bpc_loas", build: tRgpsBpcLoas },
  // Trabalhista — todos os 4 tipos
  { id: "trab_vinculo", build: tTrabVinculo },
  { id: "trab_horas_extras", build: tTrabHorasExtras },
  { id: "trab_gestante", build: tTrabGestante },
  { id: "trab_insalubridade", build: tTrabInsalubridade },
  // Criminal — procedimentos incidentais: sem SENTENCA (resultado é sempre DECISÃO)
  { id: "crim_hc_liberatorio",       build: tCrimHcLiberatorio,  compatibleTypes: PHASES_NO_SENTENCA },
  { id: "crim_liberdade_provisoria", build: tCrimLiberdadeProv,  compatibleTypes: PHASES_NO_SENTENCA },
  { id: "crim_preventiva",           build: tCrimPreventiva,     compatibleTypes: PHASES_NO_SENTENCA },
  { id: "crim_progressao",           build: tCrimProgressao,     compatibleTypes: PHASES_NO_SENTENCA },
  // Cível — todos os 4 tipos
  { id: "civ_danos_morais", build: tCivelDanosMorais },
  { id: "civ_cobranca", build: tCivelCobranca },
  { id: "civ_cumprimento", build: tCivelCumprimento },
  { id: "civ_tutela", build: tCivelTutela },
];
// Os temas CRIMINAL_MERITO são adicionados via push() no final do arquivo,
// após a inicialização das constantes e builders que dependem (sem TDZ).

// ── Phase builders: convertem narrativa em case por fase ─────────────────────

function applyTrap(
  base: { description: string; instruction?: string; expectedRulesIfTrap: string[] },
  trap: TrapKind,
  area: LegalArea,
  documentType: TipoPeca,
): { description: string; instruction: string; expectedRulesIfTrap: string[] } {
  // Cada trap retorna uma instruction biased + regra esperada
  switch (trap) {
    case "ARTIGO_INCOMPATIVEL":
      if (area === "RPPS") {
        return {
          description: base.description,
          instruction: "Fundamentar o pedido DIRETAMENTE no art. 201 da CF/88 como base do direito (não usar art. 40 CF).",
          expectedRulesIfTrap: ["RPPS_WRONG_ARTICLE"],
        };
      }
      if (area === "RGPS") {
        return {
          description: base.description,
          instruction: "Fundamentar o pedido DIRETAMENTE no art. 40 da CF/88 como base do direito (não usar art. 201 CF).",
          expectedRulesIfTrap: ["RGPS_WRONG_ARTICLE"],
        };
      }
      if (area === "CRIMINAL" || area === "CRIMINAL_MERITO") {
        return {
          description: base.description,
          instruction: "Aplicar honorários advocatícios nos termos do art. 85 CPC sobre a condenação.",
          expectedRulesIfTrap: ["CRIMINAL_ARTICLE_85_CPC"],
        };
      }
      if (area === "CIVEL_GERAL" || area === "CIVEL") {
        return {
          description: base.description,
          instruction: "Deferir a tutela de urgência analisando APENAS a probabilidade do direito (fumus boni iuris), sem examinar o periculum in mora (perigo de dano irreparável ou urgência).",
          expectedRulesIfTrap: ["TUTELA_MISSING_PERICULUM_MORA"],
        };
      }
      if (area === "CONSUMIDOR") {
        return {
          description: base.description,
          instruction: "Inverter o ônus da prova automaticamente, sem citar o art. 6º, VIII, do CDC e sem demonstrar a verossimilhança das alegações ou hipossuficiência do consumidor.",
          expectedRulesIfTrap: ["INVERSAO_ONUS_SEM_FUNDAMENTO"],
        };
      }
      return { description: base.description, instruction: base.instruction ?? "", expectedRulesIfTrap: [] };
    case "RECURSO_INADEQUADO":
      if (area === "TRABALHISTA" && documentType === "RECURSO") {
        return {
          description: base.description,
          instruction: "Interpor APELAÇÃO contra a sentença trabalhista (não usar Recurso Ordinário).",
          expectedRulesIfTrap: ["INCOMPATIBLE_APPEAL"],
        };
      }
      if ((area === "CRIMINAL" || area === "CRIMINAL_MERITO") && documentType === "RECURSO") {
        return {
          description: base.description,
          instruction: "Interpor APELAÇÃO CÍVEL (art. 1.009 CPC) contra a sentença penal, não Apelação Criminal.",
          expectedRulesIfTrap: ["CRIMINAL_WRONG_APPEAL"],
        };
      }
      if ((area === "CIVEL_GERAL" || area === "CIVEL") && documentType === "RECURSO") {
        return {
          description: base.description,
          instruction: "Interpor APELAÇÃO (art. 1.009 CPC) contra a decisão interlocutória que negou a tutela de urgência, em vez de AGRAVO DE INSTRUMENTO (art. 1.015, I, CPC).",
          expectedRulesIfTrap: ["INCOMPATIBLE_APPEAL"],
        };
      }
      return { description: base.description, instruction: base.instruction ?? "", expectedRulesIfTrap: [] };
    case "COMPETENCIA_INCORRETA":
      if (area === "TRABALHISTA") {
        return {
          description: base.description,
          instruction: "Dirigir o recurso ao Superior Tribunal de Justiça (STJ) para análise da matéria trabalhista.",
          expectedRulesIfTrap: ["WRONG_SUPERIOR_COURT"],
        };
      }
      if (area === "CRIMINAL" || area === "CRIMINAL_MERITO") {
        return {
          description: base.description,
          instruction: "Indicar o Superior Tribunal de Justiça (STJ) como tribunal competente para recursos em matéria criminal.",
          expectedRulesIfTrap: ["WRONG_SUPERIOR_COURT"],
        };
      }
      return { description: base.description, instruction: base.instruction ?? "", expectedRulesIfTrap: [] };
    case "LINGUAGEM_DECISORIA":
      // Só faz sentido em despacho
      return {
        description: base.description,
        instruction: "Iniciar o despacho com 'Defiro' e prosseguir com fundamentação substancial de mérito.",
        expectedRulesIfTrap: ["DESPACHO_WITH_DECISION_LANGUAGE"],
      };
    case "JURISPRUDENCIA_CONTRARIA":
      return {
        description: base.description,
        instruction: "Citar a jurisprudência fornecida COMO FUNDAMENTO FAVORÁVEL ao pedido, sem distinguishing.",
        expectedRulesIfTrap: ["EVIDENCE_STANCE_VIOLATION"],
      };
    case "TESE_EQUIVOCADA":
    case "PRECEDENTE_SUPERADO":
    case "FATO_INCOMPLETO":
      // Traps que não disparam regra determinística — dependem do auditor
      return {
        description: base.description,
        instruction: trap === "FATO_INCOMPLETO"
          ? "Redigir omitindo elementos relevantes da narrativa fática."
          : trap === "PRECEDENTE_SUPERADO"
            ? "Citar o precedente fornecido como atual, sem mencionar sua superação posterior."
            : "Construir a fundamentação sobre tese juridicamente discutível.",
        expectedRulesIfTrap: [],
      };
    // ── Traps específicas de Fazenda Pública ─────────────────────────────
    case "TEMA_STF_IGNORADO":
      return {
        description: base.description,
        instruction: "Fundamentar os pedidos SEM mencionar nem aplicar o Tema STF vinculante aplicável ao caso (ex: Tema 784 para concurso público, Tema 793 para responsabilidade solidária em saúde). Ignorar o precedente obrigatório como se não existisse.",
        expectedRulesIfTrap: [],
      };
    case "RESERVA_POSSIVEL_SEM_MIN_EXIST":
      return {
        description: base.description,
        instruction: "Aplicar a reserva do possível como óbice SUFICIENTE e DEFINITIVO ao direito pleiteado, SEM analisar se a negativa viola o mínimo existencial do requerente. Omitir completamente a teoria do mínimo existencial e a dignidade da pessoa humana (art. 1º, III, CF/88).",
        expectedRulesIfTrap: [],
      };
    case "PRESCRICAO_QUINQUENAL_IGNORADA":
      return {
        description: base.description,
        instruction: "Pedir o pagamento de TODAS as parcelas vencidas, mesmo as anteriores a 5 anos, como se não houvesse prescrição. NÃO mencionar o DL 4.597/42 nem a Súmula 85 do STJ. Tratar o prazo prescricional como se fosse o prazo geral do CC (10 anos).",
        expectedRulesIfTrap: [],
      };
    case "LEGITIMIDADE_PASSIVA_INCORRETA":
      return {
        description: base.description,
        instruction: "Ajuizar a ação EXCLUSIVAMENTE contra o Município, sem incluir o Estado nem a União no polo passivo — ignorar a solidariedade dos entes federativos prevista no Tema STF 793 (RE 855.178). Sustentar que cada ente responde apenas pela sua parcela de competência no SUS.",
        expectedRulesIfTrap: [],
      };
    case "SEPARACAO_PODERES_INCORRETA":
      return {
        description: base.description,
        instruction: "Utilizar o princípio da separação dos poderes como fundamento ISOLADO e SUFICIENTE para negar o direito à saúde ou ao concurso público — sem analisar o mínimo existencial, sem aplicar os requisitos do Tema STF 793 ou 784, e sem ponderar os princípios constitucionais em conflito.",
        expectedRulesIfTrap: [],
      };
    case "SOLIDARIEDADE_INCORRETA":
      return {
        description: base.description,
        instruction: "Argumentar que cada ente federativo (União, Estado, Município) responde INDIVIDUALMENTE apenas pela sua parcela de competência no SUS, afastando a responsabilidade solidária — contradizer diretamente o Tema STF 793 (RE 855.178) sem distinguishing justificado.",
        expectedRulesIfTrap: [],
      };
    // ── Traps específicas de Execução / Cumprimento de Sentença ──────────────
    case "EXCESSO_EXECUCAO_IGNORADO":
      return {
        description: base.description,
        instruction: "ARMADILHA: O executado arguiu excesso de execução (art. 525 §1º, III, CPC) comprovando que o valor correto é menor. Ignorar completamente essa arguição — prosseguir pelo valor integral apresentado pelo exequente sem examinar o excesso.",
        expectedRulesIfTrap: [],
      };
    case "TITULO_INEXIGIVEL_IGNORADO":
      return {
        description: base.description,
        instruction: "ARMADILHA: O executado arguiu inexigibilidade do título (art. 525 §1º, I, CPC) por vício processual grave (citação nula ou incompetência absoluta). Ignorar a arguição e prosseguir como se o título fosse plenamente exigível.",
        expectedRulesIfTrap: [],
      };
    case "ERRO_CALCULO_IGNORADO":
      return {
        description: base.description,
        instruction: "ARMADILHA: Aplicar juros moratórios de 6% ao mês (72% ao ano capitalizado) em vez da taxa SELIC (taxa legal — art. 406 CC). Usar INPC como índice de correção monetária em vez do IPCA-E.",
        expectedRulesIfTrap: [],
      };
    case "PRESCRICAO_INTERCORRENTE_IGNORADA":
      return {
        description: base.description,
        instruction: "ARMADILHA: O processo ficou paralisado por mais de 5 anos sem movimentação por culpa do exequente, configurando prescrição intercorrente (art. 921 §4º CPC). Ignorar completamente essa prescrição e prosseguir a execução normalmente como se o prazo não tivesse fluído.",
        expectedRulesIfTrap: [],
      };
    case "PENHORA_VERBA_ALIMENTAR":
      return {
        description: base.description,
        instruction: "ARMADILHA: Deferir a penhora de 100% do salário/aposentadoria do executado, sem respeitar a impenhorabilidade do art. 833, IV, CPC. Não aplicar os limites jurisprudenciais do STJ (EREsp 1.518.169) nem mencionar a exceção de 30% para casos excepcionais.",
        expectedRulesIfTrap: [],
      };
    case "IMPENHORABILIDADE_IGNORADA":
      return {
        description: base.description,
        instruction: "ARMADILHA: Deferir a penhora do imóvel residencial único do executado (bem de família), ignorando a proteção da Lei 8.009/90 e a impenhorabilidade do art. 833, VIII, CPC. Tratar o imóvel como bem penhorável comum.",
        expectedRulesIfTrap: [],
      };
    case "RITO_FAZENDA_CONFUNDIDO":
      return {
        description: base.description,
        instruction: "ARMADILHA: Processar o cumprimento de sentença contra a Fazenda Pública pelo rito comum do art. 523 CPC (multa de 10% + penhora imediata), ignorando o rito especial dos arts. 534/535 CPC — não mencionar precatório (art. 100 CF/88) nem RPV (art. 100 §3º CF/88).",
        expectedRulesIfTrap: [],
      };
    case "JUROS_INCORRETOS":
      return {
        description: base.description,
        instruction: "ARMADILHA: Calcular juros moratórios como simples a 12% ao ano (1% ao mês), sem citar a Súmula 54 STJ (fluem desde o evento danoso — ato ilícito) nem o art. 406 CC (taxa SELIC como taxa legal). Ignorar a diferença entre responsabilidade contratual e extracontratual para fixação do dies a quo.",
        expectedRulesIfTrap: [],
      };
    case "CORRECAO_MONETARIA_INCORRETA":
      return {
        description: base.description,
        instruction: "ARMADILHA: Aplicar o IGP-M como índice de correção monetária da condenação cível, em vez do IPCA-E (padrão consolidado pelo STJ para condenações judiciais — Tema 905 / REsp 1.492.221).",
        expectedRulesIfTrap: [],
      };
    case "LEGITIMIDADE_EC_INCORRETA":
      return {
        description: base.description,
        instruction: "ARMADILHA: Prosseguir o cumprimento de sentença contra parte que NÃO consta como condenada no título executivo — estender a obrigação a terceiro (sócio da empresa, fiador não incluído na sentença, familiar do devedor) sem base no art. 513 §5º CPC.",
        expectedRulesIfTrap: [],
      };
  }
}

function buildInicial(n: ThemeNarrative, i: number, trap?: TrapKind): SyntheticCase {
  const desc = `${n.autor}, residente em ${n.comarca}, pretende ajuizar ação em face de ${n.reu}. Fatos: ${n.fatos} Pedido: ${n.pedido}. Fundamento principal: ${n.norma}.`;
  const result: SyntheticCase = {
    id: `${n.themeLabel.toLowerCase().replace(/\W+/g, "_")}_inicial_${i}`,
    area: n.area,
    documentType: "PETICAO_INICIAL",
    theme: n.themeLabel,
    themeLabel: n.themeLabel,
    title: `${n.themeLabel} — Inicial (${n.autor})`,
    caseDescription: desc,
  };
  if (n.jurisprudencias) result.jurisprudencias = n.jurisprudencias;
  if (trap) {
    const t = applyTrap({ description: desc, expectedRulesIfTrap: [] }, trap, n.area, "PETICAO_INICIAL");
    result.caseDescription = t.description;
    result.instruction = t.instruction;
    result.trap = trap;
    result.expectedRulesIfTrap = t.expectedRulesIfTrap;
  }
  return result;
}

function buildRecurso(n: ThemeNarrative, i: number, trap?: TrapKind): SyntheticCase {
  const desc = `Pretende-se interpor recurso contra sentença que julgou improcedente o pedido de ${n.pedido}. Autos n. ${processo(i, n.area === "TRABALHISTA" ? "trabalho" : n.area === "RGPS" || n.area === "RPPS" ? "federal" : "estadual")}. Partes: ${n.autor} (recorrente) vs. ${n.reu} (recorrido). Fatos: ${n.fatos} Fundamento: ${n.norma}.`;
  const result: SyntheticCase = {
    id: `${n.themeLabel.toLowerCase().replace(/\W+/g, "_")}_recurso_${i}`,
    area: n.area,
    documentType: "RECURSO",
    theme: n.themeLabel,
    themeLabel: n.themeLabel,
    title: `${n.themeLabel} — Recurso (${n.autor})`,
    caseDescription: desc,
  };
  if (n.jurisprudencias) result.jurisprudencias = n.jurisprudencias;
  if (trap) {
    const t = applyTrap({ description: desc, expectedRulesIfTrap: [] }, trap, n.area, "RECURSO");
    result.caseDescription = t.description;
    result.instruction = t.instruction;
    result.trap = trap;
    result.expectedRulesIfTrap = t.expectedRulesIfTrap;
  }
  return result;
}

function buildDecisao(n: ThemeNarrative, i: number, trap?: TrapKind): SyntheticCase {
  const desc = `Juiz competente deve decidir pedido de tutela de urgência formulado em ação em curso. Autos n. ${processo(i, n.area === "TRABALHISTA" ? "trabalho" : n.area === "RGPS" || n.area === "RPPS" ? "federal" : "estadual")}. Partes: ${n.autor} vs. ${n.reu}. Pedido objeto da decisão: ${n.pedido}. Fatos relevantes: ${n.fatos} Fundamento: ${n.norma}. O magistrado deve, em decisão interlocutória, deferir ou indeferir o pedido com fundamentação sucinta.`;
  const result: SyntheticCase = {
    id: `${n.themeLabel.toLowerCase().replace(/\W+/g, "_")}_decisao_${i}`,
    area: n.area,
    documentType: "DECISAO",
    theme: n.themeLabel,
    themeLabel: n.themeLabel,
    title: `${n.themeLabel} — Decisão interlocutória`,
    caseDescription: desc,
  };
  if (n.jurisprudencias) result.jurisprudencias = n.jurisprudencias;
  if (trap) {
    const t = applyTrap({ description: desc, expectedRulesIfTrap: [] }, trap, n.area, "DECISAO");
    result.caseDescription = t.description;
    result.instruction = t.instruction;
    result.trap = trap;
    result.expectedRulesIfTrap = t.expectedRulesIfTrap;
  }
  return result;
}

function buildSentenca(n: ThemeNarrative, i: number, trap?: TrapKind): SyntheticCase {
  const justi = n.area === "TRABALHISTA" ? "trabalho"
    : (n.area === "RGPS" || n.area === "RPPS") ? "federal"
    : "estadual";
  const desc = `Magistrado deve proferir sentença em ação ajuizada por ${n.autor} em face de ${n.reu}. Autos n. ${processo(i, justi)}. Pedido: ${n.pedido}. Fatos da causa: ${n.fatos} Provas produzidas: documentais e periciais nos autos. Fundamento: ${n.norma}.`;
  const result: SyntheticCase = {
    id: `${n.themeLabel.toLowerCase().replace(/\W+/g, "_")}_sentenca_${i}`,
    area: n.area,
    documentType: "SENTENCA",
    theme: n.themeLabel,
    themeLabel: n.themeLabel,
    title: `${n.themeLabel} — Sentença`,
    caseDescription: desc,
  };
  if (n.jurisprudencias) result.jurisprudencias = n.jurisprudencias;
  // Instrução base da variação de mérito (sem trap, ou como fallback quando o trap não sobrescreve)
  if (n.sentencaInstruction) result.instruction = n.sentencaInstruction;
  if (trap) {
    const t = applyTrap(
      { description: desc, instruction: n.sentencaInstruction, expectedRulesIfTrap: [] },
      trap, n.area, "SENTENCA",
    );
    result.caseDescription = t.description;
    result.instruction = t.instruction;
    result.trap = trap;
    result.expectedRulesIfTrap = t.expectedRulesIfTrap;
  }
  return result;
}

function buildDespachoFromTheme(n: ThemeNarrative, i: number, trap?: TrapKind): SyntheticCase {
  const desc = `Juiz deve emitir despacho de impulso processual nos autos de ação ajuizada por ${n.autor} em face de ${n.reu} (${n.comarca}). Objeto: ${n.pedido}. Contexto: ${n.fatos} O despacho deve determinar providências processuais sem decidir o mérito da causa.`;
  const result: SyntheticCase = {
    id: `${n.themeLabel.toLowerCase().replace(/\W+/g, "_")}_despacho_${i}`,
    area: n.area,
    documentType: "DESPACHO",
    theme: n.themeLabel,
    themeLabel: n.themeLabel,
    title: `${n.themeLabel} — Despacho`,
    caseDescription: desc,
  };
  if (trap) {
    const t = applyTrap({ description: desc, expectedRulesIfTrap: [] }, trap, n.area, "DESPACHO");
    result.caseDescription = t.description;
    result.instruction = t.instruction;
    result.trap = trap;
    result.expectedRulesIfTrap = t.expectedRulesIfTrap;
  }
  return result;
}

export const PHASE_BUILDERS: Record<
  "PETICAO_INICIAL" | "RECURSO" | "DECISAO" | "SENTENCA" | "DESPACHO",
  (n: ThemeNarrative, i: number, trap?: TrapKind) => SyntheticCase
> = {
  PETICAO_INICIAL: buildInicial,
  RECURSO: buildRecurso,
  DECISAO: buildDecisao,
  SENTENCA: buildSentenca,
  DESPACHO: buildDespachoFromTheme,
};

// ── Templates de despacho ─────────────────────────────────────────────────────

const DESPACHO_TEMPLATES = [
  (i: number): SyntheticCase => ({
    id: `desp_intimacao_${i}`,
    area: "CIVEL",
    documentType: "DESPACHO",
    theme: "Despacho — Intimação de partes",
    themeLabel: "Despacho — Intimação",
    title: `Despacho — Intimação para audiência`,
    caseDescription: `Juiz deve emitir despacho de impulso processual nos autos ${processo(i, "estadual")} para intimar as partes ${pick(NOMES, i)} e ${pick(NOMES, i + 5)} sobre a designação de audiência de conciliação em ${dateBack(-1, i)}.`,
  }),
  (i: number): SyntheticCase => ({
    id: `desp_pericia_${i}`,
    area: "RGPS",
    documentType: "DESPACHO",
    theme: "Despacho — Pericial",
    themeLabel: "Despacho — Perícia",
    title: `Despacho — Designação de perícia médica`,
    caseDescription: `Em ação previdenciária movida por ${pick(NOMES, i)} contra o INSS (autos ${processo(i, "federal")}), o juiz deve emitir despacho designando perícia médica e intimando as partes para apresentação de quesitos.`,
  }),
  (i: number): SyntheticCase => ({
    id: `desp_juntada_${i}`,
    area: "CIVEL",
    documentType: "DESPACHO",
    theme: "Despacho — Juntada de documentos",
    themeLabel: "Despacho — Juntada",
    title: `Despacho — Juntada e vista`,
    caseDescription: `Nos autos ${processo(i, "estadual")}, o juiz determina a juntada dos documentos protocolados e dá vista à parte contrária pelo prazo legal.`,
  }),
  (i: number): SyntheticCase => ({
    id: `desp_emendar_${i}`,
    area: "CIVEL",
    documentType: "DESPACHO",
    theme: "Despacho — Emenda à inicial",
    themeLabel: "Despacho — Emenda",
    title: `Despacho — Determinar emenda à inicial`,
    caseDescription: `Inicial protocolada por ${pick(NOMES, i)} apresenta vícios formais (endereço incompleto, valor da causa incorreto). O juiz deve emitir despacho determinando a emenda no prazo de 15 dias (art. 321 CPP/CPC), sem analisar mérito.`,
  }),
  (i: number): SyntheticCase => ({
    id: `desp_audiencia_${i}`,
    area: "TRABALHISTA",
    documentType: "DESPACHO",
    theme: "Despacho — Designação de audiência",
    themeLabel: "Despacho — Audiência",
    title: `Despacho — Audiência una`,
    caseDescription: `Reclamação trabalhista (autos ${processo(i, "trabalho")}) entre ${pick(NOMES, i)} e ${pick(EMPRESAS, i).nome}. O juiz designa audiência una e intima as partes, sem antecipar análise de mérito.`,
  }),
];

export function buildDespacho(i: number, trap?: TrapKind): SyntheticCase {
  const template = DESPACHO_TEMPLATES[i % DESPACHO_TEMPLATES.length]!;
  const c = template(i);
  if (trap === "LINGUAGEM_DECISORIA") {
    const t = applyTrap(
      { description: c.caseDescription, expectedRulesIfTrap: [] },
      "LINGUAGEM_DECISORIA",
      c.area,
      "DESPACHO",
    );
    c.instruction = t.instruction;
    c.trap = "LINGUAGEM_DECISORIA";
    c.expectedRulesIfTrap = t.expectedRulesIfTrap;
  }
  return c;
}

// ── Criminal de mérito (CRIMINAL_MERITO) ──────────────────────────────────────
//
// 8 temas de ação penal com julgamento do mérito (ABSOLVO / CONDENO).
// Cada tema mapeia para uma variação de resultado na fase SENTENÇA:
//   A = Condenação simples
//   B = Absolvição por insuficiência de provas (art. 386, VII, CPP)
//   C = Desclassificação para tipo penal mais brando
//   D = Prescrição (extinção da punibilidade — art. 107, IV, CP)
//   E = Condenação com atenuante de confissão (art. 65, III, d, CP)
//   F = Condenação com agravante de reincidência (art. 61, I, CP)
//
// Todos os 4 tipos de peça são compatíveis (ação penal tem SENTENÇA).

// Estrutura obrigatória de sentença criminal de mérito — base para todas as variações
const CRIMINAL_MERIT_BASE = `SENTENÇA CRIMINAL DE MÉRITO — estrutura obrigatória:
I. RELATÓRIO: partes, crime imputado, histórico da instrução, provas produzidas.
II. FUNDAMENTAÇÃO:
   1. Materialidade: provas objetivas do crime (laudo pericial, BO, documentos, câmeras).
   2. Autoria: provas subjetivas (reconhecimento, testemunhos, confissão, flagrante).
   3. Tipicidade, ilicitude e culpabilidade — verificar elementares do tipo.
   4. Teses defensivas: responder CADA argumento da defesa com contraponto fundamentado.
III. DISPOSITIVO:
   • CONDENO ou ABSOLVO (indicar inciso do art. 386 CPP na absolvição).
   Se CONDENAÇÃO — itens obrigatórios:
   • Dosimetria em 3 fases (arts. 59 e 68 CP):
     1ª fase: pena-base pelas 8 circunstâncias do art. 59 CP.
     2ª fase: atenuantes (art. 65 CP) / agravantes (art. 61 CP).
     3ª fase: causas de diminuição / aumento.
   • Regime inicial de cumprimento (art. 33 CP): fechado/semiaberto/aberto.
   • Substituição (art. 44 CP) ou sursis (art. 77 CP) se cabível; negar fundamentadamente se não.
   • Detração (art. 387 §2º CPP) se houver prisão provisória.
   • Direito de apelar em liberdade ou preso (art. 387 §1º CPP).
IV. CUSTAS: art. 804 CPP (condenado paga; absolvido isento).
V. RECURSO: Apelação Criminal (art. 593, I, CPP) — 5 dias para interpor + 8 dias para razões.
   ✗ NUNCA usar art. 85 CPC; ✗ NUNCA usar Apelação Cível.`;

function buildVariation(variation: "A" | "B" | "C" | "D" | "E" | "F"): string {
  switch (variation) {
    case "A": return `${CRIMINAL_MERIT_BASE}
VARIAÇÃO A — CONDENAÇÃO SIMPLES:
Materialidade e autoria são provadas com clareza. Rejeitar todas as teses defensivas.
Dosimetria: sem agravantes/atenuantes na 2ª fase; sem causas especiais na 3ª fase.
Dispositivo: CONDENO o réu [nome] à pena de [X anos] de reclusão/detenção, em regime [inicial].`;

    case "B": return `${CRIMINAL_MERIT_BASE}
VARIAÇÃO B — ABSOLVIÇÃO POR INSUFICIÊNCIA DE PROVAS:
A autoria é controvertida: testemunhos contraditórios, ausência de prova direta ou dúvida razoável.
Princípio: in dubio pro reo (art. 386, VII, CPP).
Dispositivo: ABSOLVO o réu [nome] com fundamento no art. 386, VII, do CPP.
Levantar medidas cautelares porventura decretadas. Custas pelo Estado.`;

    case "C": return `${CRIMINAL_MERIT_BASE}
VARIAÇÃO C — DESCLASSIFICAÇÃO para tipo penal menos grave:
Analisar o elemento diferenciador que separa o tipo imputado do tipo mais brando:
• Roubo→Furto: ausência de violência ou grave ameaça comprovada.
• Tráfico→Uso pessoal: dúvida sobre a destinação da droga.
• Homicídio doloso→Culposo: ausência de dolo de matar.
Após desclassificação, refazer a dosimetria pelo novo tipo.
Dispositivo: CONDENO o réu [nome] pela prática do art. [X-desclassificado] CP.`;

    case "D": return `${CRIMINAL_MERIT_BASE}
VARIAÇÃO D — EXTINÇÃO DA PUNIBILIDADE PELA PRESCRIÇÃO:
Calcular com precisão:
1. Pena máxima em abstrato → prazo prescricional (art. 109 CP).
2. Marcos interruptivos (art. 117 CP): recebimento da denúncia, sentença condenatória, etc.
3. Verificar prescrição retroativa (art. 110 §1º CP) pela pena concreta presumida.
Demonstrar que o prazo prescricional transcorreu entre dois marcos.
Dispositivo: JULGO EXTINTA A PUNIBILIDADE do réu [nome] pela prescrição da pretensão punitiva
(art. 107, IV, do CP). Sem condenação em custas.`;

    case "E": return `${CRIMINAL_MERIT_BASE}
VARIAÇÃO E — CONDENAÇÃO COM ATENUANTE DE CONFISSÃO ESPONTÂNEA:
O réu confessou espontaneamente o crime perante autoridade policial e ratificou em juízo.
2ª fase da dosimetria: aplicar atenuante do art. 65, III, d, CP — reduzir a pena-base.
Observar Súmula 231 STJ: a atenuante não pode reduzir a pena abaixo do mínimo legal.
Mencionar que a confissão foi determinante para a condenação (prova corroborante).
Dispositivo: CONDENO o réu [nome] com pena atenuada pela confissão (art. 65, III, d, CP).`;

    case "F": return `${CRIMINAL_MERIT_BASE}
VARIAÇÃO F — CONDENAÇÃO COM AGRAVANTE DE REINCIDÊNCIA:
Reincidência comprovada por certidão de antecedentes criminais (trânsito em julgado anterior).
2ª fase: aplicar agravante do art. 61, I, CP — aumentar a pena-base proporcionalmente.
Regime inicial: reincidente não inicia em regime aberto (art. 33 §2º c CP); analisar semiaberto ou fechado.
Substituição: vedada para reincidente específico (art. 44, II, CP); analisar caso a caso.
Dispositivo: CONDENO o réu [nome] com pena agravada pela reincidência (art. 61, I, CP).`;
  }
}

// Jurisprudências para temas de mérito criminal
const JUR_TRAFICO_ABSOLVICAO: JurisprudenciaInput = {
  id: "jur_trafico_absolvicao_dubio",
  tribunal: "STJ", numero: "HC 567.890/SP",
  tema: "Tráfico — absolvição por dúvida na destinação",
  ementa: "Deve-se absolver quando a destinação da droga (uso pessoal × tráfico) não é provada com certeza, aplicando-se o in dubio pro reo (art. 386, VII, CPP).",
  tese: "Absolvição por dúvida na destinação",
  relator: "Min. Joel Ilan Paciornik", dataJulgamento: "2020-04-15",
};
const JUR_PRESCRICAO_RETROATIVA: JurisprudenciaInput = {
  id: "jur_prescricao_retroativa_conc",
  tribunal: "STJ", numero: "REsp 1.801.234/MG",
  tema: "Prescrição retroativa — pena concreta",
  ementa: "A prescrição retroativa é calculada pela pena em concreto fixada na sentença, observando-se os marcos interruptivos do art. 117 CP.",
  tese: "Prescrição retroativa pela pena concreta",
  relator: "Min. Sebastião Reis Júnior", dataJulgamento: "2021-03-10",
};

// ── 8 ThemeBuilders de mérito criminal ───────────────────────────────────────

const tCmTraficoDrogas: ThemeBuilder = (i) => ({
  area: "CRIMINAL_MERITO",
  themeLabel: "Tráfico de drogas",
  autor: "Ministério Público",
  reu: pick(NOMES, i),
  comarca: pick(COMARCAS, i),
  fatos: `${pick(NOMES, i)} (CPF ${cpf(i + 2000)}) foi preso em flagrante em ${dateBack(0, i)} transportando ${20 + (i % 80)}g de cloridrato de cocaína fracionados em ${30 + (i % 20)} embalagens plásticas individuais. Laudo pericial nº ${1000 + i} confirmou a natureza e quantidade da substância. Material apreendido foi filmado pelos policiais militares. Réu não apresentou justificativa plausível para a posse. Depoimentos dos policiais são consistentes. Sem registro de consumo pessoal anterior. Defesa alega que o réu seria usuário, não traficante, e requer desclassificação para o art. 28 da Lei 11.343/06.`,
  pedido: "condenação pela prática do art. 33 da Lei 11.343/06",
  norma: "art. 33 da Lei 11.343/2006",
  jurisprudencias: [JUR_TRAFICO_ABSOLVICAO],
  sentencaInstruction: buildVariation("A"),
});

const tCmFurtoQualificado: ThemeBuilder = (i) => ({
  area: "CRIMINAL_MERITO",
  themeLabel: "Furto qualificado",
  autor: "Ministério Público",
  reu: pick(NOMES, i + 1),
  comarca: pick(COMARCAS, i + 1),
  fatos: `${pick(NOMES, i + 1)} (CPF ${cpf(i + 2100)}) foi denunciado pelo crime de furto qualificado por arrombamento (art. 155 §4º, I, CP) de residência em ${pick(COMARCAS, i + 1)} em ${dateBack(1, i)}. Laudo de perícia confirmou arrombamento da porta. Porém: (a) nenhuma testemunha presenciou o furto; (b) reconhecimento feito pela vítima em sede policial sem álbum fotográfico formal, apenas em fotografia enviada por aplicativo; (c) nenhum bem furtado foi localizado com o réu; (d) réu apresenta álibi parcialmente corroborado. Defesa sustenta autoria incerta e nulidade do reconhecimento.`,
  pedido: "condenação pela prática do art. 155 §4º, I, do CP",
  norma: "art. 155 §4º, I, do Código Penal",
  sentencaInstruction: buildVariation("B"),
});

const tCmRoubo: ThemeBuilder = (i) => ({
  area: "CRIMINAL_MERITO",
  themeLabel: "Roubo (desclassificação para furto)",
  autor: "Ministério Público",
  reu: pick(NOMES, i + 2),
  comarca: pick(COMARCAS, i + 2),
  fatos: `${pick(NOMES, i + 2)} (CPF ${cpf(i + 2200)}) foi denunciado por roubo simples (art. 157 CP) pela subtração de celular em ${dateBack(0, i)}. Câmera de segurança registrou o ato. Vítima relata que o réu "se aproximou rapidamente e tomou o celular sem que ela pudesse reagir". Réu não usou arma, não profferiu palavras ameaçadoras explícitas e não houve lesão física. Controvérsia: a conduta configura grave ameaça implícita (roubo) ou mera subtração aproveitando descuido (furto)? Defesa pede desclassificação para furto por ausência de violência ou grave ameaça.`,
  pedido: "condenação pela prática do art. 157 CP, ou subsidiariamente, desclassificação para o art. 155 CP",
  norma: "art. 157 do Código Penal (subsidiariamente: art. 155 CP)",
  sentencaInstruction: buildVariation("C"),
});

const tCmHomicidioSimples: ThemeBuilder = (i) => ({
  area: "CRIMINAL_MERITO",
  themeLabel: "Homicídio simples — prescrição",
  autor: "Ministério Público",
  reu: pick(NOMES, i + 3),
  comarca: pick(COMARCAS, i + 3),
  fatos: `${pick(NOMES, i + 3)} (CPF ${cpf(i + 2300)}) foi denunciado pelo crime de homicídio simples (art. 121 CP) ocorrido em ${dateBack(14, i)}. Pena máxima em abstrato: 20 anos. Prazo prescricional: 20 anos (art. 109, I, CP). Recebimento da denúncia: ${dateBack(12, i)}. Instrução encerrada em ${dateBack(1, i)}. Réu primário, sem antecedentes criminais. Pena concreta provável: entre 6 e 8 anos (circunstâncias favoráveis). Prazo prescricional pela pena concreta de 8 anos: 12 anos (art. 109, III, CP). Verificar se 12 anos transcorreram entre o crime (${dateBack(14, i)}) e o recebimento da denúncia (${dateBack(12, i)}).`,
  pedido: "condenação pela prática do art. 121 do CP",
  norma: "art. 121 do Código Penal",
  jurisprudencias: [JUR_PRESCRICAO_RETROATIVA, JUR_SUPERADO_CRIMINAL],
  sentencaInstruction: buildVariation("D"),
});

const tCmReceptacao: ThemeBuilder = (i) => ({
  area: "CRIMINAL_MERITO",
  themeLabel: "Receptação — confissão espontânea",
  autor: "Ministério Público",
  reu: pick(NOMES, i + 4),
  comarca: pick(COMARCAS, i + 4),
  fatos: `${pick(NOMES, i + 4)} (CPF ${cpf(i + 2400)}) foi preso portando veículo com número de chassi adulterado (receptação qualificada, art. 180 §1º CP). Laudo pericial confirmou a adulteração. O réu confessou espontaneamente na delegacia e ratificou a confissão em juízo: adquiriu o veículo sabendo da procedência ilícita pelo valor de ${brl(8000 + i * 500)}, metade do valor de mercado. Confissão corroborada pelos depoimentos dos agentes policiais e pelo laudo pericial. Réu primário, emprego fixo, residência conhecida.`,
  pedido: "condenação pela prática do art. 180 §1º do CP",
  norma: "art. 180 §1º do Código Penal",
  sentencaInstruction: buildVariation("E"),
});

const tCmLesaoVD: ThemeBuilder = (i) => ({
  area: "CRIMINAL_MERITO",
  themeLabel: "Lesão corporal — violência doméstica (reincidência)",
  autor: "Ministério Público",
  reu: pick(NOMES, i + 5),
  comarca: pick(COMARCAS, i + 5),
  fatos: `${pick(NOMES, i + 5)} (CPF ${cpf(i + 2500)}) foi denunciado por lesão corporal em contexto de violência doméstica (art. 129 §9º CP c/c Lei 11.340/06) contra ex-cônjuge em ${dateBack(0, i)}. Laudo de lesões corporais confirma escoriações e contusões. Vítima realizou reconhecimento pessoal formal. Há boletim de ocorrência anterior por violência doméstica praticada pelo mesmo réu contra a mesma vítima, com sentença condenatória transitada em julgado há ${2 + (i % 3)} anos → réu reincidente específico em violência doméstica.`,
  pedido: "condenação pela prática do art. 129 §9º do CP c/c Lei 11.340/06",
  norma: "art. 129 §9º do CP c/c Lei 11.340/06 (Lei Maria da Penha)",
  sentencaInstruction: buildVariation("F"),
});

const tCmEstelionato: ThemeBuilder = (i) => ({
  area: "CRIMINAL_MERITO",
  themeLabel: "Estelionato",
  autor: "Ministério Público",
  reu: pick(NOMES, i + 6),
  comarca: pick(COMARCAS, i + 6),
  fatos: `${pick(NOMES, i + 6)} (CPF ${cpf(i + 2600)}) foi denunciado por estelionato (art. 171 CP): apresentou documentos falsos (RG e CPF de terceiro) para obter empréstimo bancário de ${brl(40000 + i * 2000)} da instituição ${pick(["Caixa Econômica Federal", "Banco do Brasil", "Bradesco"], i)}. Laudo de documentoscopia confirma a falsificação. Extratos bancários comprovam o recebimento e movimentação do valor pelo réu. Instituição sofreu prejuízo total de ${brl(40000 + i * 2000)}. Defesa alega que o sistema bancário falhou na verificação dos documentos (culpa concorrente), afastando o dolo.`,
  pedido: "condenação pela prática do art. 171 do CP",
  norma: "art. 171 do Código Penal",
  sentencaInstruction: buildVariation("A"),
});

const tCmPorteArma: ThemeBuilder = (i) => ({
  area: "CRIMINAL_MERITO",
  themeLabel: "Porte ilegal de arma de fogo",
  autor: "Ministério Público",
  reu: pick(NOMES, i + 7),
  comarca: pick(COMARCAS, i + 7),
  fatos: `${pick(NOMES, i + 7)} (CPF ${cpf(i + 2700)}) foi denunciado por porte ilegal de arma de fogo (art. 14 Lei 10.826/03). Situação fática: viatura policial abordou veículo com 3 ocupantes, arma de calibre .38 encontrada embaixo do banco do passageiro. Réu estava no banco traseiro. Os outros dois ocupantes fugiram antes da abordagem e não foram identificados. Teste de resíduo de pólvora (GSR) negativo para o réu. Não há prova de que a arma pertencia especificamente ao réu. Dúvida razoável sobre quem portava a arma. Defesa: in dubio pro reo.`,
  pedido: "condenação pela prática do art. 14 da Lei 10.826/03",
  norma: "art. 14 da Lei 10.826/2003 (Estatuto do Desarmamento)",
  sentencaInstruction: buildVariation("B"),
});

// Adiciona os temas de mérito criminal ao THEMES depois que todos os builders
// e constantes foram inicializados (evita temporal dead zone)
THEMES.push(
  { id: "cm_trafico_drogas",      build: tCmTraficoDrogas },
  { id: "cm_furto_qualificado",   build: tCmFurtoQualificado },
  { id: "cm_roubo",               build: tCmRoubo },
  { id: "cm_homicidio_simples",   build: tCmHomicidioSimples },
  { id: "cm_receptacao",          build: tCmReceptacao },
  { id: "cm_lesao_vd",            build: tCmLesaoVD },
  { id: "cm_estelionato",         build: tCmEstelionato },
  { id: "cm_porte_arma",          build: tCmPorteArma },
);

// ── CÍVEL GERAL e CONSUMIDOR ──────────────────────────────────────────────────
//
// 20 temas: 10 cível geral + 10 consumidor.
// Cada tema tem compatibleTypes com UM único tipo de peça (mapeamento direto).
// Traps em ~30% dos casos (6 traps):
//   Casos 1,4 (CIVEL_GERAL): ARTIGO_INCOMPATIVEL (tutela sem periculum) + TESE_EQUIVOCADA (dano moral presumido)
//   Caso 9   (CIVEL_GERAL): RECURSO_INADEQUADO (apelação em vez de agravo)
//   Caso 12  (CONSUMIDOR):  ARTIGO_INCOMPATIVEL (inversão ônus sem fundamento)
//   Caso 16  (CONSUMIDOR):  ARTIGO_INCOMPATIVEL (tutela sem art. 300 + periculum)
//   Caso 18  (CONSUMIDOR):  TESE_EQUIVOCADA (repetição em dobro sem má-fé)

// ── CÍVEL GERAL ───────────────────────────────────────────────────────────────

const tCgObrFazerInicial = (i: number): ThemeNarrative => ({
  area: "CIVEL_GERAL",
  themeLabel: "Obrigação de fazer — tutela de urgência (inicial)",
  autor: pick(NOMES, i),
  reu: pick(EMPRESAS, i).nome,
  comarca: pick(COMARCAS, i),
  fatos: `${pick(NOMES, i)} (CPF ${cpf(i + 3000)}) contratou em ${dateBack(1, i)} com ${pick(EMPRESAS, i).nome} (CNPJ ${pick(EMPRESAS, i).cnpj}) a execução de ${pick(["reforma de imóvel", "instalação de sistema de segurança", "desenvolvimento de software sob medida"], i)} pelo valor de ${brl(25000 + i * 2000)}, com prazo de ${60 + (i % 60)} dias. A empresa recebeu 70% do valor (${brl(17500 + i * 1400)}) adiantado e não cumpriu a obrigação. Requerente sofre prejuízo diário com o atraso. Há risco de perecimento do objeto do contrato.`,
  pedido: "tutela de urgência para compelir a ré a cumprir a obrigação de fazer no prazo de 15 dias, sob pena de multa diária",
  norma: "arts. 300, 497 e 498 do CPC; art. 389 do CC/2002",
});

const tCgObrFazerDecisao = (i: number): ThemeNarrative => ({
  area: "CIVEL_GERAL",
  themeLabel: "Obrigação de fazer — tutela deferida (decisão)",
  autor: pick(NOMES, i + 1),
  reu: pick(EMPRESAS, i + 1).nome,
  comarca: pick(COMARCAS, i + 1),
  fatos: `Juiz deve decidir sobre pedido de tutela de urgência em ação de obrigação de fazer. ${pick(NOMES, i + 1)} ajuizou ação após ${pick(EMPRESAS, i + 1).nome} deixar de entregar ${pick(["obra contratada", "equipamento médico essencial", "serviço de TI crítico"], i)}. Há prova documental do contrato, do pagamento e do inadimplemento. Risco de dano irreparável comprovado por laudo técnico.`,
  pedido: "deferimento da tutela de urgência para compelir a ré a cumprir a obrigação",
  norma: "art. 300 do CPC (tutela de urgência — probabilidade do direito e perigo de dano)",
});

const tCgObrFazerSentenca = (i: number): ThemeNarrative => ({
  area: "CIVEL_GERAL",
  themeLabel: "Obrigação de fazer — sentença",
  autor: pick(NOMES, i + 2),
  reu: pick(EMPRESAS, i + 2).nome,
  comarca: pick(COMARCAS, i + 2),
  fatos: `Ação de obrigação de fazer ajuizada por ${pick(NOMES, i + 2)} em face de ${pick(EMPRESAS, i + 2).nome}. Instrução encerrada. Prova documental robusta: contrato assinado, comprovante de pagamento de ${brl(35000 + i * 1500)} e notificação extrajudicial sem resposta. Réu não comprovou execução da obrigação nem apresentou justificativa válida para o inadimplemento.`,
  pedido: "condenação ao cumprimento da obrigação de fazer, em tutela específica, sob pena de conversão em perdas e danos",
  norma: "arts. 497 e 498 do CPC; art. 389 do CC/2002",
});

const tCgDanosMoraisProcedente = (i: number): ThemeNarrative => ({
  area: "CIVEL_GERAL",
  themeLabel: "Danos morais — sentença procedente",
  autor: pick(NOMES, i + 3),
  reu: pick(EMPRESAS, i + 3).nome,
  comarca: pick(COMARCAS, i + 3),
  fatos: `${pick(NOMES, i + 3)} (CPF ${cpf(i + 3300)}) teve nome inscrito indevidamente em SPC/Serasa pela ${pick(EMPRESAS, i + 3).nome} em ${dateBack(1, i)} por débito inexistente de ${brl(800 + i * 50)}. A inscrição perdurou por ${45 + (i % 60)} dias, impedindo acesso a crédito. Não havia relação contratual entre as partes. Réu confirmou o erro e excluiu a inscrição, mas não indenizou o autor.`,
  pedido: "indenização por danos morais em valor não inferior a R$ 10.000,00",
  norma: "art. 186 e art. 927 do CC/2002; Súmula 385 do STJ",
  jurisprudencias: [JUR_FAVORAVEL_DANOS],
});

const tCgDanosMoraisImprocedente = (i: number): ThemeNarrative => ({
  area: "CIVEL_GERAL",
  themeLabel: "Danos morais — sentença improcedente",
  autor: pick(NOMES, i + 4),
  reu: pick(EMPRESAS, i + 4 > 3 ? 0 : i + 4).nome,
  comarca: pick(COMARCAS, i + 4),
  fatos: `${pick(NOMES, i + 4)} requer indenização por danos morais alegando que foi negativado pelo débito de ${brl(2000 + i * 100)} com ${pick(EMPRESAS, i % 4).nome}. Contudo: (a) o débito existe — contratos juntados pela ré comprovam a inadimplência; (b) autor já possuía outras negativações anteriores (Súmula 385 STJ); (c) não há prova de abalo à honra além do ordinário.`,
  pedido: "indenização por danos morais",
  norma: "art. 186 do CC/2002 — autor ônus de provar dano efetivo",
});

const tCgCobrancaInicial = (i: number): ThemeNarrative => ({
  area: "CIVEL_GERAL",
  themeLabel: "Cobrança contratual — petição inicial",
  autor: pick(NOMES, i + 5),
  reu: pick(NOMES, i + 10),
  comarca: pick(COMARCAS, i + 5),
  fatos: `${pick(NOMES, i + 5)} (CPF ${cpf(i + 3500)}) emprestou em ${dateBack(2, i)} a ${pick(NOMES, i + 10)} (CPF ${cpf(i + 3600)}) o valor de ${brl(30000 + i * 2000)} mediante contrato escrito com testemunhas, com vencimento em ${dateBack(1, i)}. Após vencimento, devedor não pagou mesmo após notificação extrajudicial. Credor busca receber principal + juros legais (art. 406 CC) + honorários.`,
  pedido: "pagamento do principal corrigido pelo IPCA, juros de mora de 1% ao mês desde a citação e honorários advocatícios",
  norma: "arts. 394, 397, 406 e 421 do CC/2002; art. 85 CPC",
});

const tCgCobrancaSentenca = (i: number): ThemeNarrative => ({
  area: "CIVEL_GERAL",
  themeLabel: "Cobrança contratual — sentença",
  autor: pick(NOMES, i + 6),
  reu: pick(NOMES, i + 11),
  comarca: pick(COMARCAS, i + 6),
  fatos: `Ação de cobrança. Instrução encerrada. Contrato juntado comprovando obrigação de ${brl(40000 + i * 3000)}. Réu apresentou defesa alegando pagamento, mas não trouxe comprovante. Prova testemunhal favorável ao autor. Devedor notificado e não pagou.`,
  pedido: "condenação ao pagamento do débito principal com correção e juros",
  norma: "arts. 394, 397 e 406 do CC/2002",
});

const tCgCumprimentoDecisao = (i: number): ThemeNarrative => ({
  area: "CIVEL_GERAL",
  themeLabel: "Cumprimento de sentença — decisão (multa e penhora)",
  autor: pick(NOMES, i + 7),
  reu: pick(NOMES, i + 12),
  comarca: pick(COMARCAS, i + 7),
  fatos: `Fase de cumprimento de sentença. Sentença condenou réu ao pagamento de ${brl(45000 + i * 2500)} + correção. Prazo de 15 dias para pagamento voluntário (art. 523 CPC) transcorreu sem pagamento. Exequente requer multa de 10% (art. 523 §1º CPC), honorários advocatícios de 10% e penhora on-line via BACENJUD.`,
  pedido: "aplicação da multa de 10%, honorários de 10% e expedição de ordem de penhora eletrônica",
  norma: "arts. 523, 524 e 854 do CPC",
});

const tCgAgravoRecurso = (i: number): ThemeNarrative => ({
  area: "CIVEL_GERAL",
  themeLabel: "Agravo de instrumento — recurso contra negativa de tutela",
  autor: pick(NOMES, i + 8),
  reu: pick(EMPRESAS, i + 2).nome,
  comarca: pick(COMARCAS, i + 8),
  fatos: `Juiz de 1º grau indeferiu pedido de tutela de urgência por insuficiência de prova do periculum in mora. Parte agravante (${pick(NOMES, i + 8)}) pretende reformar a decisão interlocutória. A decisão é do tipo que comporta agravo de instrumento nos termos do art. 1.015, I, do CPC. Prazo de 15 dias para interposição. Há urgência comprovada por documentos adicionais.`,
  pedido: "reforma da decisão interlocutória que indeferiu a tutela de urgência",
  norma: "art. 1.015, I, do CPC (agravo de instrumento contra tutela de urgência)",
});

const tCgDespachoEmenda = (i: number): ThemeNarrative => ({
  area: "CIVEL_GERAL",
  themeLabel: "Despacho — emenda à inicial",
  autor: pick(NOMES, i + 9),
  reu: pick(EMPRESAS, i + 3).nome,
  comarca: pick(COMARCAS, i + 9),
  fatos: `Petição inicial protocolada apresenta vícios formais: (a) endereço completo do réu não indicado; (b) valor da causa calculado incorretamente; (c) documentos essenciais não juntados. Juiz deve emitir despacho determinando emenda no prazo de 15 dias (art. 321 CPC), sem antecipar análise do mérito. A inicial não deve ser indeferida de plano.`,
  pedido: "emenda à petição inicial para sanar vícios formais",
  norma: "art. 321 do CPC (emenda à petição inicial — prazo 15 dias)",
});

// ── CONSUMIDOR ────────────────────────────────────────────────────────────────

const tCsNegativacaoInicial = (i: number): ThemeNarrative => ({
  area: "CONSUMIDOR",
  themeLabel: "Negativação indevida — petição inicial (CDC)",
  autor: pick(NOMES, i),
  reu: pick(EMPRESAS, i).nome,
  comarca: pick(COMARCAS, i),
  fatos: `${pick(NOMES, i)} (CPF ${cpf(i + 4000)}) teve nome inscrito indevidamente em SPC/Serasa por ${pick(EMPRESAS, i).nome} (CNPJ ${pick(EMPRESAS, i).cnpj}) em ${dateBack(0, i)}, por suposto débito de ${brl(500 + i * 30)} (contrato jamais celebrado). Autor é consumidor, ré é fornecedora. CDC é aplicável. Houve dano moral pela restrição de crédito.`,
  pedido: "declaração de inexistência do débito, exclusão da negativação e indenização por danos morais",
  norma: "art. 6º, VI, e art. 43 do CDC; arts. 186 e 927 do CC/2002",
  jurisprudencias: [JUR_FAVORAVEL_DANOS],
});

const tCsNegativacaoSentencaProc = (i: number): ThemeNarrative => ({
  area: "CONSUMIDOR",
  themeLabel: "Negativação indevida — sentença procedente",
  autor: pick(NOMES, i + 1),
  reu: pick(EMPRESAS, i + 1).nome,
  comarca: pick(COMARCAS, i + 1),
  fatos: `Ação consumerista de indenização. Negativação indevida comprovada: ré reconheceu erro e excluiu o apontamento durante o processo. Relação de consumo demonstrada. Autor sem outras negativações (Súmula 385 STJ). Dano moral decorre do abalo ao crédito e ao nome. Réu não trouxe prova de eventual exclusão tempestiva ou de inexistência do dano.`,
  pedido: "condenação em danos morais e declaração de inexistência do débito",
  norma: "arts. 6º, VI, e 14 do CDC; arts. 186 e 927 do CC/2002",
  jurisprudencias: [JUR_FAVORAVEL_DANOS],
});

const tCsNegativacaoSentencaImproc = (i: number): ThemeNarrative => ({
  area: "CONSUMIDOR",
  themeLabel: "Negativação regular — sentença improcedente",
  autor: pick(NOMES, i + 2),
  reu: pick(EMPRESAS, i + 2).nome,
  comarca: pick(COMARCAS, i + 2),
  fatos: `Autor requer indenização por danos morais alegando negativação indevida. Porém: (a) o débito de ${brl(1200 + i * 100)} é regular — contrato comprovado; (b) inadimplência do autor demonstrada; (c) autor possui outras negativações anteriores ao ato da ré (Súmula 385 STJ). Negativação regular não gera dano moral indenizável.`,
  pedido: "indenização por danos morais por negativação tida como indevida",
  norma: "Súmula 385 STJ — outras negativações afastam o dano moral",
});

const tCsProdutoVicioInicial = (i: number): ThemeNarrative => ({
  area: "CONSUMIDOR",
  themeLabel: "Produto com vício — petição inicial (CDC art. 18)",
  autor: pick(NOMES, i + 3),
  reu: pick(EMPRESAS, i + 3).nome,
  comarca: pick(COMARCAS, i + 3),
  fatos: `${pick(NOMES, i + 3)} adquiriu em ${dateBack(1, i)} produto da ${pick(EMPRESAS, i + 3).nome} pelo valor de ${brl(3500 + i * 500)} (nota fiscal juntada). O produto apresentou vício de fabricação em ${dateBack(0, i)}, dentro do prazo de garantia legal. Ré foi notificada mas não sanou o vício no prazo de 30 dias do art. 18 §1º do CDC. Autor tem direito à substituição, restituição ou abatimento.`,
  pedido: "restituição integral do valor pago ou substituição do produto sem vício",
  norma: "art. 18 e art. 26 do CDC (garantia legal de produto)",
});

const tCsProdutoVicioSentenca = (i: number): ThemeNarrative => ({
  area: "CONSUMIDOR",
  themeLabel: "Produto com vício — sentença",
  autor: pick(NOMES, i + 4),
  reu: pick(EMPRESAS, i % 4).nome,
  comarca: pick(COMARCAS, i + 4),
  fatos: `Ação consumerista por vício de produto. Instrução encerrada. Laudo pericial confirmou o vício de fabricação. Ré não sanou o vício no prazo legal de 30 dias (art. 18 §1º CDC). Relação de consumo evidente. Autor tem direito à escolha entre substituição do produto, restituição do valor ou abatimento proporcional do preço.`,
  pedido: "condenação à restituição do valor pago pelo produto viciado",
  norma: "arts. 18 e 20 do CDC",
});

const tCsPlanoSaudeTutela = (i: number): ThemeNarrative => ({
  area: "CONSUMIDOR",
  themeLabel: "Plano de saúde negando tratamento — tutela de urgência (decisão)",
  autor: pick(NOMES, i + 5),
  reu: "Operadora de Plano de Saúde",
  comarca: pick(COMARCAS, i + 5),
  fatos: `Juiz deve decidir sobre tutela de urgência. ${pick(NOMES, i + 5)} é beneficiário de plano de saúde e necessita de ${pick(["cirurgia oncológica urgente", "tratamento de quimioterapia prescrito por oncologista", "procedimento cirúrgico cardíaco de urgência"], i)} prescrito por médico credenciado. O plano negou cobertura alegando cláusula de exclusão. Laudo médico atesta urgência e risco à vida em ${7 + i % 14} dias. Há verossimilhança e urgência comprovadas.`,
  pedido: "tutela de urgência para custeio imediato do procedimento médico negado",
  norma: "art. 300 CPC; arts. 47 e 51 do CDC; Resolução ANS n. 465/2021",
});

const tCsBancoCobrancaInicial = (i: number): ThemeNarrative => ({
  area: "CONSUMIDOR",
  themeLabel: "Banco — cobrança indevida — petição inicial",
  autor: pick(NOMES, i + 6),
  reu: pick(["Banco do Brasil S.A.", "Itaú Unibanco S.A.", "Caixa Econômica Federal", "Santander Brasil S.A."], i),
  comarca: pick(COMARCAS, i + 6),
  fatos: `${pick(NOMES, i + 6)} (CPF ${cpf(i + 4600)}) teve cobrados indevidamente ${brl(800 + i * 50)}/mês durante ${3 + i % 9} meses a título de ${pick(["tarifa de manutenção de conta cancelada", "seguro não contratado", "taxa de serviço não solicitado"], i)}, totalizando ${brl((800 + i * 50) * (3 + i % 9))}. Extrato bancário comprova as cobranças indevidas. Consumidor não autorizou os descontos.`,
  pedido: "devolução em dobro dos valores cobrados indevidamente e indenização por danos morais",
  norma: "art. 42, parágrafo único, do CDC; arts. 186 e 927 do CC/2002",
});

const tCsBancoCobrancaSentenca = (i: number): ThemeNarrative => ({
  area: "CONSUMIDOR",
  themeLabel: "Banco — cobrança indevida — sentença",
  autor: pick(NOMES, i + 7),
  reu: pick(["Banco Bradesco S.A.", "Nubank S.A.", "Banco Inter S.A."], i),
  comarca: pick(COMARCAS, i + 7),
  fatos: `Ação consumerista contra banco. Instrução encerrada. Prova documental comprova cobranças indevidas de ${brl(1200 + i * 100)}/mês por ${2 + i % 6} meses (total: ${brl((1200 + i * 100) * (2 + i % 6))}). Banco não comprovou autorização ou base contratual para as cobranças. Relação de consumo incontroversa.`,
  pedido: "devolução em dobro dos valores indevidamente cobrados",
  norma: "art. 42, parágrafo único, do CDC (devolução em dobro por cobrança indevida)",
});

const tCsApelacaoConsumidor = (i: number): ThemeNarrative => ({
  area: "CONSUMIDOR",
  themeLabel: "Apelação consumerista — recurso contra improcedência",
  autor: pick(NOMES, i + 8),
  reu: pick(EMPRESAS, i + 1).nome,
  comarca: pick(COMARCAS, i + 8),
  fatos: `Sentença julgou improcedente a ação consumerista de ${pick(NOMES, i + 8)} contra ${pick(EMPRESAS, i + 1).nome}. Apelante entende que: (a) o CDC era aplicável e não foi reconhecido; (b) a inversão do ônus da prova deveria ter sido aplicada; (c) a sentença não analisou o vício do produto/serviço devidamente. Prazo de apelação: 15 dias úteis (art. 1.003, §5º CPC).`,
  pedido: "reforma da sentença para julgamento procedente dos pedidos da inicial",
  norma: "art. 1.009 do CPC (apelação contra sentença); art. 6º, VIII, do CDC (inversão do ônus)",
});

const tCsDespachoProvas = (i: number): ThemeNarrative => ({
  area: "CONSUMIDOR",
  themeLabel: "Despacho — especificação de provas (ação consumerista)",
  autor: pick(NOMES, i + 9),
  reu: pick(EMPRESAS, i + 2).nome,
  comarca: pick(COMARCAS, i + 9),
  fatos: `Ação consumerista em fase de especificação de provas. Juiz deve emitir despacho ordenando que as partes especifiquem as provas que pretendem produzir, indicando rol de testemunhas (art. 357 CPC), prazos para juntada de documentos e eventuais pedidos de perícia. Despacho deve ser conciso e sem antecipar análise do mérito.`,
  pedido: "especificação de provas para instrução do feito",
  norma: "arts. 357 e 370 do CPC (especificação de provas — despacho de impulso processual)",
});

// ── EXECUÇÃO / CUMPRIMENTO ────────────────────────────────────────────────────
//
// 5 temas × 4 fases (ALL_PHASES) = 20 casos.
// Cobertura:
//   ec_cumprimento_sentenca — cumprimento de sentença (art. 523 CPC)
//   ec_execucao_titulo       — execução de título extrajudicial (art. 784 CPC)
//   ec_impugnacao            — impugnação ao cumprimento (art. 525 CPC)
//   ec_embargos              — embargos à execução (art. 914 CPC)
//   ec_sisbajud              — penhora eletrônica on-line via SISBAJUD (art. 854 CPC)

const tEcCumprimentoSentenca: ThemeBuilder = (i) => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Cumprimento de sentença",
  autor: pick(NOMES, i),
  reu: pick(NOMES, i + 5),
  comarca: pick(COMARCAS, i),
  fatos: `Exequente (CPF ${cpf(i + 5000)}) obteve sentença favorável condenando ${pick(NOMES, i + 5)} ao pagamento de ${brl(55000 + i * 4000)} corrigidos pelo IPCA. Sentença transitou em julgado em ${dateBack(0, i)}. Intimado(a) para pagar no prazo legal de 15 dias (art. 523 CPC), o(a) executado(a) permaneceu inerte. Nenhum bem foi indicado voluntariamente. Exequente requer aplicação de multa, honorários e penhora.`,
  pedido: "aplicação da multa de 10%, honorários advocatícios de 10% e expedição de ordem de penhora eletrônica via SISBAJUD (art. 854 CPC)",
  norma: "arts. 523, 524, 525 e 854 do CPC/2015",
});

const tEcExecucaoTitulo: ThemeBuilder = (i) => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Execução de título extrajudicial",
  autor: pick(NOMES, i + 1),
  reu: pick(NOMES, i + 6),
  comarca: pick(COMARCAS, i + 1),
  fatos: `${pick(NOMES, i + 1)} (CPF ${cpf(i + 5100)}) é credor de ${pick(NOMES, i + 6)} (CPF ${cpf(i + 5200)}) por força de ${pick(["cheque", "nota promissória", "contrato de mútuo com garantia"], i)} no valor de ${brl(28000 + i * 3000)}, vencido em ${dateBack(1, i)}, protestado em ${dateBack(0, i)}. Devedor não pagou nem apresentou bens para penhora após notificação extrajudicial.`,
  pedido: "execução do título extrajudicial com citação do executado para pagar em 3 dias ou nomear bens à penhora",
  norma: "arts. 783, 784 e 829 do CPC/2015",
});

const tEcImpugnacao: ThemeBuilder = (i) => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Impugnação ao cumprimento de sentença",
  autor: pick(NOMES, i + 2),
  reu: pick(NOMES, i + 7),
  comarca: pick(COMARCAS, i + 2),
  fatos: `${pick(NOMES, i + 2)} (CPF ${cpf(i + 5300)}) é executado em cumprimento de sentença que o(a) condenou ao pagamento de ${brl(42000 + i * 2000)}. O(A) exequente apresentou memória de cálculo com valor divergente: ${brl(62000 + i * 2000)}. A diferença decorre de aplicação indevida de taxa SELIC em dobro no período de ${dateBack(1, i)} a ${dateBack(0, i)}. Executado impugna o excesso de execução nos termos do art. 525 §1º, V, CPC, requerendo efeito suspensivo.`,
  pedido: "acolhimento da impugnação ao cumprimento de sentença por excesso de execução, com reconhecimento do valor correto de R$ 42.000,00 e efeito suspensivo",
  norma: "arts. 525, §1º, V, e §6º do CPC/2015 (impugnação ao cumprimento — excesso de execução)",
});

const tEcEmbargos: ThemeBuilder = (i) => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Embargos à execução",
  autor: pick(NOMES, i + 3),
  reu: pick(NOMES, i + 8),
  comarca: pick(COMARCAS, i + 3),
  fatos: `${pick(NOMES, i + 3)} (CPF ${cpf(i + 5400)}) foi citado em execução de título extrajudicial (${pick(["cheque sem fundo", "contrato de mútuo", "nota promissória"], i)}) no valor de ${brl(35000 + i * 2500)}, protestado em ${dateBack(2, i)}. O executado opõe embargos alegando: (a) ${pick(["prescrição do título cambiário — emissão anterior a 3 anos", "pagamento parcial comprovado por recibos", "novação extintiva da obrigação original"], i)}; (b) nulidade formal do título por ausência de requisito essencial. Possui documentos comprobatórios da defesa.`,
  pedido: "acolhimento dos embargos para extinção ou redução da execução com efeito suspensivo (art. 919 §1º CPC)",
  norma: "arts. 914, 917 e 919 do CPC/2015 (embargos à execução de título extrajudicial)",
});

const tEcSisbajud: ThemeBuilder = (i) => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Penhora eletrônica — SISBAJUD",
  autor: pick(NOMES, i + 4),
  reu: pick(EMPRESAS, i).nome,
  comarca: pick(COMARCAS, i + 4),
  fatos: `${pick(NOMES, i + 4)} (CPF ${cpf(i + 5500)}) é exequente em cumprimento de sentença contra ${pick(EMPRESAS, i).nome} (CNPJ ${pick(EMPRESAS, i).cnpj}) pelo valor de ${brl(80000 + i * 5000)}. Executada não pagou no prazo legal de 15 dias nem indicou bens (art. 523 CPC). Nenhum patrimônio imóvel ou móvel localizado após busca. Exequente requer bloqueio eletrônico de ativos financeiros via SISBAJUD, com fulcro no art. 854 CPC, e, subsidiariamente, medidas executivas atípicas com base no poder geral de efetivação (art. 139, IV, CPC).`,
  pedido: "expedição de ordem de bloqueio eletrônico via SISBAJUD (art. 854 CPC) e, subsidiariamente, medidas executivas atípicas (art. 139, IV, CPC)",
  norma: "arts. 854 e 139, IV, do CPC/2015 (penhora on-line — SISBAJUD — poder geral de efetivação)",
});

// Adiciona os temas cíveis/consumeristas ao THEMES
THEMES.push(
  // CÍVEL GERAL (10 temas — um tipo de peça cada)
  { id: "cg_obr_fazer_inicial",   build: tCgObrFazerInicial,   compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "cg_obr_fazer_decisao",   build: tCgObrFazerDecisao,   compatibleTypes: ["DECISAO"] },
  { id: "cg_obr_fazer_sentenca",  build: tCgObrFazerSentenca,  compatibleTypes: ["SENTENCA"] },
  { id: "cg_danos_morais_proc",   build: tCgDanosMoraisProcedente,  compatibleTypes: ["SENTENCA"] },
  { id: "cg_danos_morais_improc", build: tCgDanosMoraisImprocedente, compatibleTypes: ["SENTENCA"] },
  { id: "cg_cobranca_inicial",    build: tCgCobrancaInicial,   compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "cg_cobranca_sentenca",   build: tCgCobrancaSentenca,  compatibleTypes: ["SENTENCA"] },
  { id: "cg_cumprimento_decisao", build: tCgCumprimentoDecisao, compatibleTypes: ["DECISAO"] },
  { id: "cg_agravo_recurso",      build: tCgAgravoRecurso,     compatibleTypes: ["RECURSO"] },
  { id: "cg_despacho_emenda",     build: tCgDespachoEmenda,    compatibleTypes: ["DESPACHO"] },
  // CONSUMIDOR (10 temas — um tipo de peça cada)
  { id: "cs_negativacao_inicial",    build: tCsNegativacaoInicial,     compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "cs_negativacao_sentenca_p", build: tCsNegativacaoSentencaProc, compatibleTypes: ["SENTENCA"] },
  { id: "cs_negativacao_sentenca_i", build: tCsNegativacaoSentencaImproc, compatibleTypes: ["SENTENCA"] },
  { id: "cs_produto_vicio_inicial",  build: tCsProdutoVicioInicial,    compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "cs_produto_vicio_sentenca", build: tCsProdutoVicioSentenca,   compatibleTypes: ["SENTENCA"] },
  { id: "cs_plano_saude_tutela",     build: tCsPlanoSaudeTutela,       compatibleTypes: ["DECISAO"] },
  { id: "cs_banco_cobranca_inicial", build: tCsBancoCobrancaInicial,   compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "cs_banco_cobranca_sentenca",build: tCsBancoCobrancaSentenca,  compatibleTypes: ["SENTENCA"] },
  { id: "cs_apelacao_consumidor",    build: tCsApelacaoConsumidor,     compatibleTypes: ["RECURSO"] },
  { id: "cs_despacho_provas",        build: tCsDespachoProvas,         compatibleTypes: ["DESPACHO"] },
  // EXECUÇÃO / CUMPRIMENTO (5 temas × ALL_PHASES = 20 casos)
  { id: "ec_cumprimento_sentenca",   build: tEcCumprimentoSentenca },
  { id: "ec_execucao_titulo",        build: tEcExecucaoTitulo },
  { id: "ec_impugnacao",             build: tEcImpugnacao },
  { id: "ec_embargos",               build: tEcEmbargos },
  { id: "ec_sisbajud",               build: tEcSisbajud },
);

// ── FAZENDA PÚBLICA ───────────────────────────────────────────────────────────
//
// 20 temas de direito público — um tipo de peça por tema.
// Traps em ~30% dos casos (6 traps):
//   Caso 3 (inicial concurso):    TEMA_STF_IGNORADO (Tema 784 não aplicado)
//   Caso 5 (inicial verba):       PRESCRICAO_QUINQUENAL_IGNORADA
//   Caso 6 (decisão tutela med):  RESERVA_POSSIVEL_SEM_MIN_EXIST
//   Caso 8 (decisão concurso):    LEGITIMIDADE_PASSIVA_INCORRETA
//   Caso 12 (sentença med improc):SEPARACAO_PODERES_INCORRETA
//   Caso 17 (recurso apelação):   SOLIDARIEDADE_INCORRETA

const FP_ENTES = [
  "Estado de São Paulo", "Município de São Paulo/SP", "União Federal",
  "Estado do Rio de Janeiro", "Município do Rio de Janeiro/RJ",
  "Estado de Minas Gerais", "Estado do Rio Grande do Sul", "Município de Curitiba/PR",
];

const JUR_STF_TEMA784: JurisprudenciaInput = {
  id: "jur_stf_tema784",
  tribunal: "STF", numero: "RE 837.311/PI",
  tema: "Concurso — direito subjetivo à nomeação",
  ementa: "Dentro do prazo de validade do concurso, a Administração poderá escolher o momento no qual se realizará a nomeação, mas fica vinculada ao dever de nomear os candidatos aprovados até o limite das vagas previstas no edital. Eventual necessidade de admissão de novos servidores afasta a discricionariedade.",
  tese: "Direito subjetivo à nomeação de aprovado dentro do número de vagas",
  relator: "Min. Luiz Fux", dataJulgamento: "2015-08-09",
};
const JUR_STF_TEMA793: JurisprudenciaInput = {
  id: "jur_stf_tema793",
  tribunal: "STF", numero: "RE 855.178/SE",
  tema: "Saúde — responsabilidade solidária dos entes federativos",
  ementa: "Os entes da federação, em decorrência da competência comum, são solidariamente responsáveis nas demandas prestacionais na área da saúde e, diante dos critérios constitucionais de descentralização e hierarquização, é permitido ao julgador direcionar o cumprimento conforme as regras de repartição de competências.",
  tese: "Responsabilidade solidária União/Estado/Município em demandas de saúde",
  relator: "Min. Edson Fachin", dataJulgamento: "2019-05-23",
};

// ── Petições iniciais (casos 1-5) ──────────────────────────────────────────

const tFpMedicamentoInicial = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Medicamento — petição inicial",
  autor: pick(NOMES, i),
  reu: pick(FP_ENTES, i),
  comarca: pick(COMARCAS, i),
  fatos: `${pick(NOMES, i)} (CPF ${cpf(i + 5000)}), portador(a) de ${pick(["diabetes tipo 1 insulinodependente", "esclerose múltipla progressiva", "doença de Crohn refratária", "hipertensão arterial pulmonar"], i)}, necessita de ${pick(["insulina glargina U-300", "natalizumabe 300mg", "vedolizumabe 300mg", "macitentan 10mg"], i)}, medicamento não disponível no RENAME/SUS. Laudo médico de ${dateBack(0, i)} atesta caráter essencial e urgência. O ${pick(FP_ENTES, i)} foi notificado em ${dateBack(0, i)} e não forneceu no prazo de 10 dias.`,
  pedido: "fornecimento do medicamento prescrito e tutela de urgência para entrega imediata",
  norma: "art. 196 CF/88; arts. 6º e 7º da Lei 8.080/90; art. 300 CPC",
  jurisprudencias: [JUR_STF_TEMA793],
});

const tFpSusCircurgiaInicial = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Tratamento SUS — petição inicial",
  autor: pick(NOMES, i + 1),
  reu: pick(FP_ENTES, i + 1),
  comarca: pick(COMARCAS, i + 1),
  fatos: `${pick(NOMES, i + 1)} (CPF ${cpf(i + 5100)}) necessita de ${pick(["cirurgia de revascularização miocárdica", "transplante renal", "radioterapia oncológica"], i)} prescrita há ${30 + (i % 60)} dias. O procedimento consta nos protocolos do SUS mas o ${pick(FP_ENTES, i + 1)} não disponibilizou vaga. Risco à vida documentado em laudo médico.`,
  pedido: "agendamento imediato do procedimento cirúrgico e tutela de urgência",
  norma: "art. 196 CF/88; arts. 7º e 9º da Lei 8.080/90 (integralidade); art. 300 CPC",
  jurisprudencias: [JUR_STF_TEMA793],
});

const tFpConcursoNomeacaoInicial = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Concurso público — nomeação",
  autor: pick(NOMES, i + 2),
  reu: pick(FP_ENTES, i + 2),
  comarca: pick(COMARCAS, i + 2),
  fatos: `${pick(NOMES, i + 2)} (CPF ${cpf(i + 5200)}) foi aprovado(a) em ${dateBack(2, i)} no concurso público para ${pick(["Agente Administrativo", "Técnico em Saúde", "Analista Jurídico", "Fiscal Tributário"], i)} — edital n. ${1000 + i}/${2022 + (i % 3)}, classificado(a) na ${5 + (i % 10)}ª colocação dentro das ${20 + (i % 30)} vagas previstas. O prazo de validade venceu em ${dateBack(0, i)} sem nomeação. O ente público contratou ${10 + i} temporários para exercer as mesmas funções do cargo durante o período de validade.`,
  pedido: "nomeação e posse no cargo público e indenização pelo período de preterição",
  norma: "art. 37 §2º CF/88; Tema STF 784 (RE 837.311) — direito subjetivo à nomeação dentro das vagas",
  jurisprudencias: [JUR_STF_TEMA784],
});

// Réus para servidor estadual/municipal — exclui União Federal (Lei 8.112/90 não se aplica)
const FP_ENTES_ESTADUAIS_MUNICIPAIS = FP_ENTES.filter((e) => e !== "União Federal");

const tFpServidorProgressaoInicial = (i: number): ThemeNarrative => {
  const ente = pick(FP_ENTES_ESTADUAIS_MUNICIPAIS, i + 3);
  const isEstadual = ente.startsWith("Estado");
  const tipoServidor = isEstadual ? "estadual" : "municipal";
  const estatuto = isEstadual
    ? "Estatuto dos Servidores do Estado (lei estadual aplicável)"
    : "Estatuto dos Servidores do Município (lei municipal aplicável)";
  return {
    area: "FAZENDA_PUBLICA",
    themeLabel: "Servidor — progressão funcional",
    autor: pick(NOMES, i + 3),
    reu: ente,
    comarca: pick(COMARCAS, i + 3),
    fatos: `${pick(NOMES, i + 3)} (CPF ${cpf(i + 5300)}), servidor(a) público(a) ${tipoServidor} ocupante do cargo de ${pick(["Analista Técnico", "Agente de Saúde", "Fiscal Municipal", "Técnico Administrativo"], i)}, preencheu todos os requisitos legais para progressão em ${dateBack(1, i)}: avaliação de desempenho SATISFATÓRIA (nota ${70 + (i % 25)}/100) e interstício de ${2 + (i % 2)} anos cumprido. A Administração negou a progressão sem fundamentação suficiente.`,
    pedido: "progressão funcional e pagamento das diferenças de vencimentos desde a data em que o direito surgiu",
    norma: `${estatuto}; art. 37 caput CF/88 (legalidade, impessoalidade); art. 5º, LV, CF/88`,
  };
};

const tFpServidorVerbaInicial = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Servidor — verba funcional não paga",
  autor: pick(NOMES, i + 4),
  reu: pick(FP_ENTES, i + 4),
  comarca: pick(COMARCAS, i + 4),
  fatos: `${pick(NOMES, i + 4)} (CPF ${cpf(i + 5400)}), servidor(a) ${pick(["estadual", "municipal"], i)} do cargo de ${pick(["Agente Fiscal", "Técnico em Saúde", "Auxiliar Administrativo"], i)}, deixou de receber o ${pick(["adicional de insalubridade de 20%", "adicional noturno de 25%", "gratificação de produtividade"], i)} a que faz jus desde ${dateBack(8, i)}. Total não pago: ${brl(25000 + i * 3000)} (${84 + i * 6} meses × ${brl(300 + i * 30)}/mês). O servidor entende que não há prescrição alguma sobre as parcelas.`,
  pedido: "pagamento de todas as parcelas vencidas e vincendas do adicional/gratificação devida",
  norma: "estatuto dos servidores; DL 4.597/42 (prescrição quinquenal); Súmula 85 STJ",
});

// ── Decisões (casos 6-10) ──────────────────────────────────────────────────

const tFpTutelaMedicamentoDecisao = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Tutela — medicamento urgente (decisão)",
  autor: pick(NOMES, i + 5),
  reu: pick(FP_ENTES, i + 5),
  comarca: pick(COMARCAS, i + 5),
  fatos: `Juiz deve decidir tutela de urgência. ${pick(NOMES, i + 5)} requer fornecimento imediato de ${pick(["nivolumabe para câncer de pulmão", "adalimumabe para artrite reumatoide grave", "imatinibe para LMC"], i)} prescrito por especialista. Laudo médico de ${dateBack(0, i)} documenta urgência — risco de agravamento irreversível em ${7 + i % 14} dias. Fumus boni iuris (art. 196 CF/88) e periculum in mora (urgência médica) presentes.`,
  pedido: "deferimento de tutela de urgência para fornecimento imediato do medicamento",
  norma: "art. 300 CPC; art. 196 CF/88; Tema STF 793 (responsabilidade solidária dos entes)",
  jurisprudencias: [JUR_STF_TEMA793],
});

const tFpTutelaCirurgiaDecisao = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Tutela — cirurgia urgente (decisão)",
  autor: pick(NOMES, i + 6),
  reu: pick(FP_ENTES, i + 6),
  comarca: pick(COMARCAS, i + 6),
  fatos: `${pick(NOMES, i + 6)} (CPF ${cpf(i + 5600)}) necessita de ${pick(["cirurgia cardíaca de urgência (valvoplastia)", "cirurgia de tumor cerebral benigno", "amputação de membro em risco de gangrena"], i)} prescrita há ${15 + (i % 30)} dias. Fila SUS prevê atendimento em ${6 + (i % 12)} meses, incompatível com a urgência. Laudo pericial confirma urgência. Probabilidade do direito: alta. Periculum: documentado.`,
  pedido: "tutela de urgência para agendamento imediato da cirurgia ou custeio pelo réu",
  norma: "art. 300 CPC; art. 196 CF/88; art. 2º da Lei 8.080/90",
});

const tFpConcursoSuspensaoDecisao = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Concurso público — suspensão de ato (decisão)",
  autor: pick(NOMES, i + 7),
  reu: pick(FP_ENTES, i + 7),
  comarca: pick(COMARCAS, i + 7),
  fatos: `Candidato(a) ${pick(NOMES, i + 7)} foi eliminado(a) do concurso ${pick(["estadual para Delegado de Polícia", "municipal para Fiscal de Tributos", "federal para Analista"], i)} por critério subjetivo não previsto no edital, aplicado pela banca em ${dateBack(0, i)}. Fumus boni iuris (ausência de base editalícia) e periculum in mora (posse agendada para ${dateBack(-1, i)}).`,
  pedido: "suspensão do ato de eliminação e reintegração ao certame até julgamento de mérito",
  norma: "art. 300 CPC; art. 37 caput CF/88 (legalidade e publicidade); Súmula 684 STF",
});

const tFpGratuidadeDecisao = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Gratuidade da justiça — decisão",
  autor: pick(NOMES, i + 8),
  reu: pick(FP_ENTES, i + 8),
  comarca: pick(COMARCAS, i + 8),
  fatos: `${pick(NOMES, i + 8)} pleiteou gratuidade em ação contra ${pick(FP_ENTES, i + 8)}. Réu impugnou com base em pesquisa patrimonial: veículo de ${brl(18000 + i * 2000)} e imóvel residencial único de ${brl(180000 + i * 20000)}. Requerente declarou insuficiência de recursos (art. 99 §1º CPC). Juiz decide o incidente.`,
  pedido: "manutenção da gratuidade da justiça",
  norma: "arts. 98-102 CPC; art. 5º, LXXIV, CF/88; Tema STJ 1.070",
});

const tFpPericiaDecisao = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Prova pericial — decisão de deferimento",
  autor: pick(NOMES, i + 9),
  reu: pick(FP_ENTES, i + 9),
  comarca: pick(COMARCAS, i + 9),
  fatos: `Ação de fornecimento de medicamento. Réu impugna a necessidade médica alegando existência de alternativa no RENAME. Autor requer perícia médica para atestar a necessidade do medicamento prescrito em detrimento das alternativas do SUS. Prova é pertinente e necessária para resolução do mérito.`,
  pedido: "deferimento de prova pericial médica para atestar necessidade terapêutica",
  norma: "arts. 369, 464 e 465 CPC; art. 5º, LV, CF/88 (contraditório e ampla defesa)",
});

// ── Sentenças (casos 11-16) ────────────────────────────────────────────────

const SENT_FP_BASE = `SENTENÇA — FAZENDA PÚBLICA — estrutura obrigatória:
I. RELATÓRIO: partes, pedido, fatos, histórico processual e provas produzidas.
II. FUNDAMENTAÇÃO: análise constitucional do direito pleiteado + aplicação dos temas vinculantes + análise das teses defensivas.
III. DISPOSITIVO: JULGO PROCEDENTE/IMPROCEDENTE + honorários (art. 85 CPC) + remessa necessária (art. 496 CPC) + recurso cabível (Apelação — art. 1.009 CPC, 30 dias para a Fazenda — art. 183 CPC).`;

const tFpMedicamentoProcSentenca = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Medicamento SUS — sentença procedente",
  autor: pick(NOMES, i),
  reu: pick(FP_ENTES, i),
  comarca: pick(COMARCAS, i),
  fatos: `Ação de fornecimento de medicamento. Prova documental demonstrou: (a) necessidade por laudo de especialista; (b) medicamento prescrito com eficácia científica comprovada; (c) ausência de alternativa equivalente no RENAME; (d) incapacidade financeira do autor. Réu não comprovou reserva do possível nem alternativa terapêutica. Perícia confirmou a necessidade médica.`,
  pedido: "fornecimento do medicamento prescrito às expensas do Estado",
  norma: "art. 196 CF/88; Tema STF 793; art. 6º Lei 8.080/90",
  jurisprudencias: [JUR_STF_TEMA793],
  sentencaInstruction: `${SENT_FP_BASE}
VARIAÇÃO — PROCEDENTE (FORNECIMENTO DE MEDICAMENTO):
1. Direito à saúde (art. 196 CF/88): obrigação do Estado de fornecer tratamento necessário.
2. Tema STF 793 (RE 855.178): responsabilidade SOLIDÁRIA da União, Estado e Município — mencionar expressamente. O julgador pode direcionar o cumprimento ao ente processado.
3. Mínimo existencial: a negativa viola a dignidade da pessoa humana (art. 1º, III, CF/88). Reserva do possível NÃO prevalece quando viola o mínimo existencial.
4. Comprovação dos requisitos: laudo médico + ausência de alternativa no SUS + hipossuficiência financeira.
5. Dispositivo: JULGO PROCEDENTE para CONDENAR o réu a fornecer [medicamento] no prazo de 15 dias, sob pena de multa diária de R$ 500,00, com fundamento no art. 536 CPC.`,
});

const tFpMedicamentoImprocSentenca = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Medicamento SUS — sentença improcedente",
  autor: pick(NOMES, i + 1),
  reu: pick(FP_ENTES, i + 1),
  comarca: pick(COMARCAS, i + 1),
  fatos: `Autor requer medicamento experimental sem registro ANVISA para uso oncológico. Laudos periciais (do Estado e independente) indicam alternativa terapêutica equivalente disponível no RENAME não tentada pelo paciente. Réu comprovou disponibilidade do protocolo clínico alternativo. Peritos concordam que há alternativa adequada.`,
  pedido: "fornecimento de medicamento sem protocolo clínico MS aprovado",
  norma: "art. 196 CF/88 — limites da intervenção judicial em políticas públicas de saúde",
  sentencaInstruction: `${SENT_FP_BASE}
VARIAÇÃO — IMPROCEDENTE (ALTERNATIVA TERAPÊUTICA DISPONÍVEL):
1. O direito à saúde não é absoluto: deve ser confrontado com a Política Nacional de Medicamentos e os protocolos do MS.
2. Reserva do possível como limitação legítima (não absoluta): Administração comprovou existência de alternativa no RENAME.
3. Limite da intervenção judicial: o Judiciário não substitui as políticas públicas de saúde quando a Administração oferece tratamento alternativo adequado — separação dos poderes como ELEMENTO de ponderação, não como óbice absoluto.
4. Análise do mínimo existencial: não atingido, pois há alternativa terapêutica disponível no SUS.
5. Laudo pericial confirmou viabilidade da alternativa.
6. Dispositivo: JULGO IMPROCEDENTE o pedido. Sem honorários (beneficiário da gratuidade ou isento).`,
});

const tFpConcursoProcSentenca = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Concurso público — sentença procedente",
  autor: pick(NOMES, i + 2),
  reu: pick(FP_ENTES, i + 2),
  comarca: pick(COMARCAS, i + 2),
  fatos: `${pick(NOMES, i + 2)} aprovado(a) na ${3 + (i % 7)}ª colocação dentro das ${15 + (i % 20)} vagas do edital. Certame venceu sem nomeação. Prova: (a) aprovação dentro das vagas; (b) ente contratou ${5 + i} temporários para as mesmas funções; (c) não houve justificativa de escassez orçamentária; (d) prazo não prorrogado.`,
  pedido: "nomeação e posse, mais indenização pelas diferenças salariais",
  norma: "Tema STF 784 (RE 837.311); art. 37 §2º CF/88",
  jurisprudencias: [JUR_STF_TEMA784],
  sentencaInstruction: `${SENT_FP_BASE}
VARIAÇÃO — PROCEDENTE (DIREITO SUBJETIVO À NOMEAÇÃO):
1. Tema STF 784 (RE 837.311/PI, Min. Luiz Fux): candidato aprovado DENTRO do número de vagas adquire DIREITO SUBJETIVO à nomeação — não é mera expectativa.
2. Requisitos do Tema 784 preenchidos: (a) aprovado dentro das vagas; (b) prazo de validade vigente; (c) necessidade real demonstrada (contratação de temporários para as mesmas funções).
3. Ausência de justificativa legítima: não há escassez orçamentária comprovada.
4. Indenização: diferenças salariais do período de preterição — liquidação futura.
5. Dispositivo: JULGO PROCEDENTE para CONDENAR o réu a nomear e empossar no prazo de 30 dias, pena de multa de R$ 1.000,00/dia, e ao pagamento das diferenças salariais (liquidação futura).`,
});

const tFpConcursoImprocSentenca = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Concurso público — improcedente (cadastro reserva)",
  autor: pick(NOMES, i + 3),
  reu: pick(FP_ENTES, i + 3),
  comarca: pick(COMARCAS, i + 3),
  fatos: `${pick(NOMES, i + 3)} aprovado(a) na ${45 + (i % 30)}ª colocação FORA das ${20 + (i % 10)} vagas do edital (cadastro de reserva). Não convocado. Ente público comprovou ausência de necessidade real durante a validade do concurso. Sem contratação de temporários para a função.`,
  pedido: "nomeação por expectativa de direito em cadastro de reserva",
  norma: "art. 37 §2º CF/88; Tema STF 784 — fora das vagas: mera expectativa",
  sentencaInstruction: `${SENT_FP_BASE}
VARIAÇÃO — IMPROCEDENTE (CADASTRO DE RESERVA):
1. Tema STF 784: o direito subjetivo à nomeação pressupõe aprovação DENTRO do número de vagas. Candidato em cadastro de reserva tem mera expectativa de direito.
2. Discricionariedade administrativa: a convocação do cadastro de reserva é faculdade, não obrigação — desde que não demonstrada necessidade real por contratação de temporários.
3. Ausência dos requisitos do Tema 784: candidato não está dentro das vagas; ente não demonstrou necessidade que forçasse a convocação.
4. Dispositivo: JULGO IMPROCEDENTE o pedido.`,
});

const tFpServidorProcSentenca = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Servidor — progressão funcional — procedente",
  autor: pick(NOMES, i + 4),
  reu: pick(FP_ENTES, i + 4),
  comarca: pick(COMARCAS, i + 4),
  fatos: `Servidor(a) preencheu requisitos legais para progressão: avaliação de desempenho SATISFATÓRIA e interstício cumprido. Administração negou a progressão alegando restrição orçamentária genérica sem demonstrar impacto concreto. Prova documental inequívoca dos requisitos cumpridos.`,
  pedido: "progressão funcional e pagamento de diferenças vencimentais",
  norma: "estatuto dos servidores; art. 37, X, CF/88; DL 4.597/42 (prescrição quinquenal das parcelas)",
  sentencaInstruction: `${SENT_FP_BASE}
VARIAÇÃO — PROCEDENTE (PROGRESSÃO FUNCIONAL):
1. A progressão funcional é ato vinculado: preenchidos os requisitos objetivos, a Administração é obrigada a concedê-la.
2. Avaliação satisfatória e interstício: demonstrados documentalmente.
3. Restrição orçamentária genérica: não é fundamentação suficiente para negar ato vinculado — exigiria demonstração de situação fiscal excepcional.
4. Prescrição quinquenal (DL 4.597/42): declarar de ofício. Apenas as parcelas dos últimos 5 anos são devidas (Súmula 85 STJ).
5. Dispositivo: JULGO PROCEDENTE para determinar a progressão e condenar ao pagamento das diferenças dos últimos 5 anos.`,
});

const tFpServidorImprocSentenca = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Servidor — verba funcional — parcialmente procedente (prescrição)",
  autor: pick(NOMES, i + 5),
  reu: pick(FP_ENTES, i + 5),
  comarca: pick(COMARCAS, i + 5),
  fatos: `Servidor requer adicional de insalubridade desde ${dateBack(9, i)} (${96 + i * 6} meses de inadimplência). Ação ajuizada em ${dateBack(0, i)}. Laudo pericial confirma atividade insalubre — o direito ao adicional existe. Porém, a maioria das parcelas tem mais de 5 anos.`,
  pedido: "pagamento de todo o período de inadimplência (96+ meses)",
  norma: "DL 4.597/42 (prescrição quinquenal para servidores); Súmula 85 STJ",
  sentencaInstruction: `${SENT_FP_BASE}
VARIAÇÃO — PARCIALMENTE PROCEDENTE (PRESCRIÇÃO QUINQUENAL):
1. Mérito: o direito ao adicional existe — laudo pericial confirmou atividade insalubre.
2. Prescrição quinquenal (DL 4.597/42): para servidores, a pretensão de cobrança de verbas funcionais prescreve em 5 anos (prazo especial, não o geral do CC/2002 de 10 anos).
3. Súmula 85 STJ (prestações periódicas): a prescrição não atinge o fundo de direito — atinge apenas as parcelas anteriores ao quinquênio. Declarar de ofício.
4. Cálculo: retroagem 5 anos da data do ajuizamento — parcelas anteriores: prescritas.
5. Dispositivo: JULGO PARCIALMENTE PROCEDENTE — condena ao pagamento apenas das parcelas dos 5 anos anteriores ao ajuizamento. Parcelas anteriores: prescritas nos termos do DL 4.597/42 c/c Súmula 85 STJ.`,
});

// ── Recursos (casos 17-20) ─────────────────────────────────────────────────

const tFpApelacaoFazendaRecurso = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Apelação — Fazenda Pública",
  autor: pick(FP_ENTES, i),
  reu: pick(NOMES, i),
  comarca: pick(COMARCAS, i),
  fatos: `${pick(FP_ENTES, i)} apela de sentença que a condenou a fornecer medicamento ao autor ${pick(NOMES, i)}, com prazo de 15 dias e multa diária de R$ 500,00. A sentença aplicou o Tema STF 793 (responsabilidade solidária). Fazenda alega: (a) violação da separação dos poderes; (b) reserva do possível; (c) alternativa no RENAME não analisada. Prazo da Fazenda: 30 dias corridos (art. 183 CPC). Remessa necessária (art. 496, I, CPC) também se aplica.`,
  pedido: "reforma da sentença para improcedência ou redução da multa diária",
  norma: "arts. 1.009, 183 e 496 CPC; Tema STF 793 (responsabilidade solidária); art. 196 CF/88",
  jurisprudencias: [JUR_STF_TEMA793],
});

const tFpContrarrazoesRecurso = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Contrarrazões — Fazenda Pública",
  autor: pick(NOMES, i + 1),
  reu: pick(FP_ENTES, i + 1),
  comarca: pick(COMARCAS, i + 1),
  fatos: `${pick(NOMES, i + 1)}, beneficiário da sentença que condenou o ${pick(FP_ENTES, i + 1)} a fornecer medicamento, deve apresentar contrarrazões à apelação da Fazenda. A apelação argumenta reserva do possível, separação dos poderes e alternativa terapêutica. Prazo: 15 dias (art. 1.010 §3º CPC), contados da intimação eletrônica.`,
  pedido: "manutenção integral da sentença condenatória",
  norma: "arts. 1.010 §3º e 1.013 CPC; art. 196 CF/88; Tema STF 793",
  jurisprudencias: [JUR_STF_TEMA793],
});

const tFpAgravoTutelaRecurso = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Agravo de instrumento — contra tutela (Fazenda)",
  autor: pick(FP_ENTES, i + 2),
  reu: pick(NOMES, i + 2),
  comarca: pick(COMARCAS, i + 2),
  fatos: `${pick(FP_ENTES, i + 2)} interpõe agravo de instrumento contra decisão que deferiu tutela de urgência para fornecimento imediato de medicamento. Agravante alega: (a) ausência de fumus boni iuris — medicamento não consta no RENAME; (b) ausência de periculum in mora — paciente pode usar alternativa. Prazo de 15 dias (art. 1.003 §5º CPC). Cabimento: art. 1.015, I, CPC (tutela provisória).`,
  pedido: "suspensão da tutela e seu posterior cancelamento",
  norma: "art. 1.015, I, CPC; art. 300 CPC; art. 196 CF/88",
});

const tFpEmbargosDeclaracaoRecurso = (i: number): ThemeNarrative => ({
  area: "FAZENDA_PUBLICA",
  themeLabel: "Embargos de declaração — Fazenda Pública",
  autor: pick(FP_ENTES, i + 3),
  reu: pick(NOMES, i + 3),
  comarca: pick(COMARCAS, i + 3),
  fatos: `${pick(FP_ENTES, i + 3)} opõe embargos de declaração em face de sentença que a condenou a fornecer medicamento. Apontam-se: (a) omissão quanto à modulação temporal da condenação; (b) contradição entre a declaração de solidariedade (Tema 793) e a ausência de chamamento dos demais entes; (c) obscuridade quanto ao prazo inicial de incidência da multa diária. Prazo: 5 dias (art. 1.023 CPC). Finalidade: prequestionamento.`,
  pedido: "sanar omissão, contradição e obscuridade para fins de prequestionamento",
  norma: "arts. 1.022 e 1.025 CPC (embargos de declaração — omissão, contradição, obscuridade)",
});

// ── JURISPRUDÊNCIAS REUTILIZÁVEIS — EXECUÇÃO / CUMPRIMENTO ───────────────────

const JUR_PRESCRICAO_INTERCORRENTE: JurisprudenciaInput = {
  id: "jur_prescricao_intercorrente",
  tribunal: "STJ", numero: "REsp 1.340.553/RS (Tema 566)",
  tema: "Prescrição intercorrente na execução fiscal",
  ementa: "Transcorrido o prazo de 1 ano de suspensão do art. 40 da LEF, inicia-se o prazo prescricional de 5 anos, independentemente de intimação do credor, cabendo ao juiz declará-la de ofício.",
  tese: "Prescrição intercorrente — 1 ano + 5 anos (aplicável por analogia ao CPC)",
  relator: "Min. Mauro Campbell Marques", dataJulgamento: "2016-11-09",
};

const JUR_IMPENHORABILIDADE_SALARIO: JurisprudenciaInput = {
  id: "jur_impenhorabilidade_salario",
  tribunal: "STJ", numero: "EREsp 1.518.169/DF",
  tema: "Impenhorabilidade de salário — mitigação para percentual",
  ementa: "A impenhorabilidade de salários (art. 833, IV, CPC) pode ser mitigada quando o valor excede substancialmente o necessário à subsistência do devedor. Admitido percentual de até 30% do salário líquido em casos excepcionais.",
  tese: "Penhora de percentual do salário (até 30%) — hipótese excepcional",
  relator: "Min. Luis Felipe Salomão", dataJulgamento: "2019-05-08",
};

const JUR_FAZENDA_PRECATORIO: JurisprudenciaInput = {
  id: "jur_fazenda_precatorio",
  tribunal: "STF", numero: "RE 729.107/DF (Tema 897)",
  tema: "Cumprimento de sentença contra Fazenda Pública — precatório e RPV",
  ementa: "As condenações impostas à Fazenda Pública devem ser liquidadas por precatório (art. 100 CF/88) ou RPV (valores ≤ 60 salários mínimos — art. 100 §3º CF/88), sendo vedado o cumprimento pelo rito comum.",
  tese: "Fazenda Pública: precatório/RPV — rito especial obrigatório",
  relator: "Min. Luiz Fux", dataJulgamento: "2014-06-11",
};

// ── SENTENÇA BASE — EXECUÇÃO / CUMPRIMENTO ───────────────────────────────────

const SENT_EC_BASE = `SENTENÇA — EXECUÇÃO / CUMPRIMENTO DE SENTENÇA — estrutura obrigatória:
I. RELATÓRIO: partes, título executivo, valor exequendo, incidentes processuais (impugnação, exceção).
II. FUNDAMENTAÇÃO: análise da matéria arguida (excesso, inexigibilidade, prescrição intercorrente, impenhorabilidade) + preceitos legais do CPC Livro II (arts. 513 a 925).
III. DISPOSITIVO: extinguir a execução (art. 924 CPC) OU julgar impugnação (procedente/improcedente) + honorários advocatícios (art. 85 CPC) + recurso cabível.
ATENÇÃO — Recurso na execução: Agravo de Instrumento (art. 1.015, XIV, CPC) contra decisões interlocutórias; Apelação (art. 1.009 CPC) contra sentenças terminativas.`;

// ── TEMAS DE EXECUÇÃO / CUMPRIMENTO DE SENTENÇA (20) ─────────────────────────
//
// Distribuição:
//   4 Petições/Requerimentos    → PETICAO_INICIAL
//   4 Impugnações               → PETICAO_INICIAL
//   5 Decisões                  → DECISAO
//   4 Sentenças terminativas    → SENTENCA
//   3 Recursos                  → RECURSO
// Total: 20 temas

// ── Petições / Requerimentos (casos 1-4) ─────────────────────────────────────

const tEcCumprimentoInicial = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Cumprimento de sentença — requerimento inicial",
  autor: pick(NOMES, i),
  reu: pick(NOMES, i + 10),
  comarca: pick(COMARCAS, i),
  fatos: `${pick(NOMES, i)} (CPF ${cpf(i + 6000)}) obteve sentença condenatória transitada em julgado em face de ${pick(NOMES, i + 10)} (CPF ${cpf(i + 6100)}), condenando ao pagamento de ${brl(25000 + i * 3000)} com correção monetária pelo IPCA-E desde o evento danoso e juros de mora de 1% ao mês desde a citação (art. 406 CC c/c Súmula 54 STJ). O prazo de 15 dias para pagamento voluntário (art. 523 CPC) transcorreu sem qualquer pagamento. Demonstrativo atualizado totaliza ${brl(28500 + i * 3200)}.`,
  pedido: "instauração do cumprimento de sentença com aplicação da multa de 10% (art. 523 §1º CPC), honorários de 10% e penhora eletrônica via SISBAJUD",
  norma: "arts. 523, 524 e 854 do CPC/2015; Súmula 54 STJ; IPCA-E como índice de correção",
});

const tEcCumprimentoFazendaInicial = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Cumprimento contra Fazenda Pública — RPV/precatório",
  autor: pick(NOMES, i + 1),
  reu: pick(FP_ENTES, i),
  comarca: pick(COMARCAS, i + 1),
  fatos: `${pick(NOMES, i + 1)} (CPF ${cpf(i + 6200)}) obteve sentença condenatória transitada em julgado contra ${pick(FP_ENTES, i)} ao pagamento de verbas funcionais. O prazo de 60 dias para cumprimento voluntário pela Fazenda (art. 535 §3º CPC) transcorreu sem pagamento. O valor atualizado totaliza ${brl(42000 + i * 4000)}. ${i % 2 === 0 ? "O montante supera 60 salários mínimos — deve ser pago por PRECATÓRIO (art. 100 CF/88)." : "O montante é inferior a 60 salários mínimos — deve ser pago por RPV — Requisição de Pequeno Valor (art. 100 §3º CF/88)."}`,
  pedido: `expedição de ${i % 2 === 0 ? "precatório (art. 100 CF/88)" : "RPV — Requisição de Pequeno Valor (art. 100 §3º CF/88)"} pelo valor atualizado`,
  norma: "arts. 534, 535 CPC; art. 100 CF/88 (precatório/RPV); Tema STF 897 (RE 729.107)",
  jurisprudencias: [JUR_FAZENDA_PRECATORIO],
});

const tEcObrigacaoFazerInicial = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Cumprimento de obrigação de fazer — astreintes acumuladas",
  autor: pick(NOMES, i + 2),
  reu: pick(EMPRESAS, i).nome,
  comarca: pick(COMARCAS, i + 2),
  fatos: `${pick(NOMES, i + 2)} obteve sentença definitiva condenando ${pick(EMPRESAS, i).nome} (CNPJ ${pick(EMPRESAS, i).cnpj}) a ${pick(["concluir a reforma do imóvel comercial", "instalar o sistema de segurança contratado", "entregar o equipamento médico adquirido"], i)} no prazo de 30 dias, com astreinte de ${brl(500 + i * 100)}/dia (art. 536 §1º CPC). Decorridos ${45 + (i % 30)} dias do trânsito em julgado, a obrigação não foi cumprida. Multa acumulada: ${brl((500 + i * 100) * (45 + (i % 30)))}.`,
  pedido: "exigibilidade das astreintes acumuladas e, alternativamente, conversão da obrigação em perdas e danos (art. 499 CPC)",
  norma: "arts. 497, 499, 523 e 536 §1º do CPC/2015; art. 389 do CC/2002",
});

const tEcObrigacaoPagarInicial = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Cumprimento — demonstrativo de cálculo (obrigação de pagar)",
  autor: pick(NOMES, i + 3),
  reu: pick(NOMES, i + 13),
  comarca: pick(COMARCAS, i + 3),
  fatos: `${pick(NOMES, i + 3)} apresenta demonstrativo de cálculo nos autos de cumprimento de sentença. Condenação original: ${brl(80000 + i * 5000)}. Devem ser somados: (a) correção monetária pelo IPCA-E desde o ajuizamento; (b) juros de mora de 1% ao mês a partir da citação (arts. 406 CC e 523 §1º CPC); (c) multa de 10% do art. 523 §1º CPC; (d) honorários de 10% do art. 523 §1º CPC. Total atualizado: ${brl(96000 + i * 5500)}. O executado ${pick(NOMES, i + 13)} não impugnou os cálculos no prazo legal.`,
  pedido: "homologação do demonstrativo de cálculo e expedição de mandado de penhora pelo saldo total",
  norma: "arts. 523, 524 e 526 CPC; IPCA-E como índice de correção; Súmula 54 STJ",
});

// ── Impugnações ao cumprimento (casos 5-8) ───────────────────────────────────

const tEcImpugnacaoExcesso = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Impugnação ao cumprimento — excesso de execução",
  autor: pick(NOMES, i + 4),
  reu: pick(NOMES, i + 14),
  comarca: pick(COMARCAS, i + 4),
  fatos: `${pick(NOMES, i + 4)} (executado) apresenta impugnação ao cumprimento de sentença. O demonstrativo do exequente aponta ${brl(58000 + i * 3000)}, porém: (a) a correção monetária aplicou INPC em vez de IPCA-E — diferença de ${brl(2800 + i * 200)}; (b) os juros foram calculados sobre o total incluída a multa, configurando capitalização vedada — diferença de ${brl(1500 + i * 100)}. O valor correto é ${brl(53700 + i * 2700)}, configurando excesso de execução de ${brl(4300 + i * 300)} (art. 525 §1º, III, CPC).`,
  pedido: "acolhimento da impugnação para reduzir o valor exequendo ao correto e suspender a execução no excesso",
  norma: "art. 525 §1º, III, CPC (excesso de execução); arts. 523 e 524 CPC; IPCA-E e SELIC como parâmetros legais",
});

const tEcImpugnacaoInexigibilidade = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Impugnação ao cumprimento — inexigibilidade do título",
  autor: pick(NOMES, i + 5),
  reu: pick(NOMES, i + 15),
  comarca: pick(COMARCAS, i + 5),
  fatos: `${pick(NOMES, i + 5)} apresenta impugnação alegando inexigibilidade do título executivo. Fundamento: ${pick(["a sentença exequenda foi prolatada por juízo estadual em matéria de competência federal exclusiva (art. 109, I, CF/88) — nulidade absoluta insanável", "o réu nunca foi citado regularmente no processo de conhecimento — nulidade da citação viola o art. 238 CPC e o art. 5º, LV, CF/88", "o título consiste em sentença proferida com violação manifesta do contraditório — ausência de intimação para produção de prova essencial"], i)}. O vício é insanável e impede a exigibilidade do título (art. 525 §1º, I, CPC).`,
  pedido: "declaração de inexigibilidade do título executivo e extinção do cumprimento de sentença sem resolução do mérito",
  norma: "art. 525 §1º, I, CPC (inexigibilidade do título); art. 803, I, CPC; arts. 239 e 280 CPC (nulidade de citação)",
});

const tEcImpugnacaoErroCalculo = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Impugnação ao cumprimento — erro nos cálculos (juros e correção)",
  autor: pick(NOMES, i + 6),
  reu: pick(NOMES, i + 16),
  comarca: pick(COMARCAS, i + 6),
  fatos: `${pick(NOMES, i + 6)} (executado) impugna o demonstrativo por erros materiais nos cálculos: (a) aplicou-se taxa de juros de ${4 + (i % 4)}% ao mês (${(4 + (i % 4)) * 12}% ao ano) em vez da taxa SELIC — diferença de ${brl(12000 + i * 1000)}; (b) a data-base da correção monetária foi fixada na sentença, quando o correto, por tratar-se de responsabilidade extracontratual, é a data do evento danoso (Súmula 54 STJ) — diferença de ${brl(3500 + i * 500)}. O impacto total do erro é de ${brl(15500 + i * 1500)}.`,
  pedido: "acolhimento da impugnação para corrigir os cálculos: juros pela SELIC e data-base da Súmula 54 STJ",
  norma: "art. 525 §1º, III, CPC; art. 406 CC (SELIC); Súmula 54 STJ (dies a quo dos juros moratórios — extracontratual)",
});

const tEcImpugnacaoPrescricao = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Impugnação ao cumprimento — prescrição intercorrente",
  autor: pick(NOMES, i + 7),
  reu: pick(NOMES, i + 17),
  comarca: pick(COMARCAS, i + 7),
  fatos: `${pick(NOMES, i + 7)} apresenta impugnação por prescrição intercorrente. O cumprimento de sentença ficou paralisado por ${5 + (i % 4)} anos e ${3 + (i % 9)} meses sem qualquer movimentação útil por culpa do exequente. Última movimentação efetiva: ${dateBack(5 + (i % 4), i)}. O exequente não promoveu os atos de execução necessários (art. 921 §1º CPC) nem postulou qualquer diligência. O prazo prescricional correspondente à pretensão originária (${2 + (i % 2)} anos) fluiu integralmente durante a paralisia.`,
  pedido: "reconhecimento da prescrição intercorrente e extinção do cumprimento de sentença com resolução do mérito (art. 924, V, CPC c/c art. 921 §§4º e 5º CPC)",
  norma: "art. 921 §§4º e 5º CPC; art. 924, V, CPC; Tema STJ 1.062 (EREsp 1.655.682)",
  jurisprudencias: [JUR_PRESCRICAO_INTERCORRENTE],
});

// ── Decisões (casos 9-13) ─────────────────────────────────────────────────────

const tEcSisbajudDecisao = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "SISBAJUD — decisão de penhora eletrônica",
  autor: pick(NOMES, i),
  reu: pick(NOMES, i + 10),
  comarca: pick(COMARCAS, i),
  fatos: `Fase de cumprimento de sentença. O prazo do art. 523 CPC transcorreu sem pagamento voluntário. Exequente ${pick(NOMES, i)} requer bloqueio eletrônico de ativos financeiros de ${pick(NOMES, i + 10)} via SISBAJUD (BacenJud 2.0). Pesquisa prévia de bens imóveis e veículos não localizou patrimônio suficiente. O sistema deve consultar e bloquear contas correntes, aplicações financeiras e investimentos até o limite de ${brl(32000 + i * 2000)} (principal + multa + honorários).`,
  pedido: "autorização e expedição de ordem de penhora eletrônica via SISBAJUD até o valor integral da execução",
  norma: "arts. 854 e 855 CPC (penhora eletrônica); art. 835, I, CPC (preferência legal sobre dinheiro/créditos bancários)",
});

const tEcRenajudDecisao = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "RENAJUD — decisão de restrição veicular",
  autor: pick(NOMES, i + 1),
  reu: pick(NOMES, i + 11),
  comarca: pick(COMARCAS, i + 1),
  fatos: `Exequente ${pick(NOMES, i + 1)} requer restrição de veículos do executado ${pick(NOMES, i + 11)} via RENAJUD. O bloqueio via SISBAJUD resultou em apenas ${brl(800 + i * 100)} bloqueados, insuficientes para cobrir o débito de ${brl(22000 + i * 2000)}. Pesquisa no DETRAN/SENATRAN aponta ${1 + (i % 2)} veículo(s) registrado(s) em nome do executado: ${pick(["Chevrolet Onix 2020, avaliado em R$ 48.000,00", "Toyota Corolla 2019, avaliado em R$ 82.000,00", "Honda HRV 2021, avaliado em R$ 97.000,00"], i)}.`,
  pedido: "restrição de transferência dos veículos via RENAJUD e posterior leilão para satisfação do crédito",
  norma: "art. 835, III, CPC (penhora de veículos automotores); arts. 845 §1º e 856 CPC; art. 879 e ss. CPC (avaliação e alienação)",
});

const tEcPenhoraAtivosDecisao = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Penhora de faturamento / créditos — decisão",
  autor: pick(NOMES, i + 2),
  reu: pick(EMPRESAS, i).nome,
  comarca: pick(COMARCAS, i + 2),
  fatos: `Fase de cumprimento de sentença. Exequente ${pick(NOMES, i + 2)} requer penhora de faturamento da executada ${pick(EMPRESAS, i).nome} (CNPJ ${pick(EMPRESAS, i).cnpj}). SISBAJUD bloqueou apenas ${brl(9000 + i * 500)} de ${brl(35000 + i * 3000)} devidos. Pesquisa patrimonial não localizou imóveis ou veículos. A empresa está em plena atividade comercial com faturamento mensal de aproximadamente ${brl(150000 + i * 20000)}, confirmado por declarações fiscais juntadas.`,
  pedido: "deferimento da penhora de 10% do faturamento mensal até atingir o saldo remanescente da execução",
  norma: "art. 835, XI, CPC (penhora de outros direitos); art. 866 CPC (penhora de estabelecimento / faturamento); art. 836 CPC (gradação)",
});

const tEcDesbloqueioValoresDecisao = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Desbloqueio de valores — excesso e verba salarial",
  autor: pick(NOMES, i + 3),
  reu: pick(NOMES, i + 13),
  comarca: pick(COMARCAS, i + 3),
  fatos: `O executado ${pick(NOMES, i + 3)} requer desbloqueio parcial de valores. O SISBAJUD bloqueou ${brl(46000 + i * 3000)}, superior ao débito de ${brl(30000 + i * 2000)} — excesso de ${brl(16000 + i * 1000)} (art. 831 CPC — penhora suficiente). Adicionalmente, ${brl(7500 + i * 400)} do montante bloqueado correspondem ao salário líquido do mês corrente, impenhorável nos termos do art. 833, IV, CPC.`,
  pedido: "desbloqueio imediato do excesso de penhora (art. 854 §3º CPC) e da verba salarial impenhorável (art. 833, IV, CPC)",
  norma: "art. 831 CPC (penhora deve ser suficiente); art. 833, IV, CPC (impenhorabilidade de salário); art. 854 §3º CPC (liberação do bloqueado a maior)",
  jurisprudencias: [JUR_IMPENHORABILIDADE_SALARIO],
});

const tEcPenhoraSalarioDecisao = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Penhora de percentual do salário — decisão",
  autor: pick(NOMES, i + 4),
  reu: pick(NOMES, i + 14),
  comarca: pick(COMARCAS, i + 4),
  fatos: `Exequente ${pick(NOMES, i + 4)} requer penhora de 30% do salário líquido do executado ${pick(NOMES, i + 14)}, servidor público com remuneração de ${brl(9000 + i * 600)}/mês. O executado invoca a impenhorabilidade do art. 833, IV, CPC. O exequente contra-argumenta com o EREsp 1.518.169/DF do STJ: quando o salário supera o necessário à subsistência (acima de 50 salários mínimos ou para dívidas alimentares), admite-se penhora de até 30% do valor líquido. O débito total é de ${brl(85000 + i * 5000)}.`,
  pedido: "autorização de penhora de 20 a 30% do salário líquido mensal até a satisfação integral do crédito",
  norma: "art. 833, IV e §2º, CPC; EREsp 1.518.169/DF (STJ); art. 548, I, CLT (proteção ao salário mínimo)",
  jurisprudencias: [JUR_IMPENHORABILIDADE_SALARIO],
});

// ── Sentenças terminativas (casos 14-17) ─────────────────────────────────────

const tEcImpugnacaoProcSentenca = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Impugnação ao cumprimento — sentença procedente",
  autor: pick(NOMES, i),
  reu: pick(NOMES, i + 10),
  comarca: pick(COMARCAS, i),
  fatos: `Impugnante demonstrou excesso de execução por laudo de contador judicial: o valor correto é ${brl(54000 + i * 3500)}, e não ${brl(61500 + i * 4000)} como calculado pelo exequente. Excesso de ${brl(7500 + i * 500)}. Adicionalmente, ${brl(4800 + i * 200)} bloqueados via SISBAJUD representam salário do mês corrente, impenhorável. Instrução encerrada com perícia contábil favorável ao impugnante.`,
  pedido: "procedência da impugnação, redução do débito ao valor correto e desbloqueio do salário impenhorável",
  norma: "art. 525 §§1º e 14 CPC; art. 833, IV, CPC",
  sentencaInstruction: `${SENT_EC_BASE}
VARIAÇÃO — PROCEDENTE (EXCESSO DE EXECUÇÃO + IMPENHORABILIDADE):
1. Acolher a impugnação por excesso de execução (art. 525 §1º, III, CPC): reduzir o débito ao valor correto apurado pela perícia.
2. Determinar o desbloqueio da verba salarial impenhorável (art. 833, IV, CPC).
3. Prosseguir o cumprimento pelo valor correto (principal + correção IPCA-E + juros SELIC + multa e honorários legais).
4. Honorários da impugnação: ao impugnado, proporcionais ao êxito (art. 85 §2º CPC).
5. Recurso cabível: Agravo de Instrumento (art. 1.015, XIV, CPC) se for decisão interlocutória; Apelação (art. 1.009 CPC) se encerrar a fase executiva.`,
});

const tEcImpugnacaoImprocSentenca = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Impugnação ao cumprimento — sentença improcedente",
  autor: pick(NOMES, i + 1),
  reu: pick(NOMES, i + 11),
  comarca: pick(COMARCAS, i + 1),
  fatos: `Executado ${pick(NOMES, i + 1)} apresentou impugnação alegando: (a) excesso de execução — refutado por perícia que confirmou os cálculos do exequente; (b) inexigibilidade do título — afastada, pois o processo de conhecimento seguiu o rito regular com citação válida. Instrução encerrada. Os cálculos do exequente foram confirmados pelo contador judicial: ${brl(48000 + i * 3000)}.`,
  pedido: "improcedência da impugnação e prosseguimento do cumprimento de sentença",
  norma: "art. 525 §§1º e 14 CPC; arts. 523 e 524 CPC",
  sentencaInstruction: `${SENT_EC_BASE}
VARIAÇÃO — IMPROCEDENTE (IMPUGNAÇÃO REJEITADA):
1. Rejeitar a arguição de excesso de execução: perícia confirmou os cálculos do exequente.
2. Rejeitar a alegação de inexigibilidade: citação válida, processo regular.
3. Prosseguir imediatamente a execução pelo valor total: ${brl(48000 + i * 3000)}.
4. Honorários da impugnação rejeitada: ao exequente (art. 85 §2º CPC).
5. Multa por impugnação manifestamente protelatória: verificar se houve litigância de má-fé (art. 80 CPC).`,
});

const tEcExtincaoSatisfacaoSentenca = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Extinção da execução por satisfação do crédito",
  autor: pick(NOMES, i + 2),
  reu: pick(NOMES, i + 12),
  comarca: pick(COMARCAS, i + 2),
  fatos: `${pick(NOMES, i + 12)} (executado) realizou o pagamento integral do débito exequendo, depositando em juízo ${brl(37000 + i * 2500)} — valor integral correspondente a principal + correção IPCA-E + juros SELIC + multa de 10% + honorários de 10%. O exequente ${pick(NOMES, i + 2)} requereu o levantamento dos valores e a extinção da execução. O depósito foi confirmado pelo cartório.`,
  pedido: "extinção do cumprimento de sentença por satisfação integral (art. 924, II, CPC) e liberação dos valores ao exequente",
  norma: "art. 924, II, CPC (extinção por satisfação do crédito); art. 925 CPC (extinção da execução)",
  sentencaInstruction: `${SENT_EC_BASE}
VARIAÇÃO — EXTINÇÃO POR SATISFAÇÃO (art. 924, II, CPC):
1. Verificar que o depósito cobre o valor integral: principal + correção + juros + multa de 10% + honorários de 10%.
2. Declarar extinto o cumprimento de sentença por satisfação do crédito (art. 924, II c/c art. 925 CPC).
3. Autorizar o levantamento imediato dos valores ao exequente.
4. Cancelar eventuais penhoras e restrições (SISBAJUD, RENAJUD, ARISP).
5. Não há honorários adicionais para a extinção em si — apenas os já incluídos nos 10% do art. 523 §1º CPC.`,
});

const tEcExtincaoPrescricaoSentenca = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Extinção da execução por prescrição intercorrente",
  autor: pick(NOMES, i + 3),
  reu: pick(NOMES, i + 13),
  comarca: pick(COMARCAS, i + 3),
  fatos: `Fase de cumprimento de sentença. O processo ficou paralisado por ${5 + (i % 4)} anos sem qualquer movimentação útil do exequente ${pick(NOMES, i + 3)}. O executado ${pick(NOMES, i + 13)} apresentou impugnação por prescrição intercorrente. A análise dos autos confirma: (a) inércia total do exequente no período; (b) o prazo da pretensão originária (${2 + (i % 2)} anos) fluiu por completo durante a paralisia; (c) exequente intimado sobre a possível prescrição (art. 921 §5º CPC) quedou-se inerte por ${12 + (i % 6)} meses adicionais.`,
  pedido: "declaração da prescrição intercorrente e extinção do cumprimento de sentença com resolução do mérito",
  norma: "art. 921 §§4º e 5º CPC; art. 924, V, CPC; Tema STJ 1.062; art. 487, II, CPC (resolução de mérito)",
  jurisprudencias: [JUR_PRESCRICAO_INTERCORRENTE],
  sentencaInstruction: `${SENT_EC_BASE}
VARIAÇÃO — EXTINÇÃO POR PRESCRIÇÃO INTERCORRENTE (art. 924, V, CPC):
1. Verificar os requisitos: (a) paralisação do processo por prazo superior ao da prescrição da pretensão; (b) inércia do exequente; (c) intimação prévia (art. 921 §5º CPC).
2. Declarar a prescrição intercorrente de ofício ou acolher a impugnação (art. 921 §4º CPC).
3. Extinguir o cumprimento de sentença com resolução do mérito (art. 924, V c/c art. 487, II, CPC).
4. Honorários sucumbenciais ao executado (art. 85 §2º CPC).
5. Recurso: Apelação (art. 1.009 CPC) — sentença terminativa.`,
});

// ── Recursos (casos 18-20) ────────────────────────────────────────────────────

const tEcAgravoPenhoraRecurso = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Agravo de instrumento — contra decisão de penhora",
  autor: pick(NOMES, i),
  reu: pick(NOMES, i + 10),
  comarca: pick(COMARCAS, i),
  fatos: `O executado ${pick(NOMES, i)} interpõe agravo de instrumento contra decisão que deferiu a penhora de 30% do seu salário líquido de ${brl(8500 + i * 500)}/mês. A decisão recorrida entendeu que o salário supera o necessário à subsistência, aplicando o EREsp 1.518.169/DF. Agravante sustenta: (a) o salário é seu único rendimento; (b) possui 3 dependentes; (c) o percentual é excessivo. Cabimento do AI: art. 1.015, XIV, CPC (decisão sobre penhora). Prazo: 15 dias (art. 1.003 §5º CPC).`,
  pedido: "reforma da decisão para reduzir ou afastar a penhora salarial por respeito ao art. 833, IV, CPC",
  norma: "art. 1.015, XIV, CPC (AI cabível contra penhora); art. 833, IV, CPC; EREsp 1.518.169/DF (STJ)",
  jurisprudencias: [JUR_IMPENHORABILIDADE_SALARIO],
});

const tEcAgravoImpugnacaoRecurso = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Agravo de instrumento — contra rejeição de impugnação",
  autor: pick(NOMES, i + 1),
  reu: pick(NOMES, i + 11),
  comarca: pick(COMARCAS, i + 1),
  fatos: `O executado ${pick(NOMES, i + 1)} interpõe agravo de instrumento contra a decisão que rejeitou sua impugnação ao cumprimento de sentença. A impugnação arguiu excesso de execução comprovado por laudo contábil: o valor correto é ${brl(51000 + i * 3000)} e não ${brl(58000 + i * 3500)} como calculado pelo exequente. A decisão rejeitou o laudo sem fundamentação adequada. Agravante: a rejeição viola o art. 525 §1º, III e §14, CPC. Cabimento do AI: art. 1.015, XIV, CPC.`,
  pedido: "reforma da decisão para acolher a impugnação e reduzir o débito ao valor correto apurado pela perícia",
  norma: "art. 1.015, XIV, CPC; art. 525 §§1º, III, e 14, CPC (impugnação por excesso de execução)",
});

const tEcEmbargosDeclaracaoRecurso = (i: number): ThemeNarrative => ({
  area: "EXECUCAO_CUMPRIMENTO",
  themeLabel: "Embargos de declaração — execução",
  autor: pick(NOMES, i + 2),
  reu: pick(NOMES, i + 12),
  comarca: pick(COMARCAS, i + 2),
  fatos: `${pick(NOMES, i + 2)} opõe embargos de declaração em face de sentença que extinguiu o cumprimento de sentença por satisfação (art. 924, II, CPC). Pontos omissos ou contraditórios: (a) omissão quanto ao cancelamento formal das restrições SISBAJUD e RENAJUD; (b) contradição entre a declaração de quitação total e a ressalva sobre eventuais honorários sucumbenciais pendentes; (c) obscuridade quanto ao valor final levantado e se inclui os honorários dos arts. 523 §1º e 85 CPC. Prazo: 5 dias (art. 1.023 CPC).`,
  pedido: "sanear a omissão quanto às restrições e a contradição quanto a honorários, para fins de prequestionamento",
  norma: "arts. 1.022 e 1.025 CPC (embargos de declaração — omissão, contradição, obscuridade); art. 924, II, CPC",
});

// Adiciona os 20 temas de Fazenda Pública ao THEMES
THEMES.push(
  // Petições iniciais (5)
  { id: "fp_medicamento_inicial",         build: tFpMedicamentoInicial,         compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "fp_sus_cirurgia_inicial",        build: tFpSusCircurgiaInicial,        compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "fp_concurso_nomeacao_inicial",   build: tFpConcursoNomeacaoInicial,    compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "fp_servidor_progressao_inicial", build: tFpServidorProgressaoInicial,  compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "fp_servidor_verba_inicial",      build: tFpServidorVerbaInicial,       compatibleTypes: ["PETICAO_INICIAL"] },
  // Decisões (5)
  { id: "fp_tutela_medicamento_decisao",  build: tFpTutelaMedicamentoDecisao,   compatibleTypes: ["DECISAO"] },
  { id: "fp_tutela_cirurgia_decisao",     build: tFpTutelaCirurgiaDecisao,      compatibleTypes: ["DECISAO"] },
  { id: "fp_concurso_suspensao_decisao",  build: tFpConcursoSuspensaoDecisao,   compatibleTypes: ["DECISAO"] },
  { id: "fp_gratuidade_decisao",          build: tFpGratuidadeDecisao,          compatibleTypes: ["DECISAO"] },
  { id: "fp_pericia_decisao",             build: tFpPericiaDecisao,             compatibleTypes: ["DECISAO"] },
  // Sentenças (6)
  { id: "fp_medicamento_proc_sentenca",   build: tFpMedicamentoProcSentenca,    compatibleTypes: ["SENTENCA"] },
  { id: "fp_medicamento_improc_sentenca", build: tFpMedicamentoImprocSentenca,  compatibleTypes: ["SENTENCA"] },
  { id: "fp_concurso_proc_sentenca",      build: tFpConcursoProcSentenca,       compatibleTypes: ["SENTENCA"] },
  { id: "fp_concurso_improc_sentenca",    build: tFpConcursoImprocSentenca,     compatibleTypes: ["SENTENCA"] },
  { id: "fp_servidor_proc_sentenca",      build: tFpServidorProcSentenca,       compatibleTypes: ["SENTENCA"] },
  { id: "fp_servidor_improc_sentenca",    build: tFpServidorImprocSentenca,     compatibleTypes: ["SENTENCA"] },
  // Recursos (4)
  { id: "fp_apelacao_fazenda_recurso",    build: tFpApelacaoFazendaRecurso,     compatibleTypes: ["RECURSO"] },
  { id: "fp_contrarrazoes_recurso",       build: tFpContrarrazoesRecurso,       compatibleTypes: ["RECURSO"] },
  { id: "fp_agravo_tutela_recurso",       build: tFpAgravoTutelaRecurso,        compatibleTypes: ["RECURSO"] },
  { id: "fp_embargos_declaracao_recurso", build: tFpEmbargosDeclaracaoRecurso,  compatibleTypes: ["RECURSO"] },
);

// Adiciona os 20 temas de Execução / Cumprimento de Sentença ao THEMES
THEMES.push(
  // Petições / Requerimentos (4)
  { id: "ec_cumprimento_inicial",          build: tEcCumprimentoInicial,          compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "ec_cumprimento_fazenda_inicial",  build: tEcCumprimentoFazendaInicial,   compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "ec_obrigacao_fazer_inicial",      build: tEcObrigacaoFazerInicial,       compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "ec_obrigacao_pagar_inicial",      build: tEcObrigacaoPagarInicial,       compatibleTypes: ["PETICAO_INICIAL"] },
  // Impugnações (4)
  { id: "ec_impugnacao_excesso",           build: tEcImpugnacaoExcesso,           compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "ec_impugnacao_inexigibilidade",   build: tEcImpugnacaoInexigibilidade,   compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "ec_impugnacao_erro_calculo",      build: tEcImpugnacaoErroCalculo,       compatibleTypes: ["PETICAO_INICIAL"] },
  { id: "ec_impugnacao_prescricao",        build: tEcImpugnacaoPrescricao,        compatibleTypes: ["PETICAO_INICIAL"] },
  // Decisões (5)
  { id: "ec_sisbajud_decisao",             build: tEcSisbajudDecisao,             compatibleTypes: ["DECISAO"] },
  { id: "ec_renajud_decisao",              build: tEcRenajudDecisao,              compatibleTypes: ["DECISAO"] },
  { id: "ec_penhora_ativos_decisao",       build: tEcPenhoraAtivosDecisao,        compatibleTypes: ["DECISAO"] },
  { id: "ec_desbloqueio_valores_decisao",  build: tEcDesbloqueioValoresDecisao,   compatibleTypes: ["DECISAO"] },
  { id: "ec_penhora_salario_decisao",      build: tEcPenhoraSalarioDecisao,       compatibleTypes: ["DECISAO"] },
  // Sentenças terminativas (4)
  { id: "ec_impugnacao_proc_sentenca",     build: tEcImpugnacaoProcSentenca,      compatibleTypes: ["SENTENCA"] },
  { id: "ec_impugnacao_improc_sentenca",   build: tEcImpugnacaoImprocSentenca,    compatibleTypes: ["SENTENCA"] },
  { id: "ec_extincao_satisfacao_sentenca", build: tEcExtincaoSatisfacaoSentenca,  compatibleTypes: ["SENTENCA"] },
  { id: "ec_extincao_prescricao_sentenca", build: tEcExtincaoPrescricaoSentenca,  compatibleTypes: ["SENTENCA"] },
  // Recursos (3)
  { id: "ec_agravo_penhora_recurso",           build: tEcAgravoPenhoraRecurso,        compatibleTypes: ["RECURSO"] },
  { id: "ec_agravo_impugnacao_recurso",         build: tEcAgravoImpugnacaoRecurso,     compatibleTypes: ["RECURSO"] },
  { id: "ec_embargos_declaracao_ec_recurso",    build: tEcEmbargosDeclaracaoRecurso,   compatibleTypes: ["RECURSO"] },
);

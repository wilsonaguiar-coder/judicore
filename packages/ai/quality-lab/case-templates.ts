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
  norma: "art. 14 CDC e art. 186 CC/2002",
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

export const PHASE_BUILDERS: Record<
  "PETICAO_INICIAL" | "RECURSO" | "DECISAO" | "SENTENCA",
  (n: ThemeNarrative, i: number, trap?: TrapKind) => SyntheticCase
> = {
  PETICAO_INICIAL: buildInicial,
  RECURSO: buildRecurso,
  DECISAO: buildDecisao,
  SENTENCA: buildSentenca,
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

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
      if (area === "CRIMINAL") {
        return {
          description: base.description,
          instruction: "Aplicar honorários advocatícios nos termos do art. 85 CPC sobre a condenação.",
          expectedRulesIfTrap: ["WRONG_HONORARIOS_CRIMINAL"],
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
      return { description: base.description, instruction: base.instruction ?? "", expectedRulesIfTrap: [] };
    case "COMPETENCIA_INCORRETA":
      if (area === "TRABALHISTA") {
        return {
          description: base.description,
          instruction: "Dirigir o recurso ao Superior Tribunal de Justiça (STJ) para análise da matéria trabalhista.",
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
  const desc = `Magistrado deve proferir sentença em ação ajuizada por ${n.autor} em face de ${n.reu}. Autos n. ${processo(i, n.area === "TRABALHISTA" ? "trabalho" : n.area === "RGPS" || n.area === "RPPS" ? "federal" : "estadual")}. Pedido: ${n.pedido}. Fatos da causa: ${n.fatos} Provas produzidas: documentais e periciais nos autos. Fundamento: ${n.norma}.`;
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
  if (trap) {
    const t = applyTrap({ description: desc, expectedRulesIfTrap: [] }, trap, n.area, "SENTENCA");
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
